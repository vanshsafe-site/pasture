-- Minimal account directory and login audit. Do not expose the private schema
-- in Supabase's Data API settings.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);

create table if not exists public.login_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  signed_in_at timestamptz not null
);

revoke all on public.profiles, public.login_events from public, anon, authenticated;

create index if not exists login_events_signed_in_idx on public.login_events(signed_in_at desc);
create index if not exists login_events_user_signed_in_idx on public.login_events(user_id, signed_in_at desc);
create index if not exists profiles_last_login_idx on public.profiles(last_login_at desc);

alter table public.profiles enable row level security;
alter table public.login_events enable row level security;

create or replace function private.is_farm_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;
revoke all on function private.is_farm_admin() from public, anon;
grant execute on function private.is_farm_admin() to authenticated;

create policy "Users can read their own profile and admins can read profiles"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id or (select private.is_farm_admin()));

create policy "Only admins can read login activity"
  on public.login_events for select to authenticated
  using ((select private.is_farm_admin()));

grant select on public.profiles, public.login_events to authenticated;

create or replace function private.sync_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  promoted boolean;
begin
  promoted := pg_catalog.lower(pg_catalog.btrim(coalesce(new.email, ''))) = 'vanshgargvl777@gmail.com'
    and new.email_confirmed_at is not null;

  insert into public.profiles (id, email, role, created_at, last_login_at)
  values (new.id, coalesce(new.email, ''), case when promoted then 'admin' else 'user' end,
    coalesce(new.created_at, now()), new.last_sign_in_at)
  on conflict (id) do update set
    email = excluded.email,
    role = excluded.role,
    last_login_at = coalesce(excluded.last_login_at, public.profiles.last_login_at);

  if tg_op = 'UPDATE'
    and new.last_sign_in_at is not null
    and new.last_sign_in_at is distinct from old.last_sign_in_at then
    insert into public.login_events (user_id, email, signed_in_at)
    values (new.id, coalesce(new.email, ''), new.last_sign_in_at);
  end if;

  return new;
end;
$$;
revoke all on function private.sync_auth_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_sync_profile on auth.users;
create trigger on_auth_user_sync_profile
  after insert or update of email, email_confirmed_at, last_sign_in_at on auth.users
  for each row execute function private.sync_auth_user();

-- Backfill existing accounts and promote the confirmed administrator email.
insert into public.profiles (id, email, role, created_at, last_login_at)
select id, coalesce(email, ''),
  case when pg_catalog.lower(pg_catalog.btrim(coalesce(email, ''))) = 'vanshgargvl777@gmail.com'
    and email_confirmed_at is not null then 'admin' else 'user' end,
  coalesce(created_at, now()), last_sign_in_at
from auth.users
on conflict (id) do update set
  email = excluded.email,
  role = excluded.role,
  last_login_at = coalesce(excluded.last_login_at, public.profiles.last_login_at);

insert into public.login_events (user_id, email, signed_in_at)
select id, coalesce(email, ''), last_sign_in_at
from auth.users
where last_sign_in_at is not null
  and not exists (
    select 1 from public.login_events e
    where e.user_id = auth.users.id and e.signed_in_at = auth.users.last_sign_in_at
  );
