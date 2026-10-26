-- Additive upgrade for existing Pasture installations. Apply after migrations/.
-- The complete, repeatable SQL Editor version is supabase/setup.sql.
create schema if not exists private;

create table if not exists public.farm_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 160),
  due_date date not null,
  due_time time,
  notes text check (notes is null or length(notes) <= 2000),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
create table if not exists public.farm_settings (
  owner_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  farm_name text not null check (length(btrim(farm_name)) between 1 and 100),
  owner_name text not null default '' check (length(owner_name) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1
);
alter table public.farm_tasks enable row level security;
alter table public.farm_settings enable row level security;
revoke all on public.farm_tasks, public.farm_settings from public, anon, authenticated;
grant select, insert, update, delete on public.farm_tasks, public.farm_settings to authenticated;
drop policy if exists "Owners manage their tasks" on public.farm_tasks;
create policy "Owners manage their tasks" on public.farm_tasks for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Owners manage farm settings" on public.farm_settings;
create policy "Owners manage farm settings" on public.farm_settings for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create index if not exists farm_tasks_owner_due_idx on public.farm_tasks(owner_id, due_date);

-- Row versions let clients detect concurrent changes rather than overwrite them.
do $$
declare table_name text;
begin
  foreach table_name in array array['cows','milk_records','health_records','feed_inventory'] loop
    execute format('alter table public.%I add column if not exists version integer not null default 1', table_name);
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()', table_name);
  end loop;
end $$;
create or replace function private.touch_farm_record()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_farm_record() from public, anon, authenticated;
do $$
declare table_name text;
begin
  foreach table_name in array array['cows','milk_records','health_records','feed_inventory','farm_tasks','farm_settings'] loop
    execute format('drop trigger if exists touch_farm_record on public.%I', table_name);
    execute format('create trigger touch_farm_record before update on public.%I for each row execute function private.touch_farm_record()', table_name);
  end loop;
end $$;

-- Both sides of an animal/health relationship must belong to the same account.
do $$
begin
  if exists(select 1 from public.health_records h join public.cows c on c.id=h.cow_id where h.owner_id<>c.owner_id) then
    raise exception 'Health records with mismatched animal ownership exist. Correct those rows before applying this upgrade.';
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.cows'::regclass and conname='cows_id_owner_unique') then
    alter table public.cows add constraint cows_id_owner_unique unique(id, owner_id);
  end if;
end $$;
alter table public.health_records drop constraint if exists health_records_cow_id_fkey;
do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.health_records'::regclass and conname='health_records_owned_animal_fk') then
    alter table public.health_records add constraint health_records_owned_animal_fk
      foreign key(cow_id, owner_id) references public.cows(id, owner_id) on delete no action;
  end if;
end $$;

-- One farm-wide total per date/session. Never silently discard old duplicates.
do $$
begin
  if exists(select 1 from public.milk_records group by owner_id,record_date,session having count(*)>1) then
    raise exception 'Duplicate daily milk sessions exist. Consolidate these totals before applying this upgrade; no records have been removed.';
  end if;
end $$;
create unique index if not exists milk_records_owner_date_session_unique on public.milk_records(owner_id,record_date,session);

-- NOT VALID preserves existing legacy records while enforcing new writes.
do $$
begin
  if not exists(select 1 from pg_constraint where conrelid='public.cows'::regclass and conname='cows_valid_fields') then
    alter table public.cows add constraint cows_valid_fields check (
      length(btrim(tag_number)) between 1 and 40 and length(btrim(name)) between 1 and 80
      and length(btrim(breed)) between 1 and 80 and (age_label is null or length(age_label)<=40)
    ) not valid;
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.milk_records'::regclass and conname='milk_valid_fields') then
    alter table public.milk_records add constraint milk_valid_fields check (
      liters>0 and liters<=1000000 and cow_count between 1 and 100000 and (notes is null or length(notes)<=2000)
    ) not valid;
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.health_records'::regclass and conname='health_valid_fields') then
    alter table public.health_records add constraint health_valid_fields check (
      length(btrim(summary)) between 1 and 2000 and (veterinarian is null or length(veterinarian)<=120)
      and (next_due is null or next_due>=record_date)
    ) not valid;
  end if;
  if not exists(select 1 from pg_constraint where conrelid='public.feed_inventory'::regclass and conname='feed_valid_fields') then
    alter table public.feed_inventory add constraint feed_valid_fields check (
      length(btrim(item_name)) between 1 and 120 and quantity between 0 and 1000000
      and reorder_at between 0 and 1000000 and unit in ('kg','tonnes','litres','bags','units')
    ) not valid;
  end if;
end $$;

-- Explicit grants protect against permissive defaults in older Supabase projects.
revoke all on public.cows,public.milk_records,public.health_records,public.feed_inventory from public,anon,authenticated;
grant select,insert,update,delete on public.cows,public.milk_records,public.health_records,public.feed_inventory to authenticated;
revoke all on public.profiles,public.login_events from public,anon,authenticated;
grant select on public.profiles,public.login_events to authenticated;

create or replace function private.is_farm_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(
    select 1 from public.profiles p join auth.users u on u.id=p.id
    where p.id=(select auth.uid()) and p.role='admin'
      and lower(u.email)='vanshgargvl777@gmail.com' and u.email_confirmed_at is not null
  );
$$;
revoke all on function private.is_farm_admin() from public,anon;
grant execute on function private.is_farm_admin() to authenticated;
create unique index if not exists profiles_single_administrator on public.profiles(role) where role='admin';

create or replace function private.sync_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare promoted boolean;
begin
  promoted := lower(btrim(coalesce(new.email,'')))='vanshgargvl777@gmail.com' and new.email_confirmed_at is not null;
  insert into public.profiles(id,email,role,created_at,last_login_at)
  values(new.id,coalesce(new.email,''),case when promoted then 'admin' else 'user' end,coalesce(new.created_at,now()),new.last_sign_in_at)
  on conflict(id) do update set email=excluded.email,role=excluded.role,last_login_at=coalesce(excluded.last_login_at,public.profiles.last_login_at);
  if new.last_sign_in_at is not null then
    if tg_op='INSERT' then
      insert into public.login_events(user_id,email,signed_in_at) values(new.id,coalesce(new.email,''),new.last_sign_in_at);
    elsif new.last_sign_in_at is distinct from old.last_sign_in_at then
      insert into public.login_events(user_id,email,signed_in_at) values(new.id,coalesce(new.email,''),new.last_sign_in_at);
    end if;
    delete from public.login_events where signed_in_at < now() - interval '90 days';
  end if;
  return new;
end;
$$;
revoke all on function private.sync_auth_user() from public,anon,authenticated;
