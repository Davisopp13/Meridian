-- Meridian PiP Bar — Initial Schema
-- Run this in the Supabase SQL Editor to set up all tables, RLS, and seed data.

-- ============================================================
-- Tables
-- ============================================================

create table if not exists case_sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users not null,
  case_number    text not null,
  started_at     timestamptz default now(),
  ended_at       timestamptz,
  duration_s     int,
  status         text default 'active',   -- 'active' | 'awaiting' | 'closed'
  awaiting_since timestamptz
);

create table if not exists case_events (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid references case_sessions not null,
  user_id    uuid references auth.users not null,
  type       text not null,               -- 'resolved' | 'reclassified' | 'call' | 'rfc' | 'not_a_case'
  excluded   boolean default false,       -- true for not_a_case — omit from productivity metrics
  rfc        boolean default false,
  timestamp  timestamptz default now()
);

create table if not exists process_sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users not null,
  category   text not null,
  subcategory text,
  started_at timestamptz default now(),
  ended_at   timestamptz,
  duration_s int,
  logged_at  timestamptz default now(),
  entry_mode text default 'timer'         -- 'timer' | 'manual'
);

create table if not exists process_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  team       text not null,              -- 'CH' | 'MH' | 'BOTH'
  sort_order int default 0,
  active     boolean default true
);

create table if not exists bar_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references auth.users not null,
  started_at       timestamptz default now(),
  ended_at         timestamptz,
  total_cases      int default 0,
  total_processes  int default 0
);

-- ============================================================
-- RLS — user tables (users can only read/write their own rows)
-- ============================================================

alter table case_sessions    enable row level security;
alter table case_events      enable row level security;
alter table process_sessions enable row level security;
alter table bar_sessions     enable row level security;

create policy "own rows only" on case_sessions
  for all using (user_id = auth.uid());

create policy "own rows only" on case_events
  for all using (user_id = auth.uid());

create policy "own rows only" on process_sessions
  for all using (user_id = auth.uid());

create policy "own rows only" on bar_sessions
  for all using (user_id = auth.uid());

-- ============================================================
-- RLS — process_categories (read-only for all authenticated users)
-- ============================================================

alter table process_categories enable row level security;

create policy "read only for authenticated" on process_categories
  for select using (auth.uid() is not null);

-- ============================================================
-- Seed data — process_categories
-- ============================================================

insert into process_categories (name, team, sort_order) values
  -- CH
  ('Documentation',    'CH', 1),
  ('Booking Amendment','CH', 2),
  ('Rate Inquiry',     'CH', 3),
  ('Routing Change',   'CH', 4),
  ('Equipment Issue',  'CH', 5),
  ('Customs Hold',     'CH', 6),
  ('Port Delay',       'CH', 7),
  ('Invoice Dispute',  'CH', 8),
  -- MH
  ('Pre-Advice',         'MH', 1),
  ('Delivery Order',     'MH', 2),
  ('Inland Transport',   'MH', 3),
  ('Storage Billing',    'MH', 4),
  ('Container Release',  'MH', 5),
  ('Demurrage Query',    'MH', 6),
  ('Free Time Request',  'MH', 7),
  ('Terminal Issue',     'MH', 8)
on conflict do nothing;
