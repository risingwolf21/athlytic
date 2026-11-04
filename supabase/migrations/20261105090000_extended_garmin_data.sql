-- Extended Garmin data: respiration, SpO2, hydration, stress breakdown, HRV baseline, detailed sleep,
-- activity extras, body composition, fitness age and heart rate zone settings.

-- ---------------------------------------------------------------- daily metrics
alter table public.daily_metrics
  add column respiration_avg real,
  add column respiration_min real,
  add column respiration_max real,
  add column spo2_avg real,
  add column spo2_min real,
  add column hydration_ml integer,
  add column hydration_goal_ml integer,
  add column sweat_loss_ml integer,
  add column stress_rest_s integer,
  add column stress_low_s integer,
  add column stress_medium_s integer,
  add column stress_high_s integer,
  add column stress_activity_s integer,
  add column body_battery_end_of_day smallint,
  add column body_battery_events jsonb,
  add column hrv_baseline_low real,
  add column hrv_baseline_high real,
  add column hrv_5min_high real,
  add column hrv_feedback text;

-- ---------------------------------------------------------------- sleep
alter table public.sleep_sessions
  add column nap_s integer,
  add column awake_count smallint,
  add column avg_sleep_stress real,
  add column avg_hr real,
  add column spo2_low real,
  add column spo2_high real,
  add column spo2_events smallint,
  add column respiration_low real,
  add column respiration_high real,
  add column breathing_disruption text,
  add column score_feedback text,
  add column score_insight text,
  add column score_factors jsonb,
  add column need jsonb,
  add column naps jsonb,
  add column alignment jsonb;

-- ---------------------------------------------------------------- intraday series
alter table public.intraday_samples drop constraint intraday_samples_metric_check;
alter table public.intraday_samples
  add constraint intraday_samples_metric_check check (metric in ('heart_rate', 'stress', 'body_battery', 'hrv', 'spo2'));

-- ---------------------------------------------------------------- activities
-- Curated per-activity extras (running dynamics, power, stress, fastest splits, ...) as one JSON object.
alter table public.activities add column extra jsonb;

-- ---------------------------------------------------------------- body composition
create table public.body_composition (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  measured_at timestamptz,
  weight_kg real,
  bmi real,
  body_fat_pct real,
  body_water_pct real,
  muscle_mass_kg real,
  bone_mass_kg real,
  visceral_fat real,
  physique_rating real,
  metabolic_age real,
  source text not null,
  external_id text,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
create trigger body_composition_updated_at before update on public.body_composition for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- fitness age
create table public.fitness_age (
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  chronological_age real,
  fitness_age real,
  achievable_fitness_age real,
  previous_fitness_age real,
  components jsonb,
  source text not null,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
create trigger fitness_age_updated_at before update on public.fitness_age for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- heart rate zone settings
create table public.hr_zone_configs (
  user_id uuid not null references auth.users (id) on delete cascade,
  sport text not null,
  training_method text,
  resting_hr smallint,
  lactate_threshold_hr smallint,
  max_hr smallint,
  zone_floors smallint[] not null,
  source text not null,
  fetched_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, sport)
);
create trigger hr_zone_configs_updated_at before update on public.hr_zone_configs for each row execute function public.set_updated_at();

-- ------------------------------------------------------------ row level security
alter table public.body_composition enable row level security;
alter table public.fitness_age enable row level security;
alter table public.hr_zone_configs enable row level security;

create policy "own rows readable" on public.body_composition for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows readable" on public.fitness_age for select to authenticated using (user_id = (select auth.uid()));
create policy "own rows readable" on public.hr_zone_configs for select to authenticated using (user_id = (select auth.uid()));
