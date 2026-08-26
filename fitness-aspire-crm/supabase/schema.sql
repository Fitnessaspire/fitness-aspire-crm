-- ============================================================
-- Fitness Aspire — Sales CRM
-- Postgres / Supabase schema
--
-- Run this in Supabase → SQL Editor when you move to Phase 2.
-- Designed relational and integration-ready from the start:
-- external_id / external_source columns exist on the tables that
-- WhatsApp, Meta Ads and Google Ads will eventually write into,
-- so nothing has to be retrofitted later.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type user_role as enum ('admin', 'sales');
create type lead_stage as enum (
  'new','contacted','replied','qualified','trial_offered',
  'trial_booked','trial_completed','proposal','follow_up','won','lost'
);
create type lead_temperature as enum ('hot','warm','cold');
create type appointment_status as enum (
  'booked','confirmed','completed','no_show','cancelled','rescheduled'
);
create type followup_channel as enum ('whatsapp','phone','email','instagram_dm','other');
create type payment_status as enum ('unpaid','deposit_paid','paid_in_full','instalment');

-- ---------- shared audit columns helper ----------
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end $$ language plpgsql;

-- ============================================================
-- PEOPLE
-- ============================================================
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  email       text unique,
  role        user_role not null default 'sales',
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table trainers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- CONFIGURABLE LOOKUPS  (the Settings page writes here —
-- nothing in this list is ever hard-coded in the app)
-- ============================================================
create table lead_sources (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  int  not null default 0,
  active      boolean not null default true
);

create table lost_reasons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  int  not null default 0,
  active      boolean not null default true
);

create table locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  address     text,
  active      boolean not null default true
);

create table packages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sessions    int  not null default 0,
  price_myr   numeric(10,2) not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- MARKETING
-- ============================================================
create table campaigns (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  platform        text not null,
  campaign_type   text,
  start_date      date,
  end_date        date,
  budget_myr      numeric(12,2) not null default 0,
  spend_myr       numeric(12,2) not null default 0,
  -- filled by the Meta / Google / TikTok connectors later:
  external_source text,
  external_id     text,
  created_by      uuid references profiles(id),
  updated_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (external_source, external_id)
);

-- ============================================================
-- LEADS  (the centre of everything)
-- ============================================================
create table leads (
  id                  uuid primary key default gen_random_uuid(),
  reference           text unique,                -- human-facing "L1042"
  full_name           text not null,
  phone               text not null,
  email               text,
  gender              text,
  age                 int,
  home_location       text,
  preferred_location  uuid references locations(id),
  source_id           uuid references lead_sources(id),
  campaign_id         uuid references campaigns(id) on delete set null,
  ad_name             text,
  owner_id            uuid references profiles(id),   -- assigned salesperson
  trainer_id          uuid references trainers(id),
  stage               lead_stage not null default 'new',
  temperature         lead_temperature not null default 'warm',
  fitness_goal        text,
  package_id          uuid references packages(id),
  estimated_value_myr numeric(10,2) not null default 0,
  lost_reason_id      uuid references lost_reasons(id),
  won_at              date,
  -- for the WhatsApp / Meta lead-form connectors:
  external_source     text,
  external_id         text,
  created_by          uuid references profiles(id),
  updated_by          uuid references profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (external_source, external_id)
);

create index on leads (stage);
create index on leads (owner_id);
create index on leads (source_id);
create index on leads (campaign_id);
create index on leads (created_at desc);
create index on leads (temperature) where stage not in ('won','lost');

-- a lead can only be lost WITH a reason (spec section 10)
alter table leads add constraint lost_requires_reason
  check (stage <> 'lost' or lost_reason_id is not null);

-- ============================================================
-- ACTIVITY TIMELINE
-- ============================================================
create table lead_activities (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads(id) on delete cascade,
  activity_date date not null default current_date,
  activity_type text not null,     -- created | message | reply | stage | appointment | deal | won | lost | note
  body          text not null,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now()
);
create index on lead_activities (lead_id, activity_date desc);

-- ============================================================
-- FOLLOW-UPS
-- ============================================================
create table follow_ups (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads(id) on delete cascade,
  owner_id      uuid references profiles(id),
  due_date      date not null,
  due_time      time,
  channel       followup_channel not null default 'whatsapp',
  note          text,
  completed     boolean not null default false,
  completed_at  timestamptz,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on follow_ups (due_date) where completed = false;
create index on follow_ups (lead_id);

-- ============================================================
-- TRIAL APPOINTMENTS
-- ============================================================
create table appointments (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references leads(id) on delete cascade,
  scheduled_date date not null,
  scheduled_time time,
  trainer_id    uuid references trainers(id),
  location_id   uuid references locations(id),
  status        appointment_status not null default 'booked',
  notes         text,
  created_by    uuid references profiles(id),
  updated_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on appointments (scheduled_date);
create index on appointments (lead_id);
create index on appointments (status);

-- ============================================================
-- DEALS  (one lead can be quoted more than once over time)
-- ============================================================
create table deals (
  id                uuid primary key default gen_random_uuid(),
  lead_id           uuid not null references leads(id) on delete cascade,
  package_id        uuid references packages(id),
  package_name      text,
  sessions          int,
  list_price_myr    numeric(10,2) not null default 0,
  discount_myr      numeric(10,2) not null default 0,
  final_price_myr   numeric(10,2) generated always as (list_price_myr - discount_myr) stored,
  deposit_myr       numeric(10,2) not null default 0,
  payment_status    payment_status not null default 'unpaid',
  expected_close    date,
  created_by        uuid references profiles(id),
  updated_by        uuid references profiles(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on deals (lead_id);

-- ============================================================
-- NOTES + NOTIFICATIONS + SETTINGS
-- ============================================================
create table notes (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  body        text not null,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now()
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid references leads(id) on delete cascade,
  user_id     uuid references profiles(id),
  alert_type  text not null,
  priority    int  not null default 2,
  title       text not null,
  detail      text,
  dismissed   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index on notifications (user_id, dismissed, priority);

create table app_settings (
  key         text primary key,
  value       jsonb not null,
  updated_by  uuid references profiles(id),
  updated_at  timestamptz not null default now()
);

-- Bridge table used by src/lib/storage.js so you can move the whole
-- app to the cloud in one step, then migrate table-by-table at leisure.
create table app_state (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);

-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['profiles','packages','campaigns','leads','follow_ups',
                           'appointments','deals','app_settings']
  loop
    execute format(
      'create trigger set_%1$s_updated_at before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;

-- ============================================================
-- ROW LEVEL SECURITY
-- Admin sees everything. Sales works their own leads.
-- ============================================================
alter table profiles        enable row level security;
alter table leads           enable row level security;
alter table lead_activities enable row level security;
alter table follow_ups      enable row level security;
alter table appointments    enable row level security;
alter table deals           enable row level security;
alter table notes           enable row level security;
alter table campaigns       enable row level security;
alter table app_state       enable row level security;

create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and role = 'admin' and active
  );
$$ language sql security definer stable;

-- everyone signed in can read the team list
create policy "read profiles" on profiles
  for select using (auth.uid() is not null);
create policy "admin manages profiles" on profiles
  for all using (is_admin()) with check (is_admin());

-- leads: admin all, sales their own
create policy "read leads" on leads
  for select using (is_admin() or owner_id = auth.uid());
create policy "write leads" on leads
  for all using (is_admin() or owner_id = auth.uid())
  with check (is_admin() or owner_id = auth.uid());

-- child records follow the parent lead's permission
create policy "child activities" on lead_activities for all
  using (exists (select 1 from leads l where l.id = lead_id
                 and (is_admin() or l.owner_id = auth.uid())));
create policy "child followups" on follow_ups for all
  using (exists (select 1 from leads l where l.id = lead_id
                 and (is_admin() or l.owner_id = auth.uid())));
create policy "child appointments" on appointments for all
  using (exists (select 1 from leads l where l.id = lead_id
                 and (is_admin() or l.owner_id = auth.uid())));
create policy "child deals" on deals for all
  using (exists (select 1 from leads l where l.id = lead_id
                 and (is_admin() or l.owner_id = auth.uid())));
create policy "child notes" on notes for all
  using (exists (select 1 from leads l where l.id = lead_id
                 and (is_admin() or l.owner_id = auth.uid())));

-- marketing spend is owner-only information
create policy "read campaigns" on campaigns
  for select using (auth.uid() is not null);
create policy "admin manages campaigns" on campaigns
  for all using (is_admin()) with check (is_admin());

create policy "own app state" on app_state
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ============================================================
-- STARTER DATA
-- ============================================================
insert into lead_sources (name, sort_order) values
  ('Instagram',1),('Facebook',2),('TikTok',3),('Threads',4),('WhatsApp',5),
  ('Website',6),('Referral',7),('Google',8),('Walk-in',9),('Other',10);

insert into lost_reasons (name, sort_order) values
  ('Price',1),('Not ready',2),('No response',3),('Chose another trainer',4),
  ('Location',5),('Timing',6),('Family decision',7),('Not interested',8),
  ('Health issue',9),('Other',10);
