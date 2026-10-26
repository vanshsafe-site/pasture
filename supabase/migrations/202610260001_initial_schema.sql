-- Pasture dairy farm schema. Apply to a dedicated Supabase project.
create extension if not exists pgcrypto;

create table if not exists public.cows (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tag_number text not null,
  name text not null,
  breed text not null default 'Other',
  age_label text,
  health_status text not null default 'healthy' check (health_status in ('healthy','checkup_due','under_treatment','inactive')),
  created_at timestamptz not null default now(),
  unique (owner_id, tag_number)
);

create table if not exists public.milk_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  record_date date not null default current_date,
  session text not null check (session in ('Morning','Evening')),
  liters numeric(10,2) not null check (liters > 0),
  cow_count integer not null default 0 check (cow_count >= 0),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cow_id uuid not null references public.cows(id) on delete cascade,
  record_date date not null default current_date,
  record_type text not null check (record_type in ('checkup','vaccination','treatment','note')),
  summary text not null,
  veterinarian text,
  next_due date,
  created_at timestamptz not null default now()
);

create table if not exists public.feed_inventory (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item_name text not null,
  quantity numeric(10,2) not null default 0 check (quantity >= 0),
  unit text not null default 'kg',
  reorder_at numeric(10,2) not null default 0 check (reorder_at >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists cows_owner_idx on public.cows(owner_id);
create index if not exists milk_records_owner_date_idx on public.milk_records(owner_id, record_date desc);
create index if not exists health_records_owner_date_idx on public.health_records(owner_id, record_date desc);
create index if not exists health_records_cow_idx on public.health_records(cow_id);
create index if not exists feed_inventory_owner_idx on public.feed_inventory(owner_id);

alter table public.cows enable row level security;
alter table public.milk_records enable row level security;
alter table public.health_records enable row level security;
alter table public.feed_inventory enable row level security;

create policy "Owners manage their cows" on public.cows for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners manage their milk records" on public.milk_records for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners manage their health records" on public.health_records for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy "Owners manage their feed inventory" on public.feed_inventory for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.cows, public.milk_records, public.health_records, public.feed_inventory to authenticated;
