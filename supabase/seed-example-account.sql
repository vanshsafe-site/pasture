-- Run the ENTIRE file in your Pasture project's Supabase SQL Editor.
-- First create vanshgargvlcontact@gmail.com through the app and verify its email.
-- Requires supabase/setup.sql. This does not create a password or sign anyone in.
-- Re-running preserves existing rows and does not duplicate the seeded records
-- for the same dates. On a later day it can add newly missing daily milk records.

begin;

do $$
declare
  account_id uuid;
  clover_id uuid;
  willow_id uuid;
  seed_today date := (now() at time zone 'Asia/Kolkata')::date;
begin
  begin
    select u.id into strict account_id
    from auth.users u
    where lower(u.email) = 'vanshgargvlcontact@gmail.com'
      and u.email_confirmed_at is not null;
  exception
    when no_data_found then
      raise exception 'Create the account vanshgargvlcontact@gmail.com through the app and verify its email first, then run this script again.';
    when too_many_rows then
      raise exception 'More than one matching account exists. Resolve the duplicate accounts before seeding.';
  end;

  -- Prevent two simultaneous runs of this seed from creating duplicate items.
  perform pg_advisory_xact_lock(hashtextextended('pasture-example-' || account_id::text, 0));

  -- This example account is a regular user, never the administrator.
  insert into public.profiles (id, email, role, created_at, last_login_at)
  select id, email, 'user', created_at, last_sign_in_at
  from auth.users where id = account_id
  on conflict (id) do update set role = 'user';

  insert into public.farm_settings (owner_id, farm_name, owner_name)
  values (account_id, 'Greenfield Example Farm', 'Vansh')
  on conflict (owner_id) do nothing;

  insert into public.cows (owner_id, tag_number, name, breed, age_label, health_status)
  values
    (account_id, 'EX-C-101', 'Daisy',     'Holstein Friesian', '4 years', 'healthy'),
    (account_id, 'EX-C-102', 'Maple',     'Jersey',            '3 years', 'healthy'),
    (account_id, 'EX-C-103', 'Clover',    'Gir',               '5 years', 'checkup_due'),
    (account_id, 'EX-C-104', 'Buttercup', 'Brown Swiss',       '4 years', 'healthy'),
    (account_id, 'EX-C-105', 'Willow',    'Jersey',            '2 years', 'under_treatment'),
    (account_id, 'EX-C-106', 'Hazel',     'Holstein Friesian', '8 years', 'inactive')
  on conflict (owner_id, tag_number) do nothing;

  -- Fourteen days of morning/evening totals; existing sessions are preserved.
  insert into public.milk_records (owner_id, record_date, session, liters, cow_count, notes)
  select account_id, seed_today - day_offset, session_name,
    (42 + ((day_offset * 7) % 15) + case when session_name = 'Morning' then 10 else -5 end)::numeric,
    4, '[Example] Sample farm-wide milking total. Edit or delete this record while testing.'
  from generate_series(0, 13) as days(day_offset)
  cross join (values ('Morning'), ('Evening')) as sessions(session_name)
  on conflict (owner_id, record_date, session) do nothing;

  select id into strict clover_id from public.cows
  where owner_id = account_id and tag_number = 'EX-C-103';
  select id into strict willow_id from public.cows
  where owner_id = account_id and tag_number = 'EX-C-105';

  insert into public.health_records
    (owner_id, cow_id, record_date, record_type, summary, veterinarian, next_due)
  select account_id, clover_id, seed_today - 7, 'checkup',
    '[Example] Routine checkup; follow-up due today.', 'Example veterinarian', seed_today
  where not exists (
    select 1 from public.health_records
    where owner_id = account_id and cow_id = clover_id
      and summary = '[Example] Routine checkup; follow-up due today.'
  );

  insert into public.health_records
    (owner_id, cow_id, record_date, record_type, summary, veterinarian, next_due)
  select account_id, willow_id, seed_today - 2, 'treatment',
    '[Example] Treatment observation record for demonstration only.', 'Example veterinarian', seed_today + 3
  where not exists (
    select 1 from public.health_records
    where owner_id = account_id and cow_id = willow_id
      and summary = '[Example] Treatment observation record for demonstration only.'
  );

  insert into public.feed_inventory (owner_id, item_name, quantity, unit, reorder_at)
  select account_id, item_name, quantity, unit, reorder_at
  from (values
    ('[Example] Silage',          180::numeric, 'kg',   200::numeric),
    ('[Example] Green fodder',    850::numeric, 'kg',   150::numeric),
    ('[Example] Mineral mixture',   6::numeric, 'bags',   2::numeric),
    ('[Example] Dry hay',         120::numeric, 'kg',    50::numeric)
  ) as examples(item_name, quantity, unit, reorder_at)
  where not exists (
    select 1 from public.feed_inventory inventory
    where inventory.owner_id = account_id and inventory.item_name = examples.item_name
  );

  insert into public.farm_tasks (owner_id, title, due_date, due_time, notes, completed)
  select account_id, title, seed_today + offset_days, due_time, notes, completed
  from (values
    ('[Example] Morning milking',                0, '06:30'::time, 'Record the whole-session milk total.', true),
    ('[Example] Arrange Clover follow-up',       0, '10:00'::time, 'Review the linked health record.', false),
    ('[Example] Order silage',                  -1, null::time,    'Stock is below its reorder threshold.', false),
    ('[Example] Evening milking',                0, '17:00'::time, 'Record the evening production total.', false),
    ('[Example] Review weekly production',       2, '09:00'::time, 'Open Reports and export the last seven days.', false)
  ) as examples(title, offset_days, due_time, notes, completed)
  where not exists (
    select 1 from public.farm_tasks tasks
    where tasks.owner_id = account_id and tasks.title = examples.title
  );
end;
$$;

-- Confirmation: counts for this account only, with no passwords or tokens.
select p.email, p.role,
  (select count(*) from public.cows c where c.owner_id = p.id) as animals,
  (select count(*) from public.milk_records m where m.owner_id = p.id) as milk_records,
  (select count(*) from public.health_records h where h.owner_id = p.id) as health_records,
  (select count(*) from public.feed_inventory f where f.owner_id = p.id) as inventory_items,
  (select count(*) from public.farm_tasks t where t.owner_id = p.id) as tasks
from public.profiles p
where p.id = (select id from auth.users where lower(email) = 'vanshgargvlcontact@gmail.com');

commit;
