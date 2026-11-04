-- Athlytic: normalized, provider-independent schema.
-- Conventions: every user-owned table carries user_id and is protected by RLS.
-- Data tables are written by Edge Functions (service role); users only write their own profile and notes.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  birth_year smallint check (birth_year between 1900 and 2100),
  max_hr smallint not null default 190 check (max_hr between 120 and 230),
  resting_hr_override smallint check (resting_hr_override between 25 and 120),
  step_goal integer not null default 10000 check (step_goal > 0),
  locale text not null default 'de',
  timezone text not null default 'Europe/Berlin',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ------------------------------------------------------ provider connections
create table public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('garmin', 'apple_health', 'health_connect', 'fit_import', 'csv_import')),
  status text not null default 'connected' check (status in ('connected', 'error', 'disconnected')),
  external_user_id text,
  sync_state text not null default 'idle' check (sync_state in ('idle', 'running', 'error')),
  last_error text,
  last_synced_at timestamptz,
  -- Oldest day imported so far; the historical import walks backwards from today towards history_target.
  history_start date,
  history_target date,
  cursor jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);
create trigger provider_connections_updated_at before update on public.provider_connections for each row execute function public.set_updated_at();

-- Encrypted provider secrets. RLS is enabled without any policy and all client privileges are revoked:
-- only the service role used inside Edge Functions can read or write this table.
create table public.provider_credentials (
  connection_id uuid primary key references public.provider_connections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  ciphertext text not null,
  iv text not null,
  key_version smallint not null default 1,
  created_at timestamptz not null default now()
);
alter table public.provider_credentials enable row level security;
revoke all on public.provider_credentials from anon, authenticated;

create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.provider_connections (id) on delete cascade,
  kind text not null check (kind in ('historical', 'incremental')),
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  range_from date,
  range_to date,
  stats jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index sync_runs_connection_idx on public.sync_runs (connection_id, started_at desc);

-- Original provider responses, kept so normalization can be re-run without calling the provider again.
create table public.raw_payloads (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.provider_connections (id) on delete cascade,
  provider text not null,
  resource_type text not null,
  external_id text not null,
  calendar_date date,
  payload jsonb not null,
  payload_hash text not null,
  fetched_at timestamptz not null default now(),
  unique (connection_id, resource_type, external_id, payload_hash)
);
create index raw_payloads_lookup_idx on public.raw_payloads (user_id, resource_type, calendar_date);

-- ---------------------------------------------------------------- daily data
create table public.daily_metrics (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  steps integer,
  step_goal integer,
  distance_m integer,
  floors_climbed integer,
  active_kcal integer,
  total_kcal integer,
  intensity_minutes integer,
  resting_hr smallint,
  min_hr smallint,
  max_hr smallint,
  avg_stress smallint,
  max_stress smallint,
  body_battery_high smallint,
  body_battery_low smallint,
  body_battery_charged smallint,
  body_battery_drained smallint,
  hrv_last_night_avg real,
  hrv_weekly_avg real,
  hrv_status text check (hrv_status in ('balanced', 'unbalanced', 'low', 'poor')),
  vo2_max real,
  source text not null,
  external_id text,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
create trigger daily_metrics_updated_at before update on public.daily_metrics for each row execute function public.set_updated_at();

create table public.sleep_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_s integer not null,
  deep_s integer,
  light_s integer,
  rem_s integer,
  awake_s integer,
  score smallint,
  avg_respiration real,
  avg_spo2 real,
  source text not null,
  external_id text,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
create trigger sleep_sessions_updated_at before update on public.sleep_sessions for each row execute function public.set_updated_at();

-- One row per day and metric; points is a JSON array of [epoch_seconds, value].
create table public.intraday_samples (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  metric text not null check (metric in ('heart_rate', 'stress', 'body_battery')),
  points jsonb not null,
  source text not null,
  fetched_at timestamptz not null,
  primary key (user_id, date, metric)
);

-- ---------------------------------------------------------------- activities
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null,
  external_id text not null,
  sport text not null check (sport in ('hiking', 'cycling', 'running', 'walking', 'swimming', 'strength', 'other')),
  sub_sport text,
  name text not null,
  start_time timestamptz not null,
  duration_s integer not null,
  moving_s integer,
  distance_m real,
  elevation_gain_m real,
  elevation_loss_m real,
  avg_speed_ms real,
  max_speed_ms real,
  avg_hr smallint,
  max_hr smallint,
  avg_cadence real,
  avg_power_w real,
  calories integer,
  aerobic_te real,
  anaerobic_te real,
  training_load real,
  hr_zone_seconds integer[],
  start_lat double precision,
  start_lng double precision,
  -- Set when another source recorded the same workout; the duplicate is kept but hidden from lists.
  duplicate_of uuid references public.activities (id) on delete set null,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);
create index activities_user_start_idx on public.activities (user_id, start_time desc);
create trigger activities_updated_at before update on public.activities for each row execute function public.set_updated_at();

create table public.activity_details (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  laps jsonb not null default '[]'::jsonb,
  -- Column-oriented samples: { t: [], lat: [], lng: [], elevation: [], hr: [], speed: [], cadence: [], distance: [] }
  samples jsonb not null,
  fetched_at timestamptz not null default now()
);

-- User-authored data lives apart from provider data so a re-sync can never overwrite it.
create table public.activity_user_data (
  activity_id uuid primary key references public.activities (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  notes text,
  updated_at timestamptz not null default now()
);
create trigger activity_user_data_updated_at before update on public.activity_user_data for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ row level security
do $$
declare t text;
begin
  foreach t in array array['provider_connections', 'sync_runs', 'raw_payloads', 'daily_metrics', 'sleep_sessions', 'intraday_samples', 'activities', 'activity_details', 'activity_user_data', 'profiles']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Read-only for users (written by Edge Functions with the service role).
create policy "own rows readable" on public.provider_connections for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows readable" on public.sync_runs for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows readable" on public.daily_metrics for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows readable" on public.sleep_sessions for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows readable" on public.intraday_samples for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows readable" on public.activities for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows readable" on public.activity_details for select to authenticated using (user_id = (select auth.uid()));

-- Writable by the owner.
create policy "own profile readable" on public.profiles for select to authenticated using (user_id = (select auth.uid()));
create policy "own profile updatable" on public.profiles for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own notes readable" on public.activity_user_data for select to authenticated using (user_id = (select auth.uid()));
create policy "own notes insertable" on public.activity_user_data for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.activities a where a.id = activity_id and a.user_id = (select auth.uid())));
create policy "own notes updatable" on public.activity_user_data for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Raw payloads are only needed server-side: RLS on, no policy, no client privileges.
revoke all on public.raw_payloads from anon, authenticated;
revoke all on all tables in schema public from anon;
