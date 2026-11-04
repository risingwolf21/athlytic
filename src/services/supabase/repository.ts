import { FunctionsHttpError } from '@supabase/supabase-js'
import type { ActivityDetail, NormalizedBundle, SyncStatus, UserProfile } from '@shared/domain.ts'
import { todayInBerlin, addDays } from '@shared/dates.ts'
import { getSupabase } from './client.ts'
import { connectionRowSchema, toActivity, toBody, toDaily, toDetail, toFitnessAge, toHrZone, toIntraday, toProfile, toSleep } from './rows.ts'
import type { FitnessRepository } from '../data/repository.ts'

const PAGE = 1000
const INTRADAY_DAYS = 14

type RowFilter = { column: string; op: 'is-null' } | { column: string; op: 'gte'; value: string }

async function fetchAll(table: string, orderBy: string, filter?: RowFilter): Promise<unknown[]> {
  const supabase = getSupabase()
  const rows: unknown[] = []
  for (let from = 0; ; from += PAGE) {
    const base = supabase.from(table).select('*')
    const filtered = !filter ? base : filter.op === 'is-null' ? base.is(filter.column, null) : base.gte(filter.column, filter.value)
    const { data, error } = await filtered.order(orderBy, { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE) return rows
  }
}

/** Tables from newer migrations: a missing table (migration not applied yet) must not take the whole app down. */
async function fetchOptional(table: string, orderBy: string): Promise<unknown[]> {
  try {
    return await fetchAll(table, orderBy)
  } catch {
    return []
  }
}

async function functionError(error: unknown): Promise<Error> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string }
      if (body.error) return new Error(body.error)
    } catch {
      /* fall through to the generic message */
    }
  }
  return error instanceof Error ? error : new Error('Request failed')
}

async function invoke<T>(name: string, body?: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke<T>(name, body ? { body } : {})
  if (error) throw await functionError(error)
  return data as T
}

async function userId(): Promise<string> {
  const { data, error } = await getSupabase().auth.getUser()
  if (error || !data.user) throw new Error('Not signed in')
  return data.user.id
}

export function createSupabaseRepository(): FitnessRepository {
  return {
    mode: 'supabase',

    async loadBundle(): Promise<NormalizedBundle> {
      const intradayFrom = addDays(todayInBerlin(), -(INTRADAY_DAYS - 1))
      const [daily, sleep, activities, intraday, body, fitnessAge, hrZones] = await Promise.all([
        fetchAll('daily_metrics', 'date'),
        fetchAll('sleep_sessions', 'date'),
        fetchAll('activities', 'start_time', { column: 'duplicate_of', op: 'is-null' }),
        fetchAll('intraday_samples', 'date', { column: 'date', op: 'gte', value: intradayFrom }),
        fetchOptional('body_composition', 'date'),
        fetchOptional('fitness_age', 'date'),
        fetchOptional('hr_zone_configs', 'sport'),
      ])
      return {
        daily: daily.map(toDaily),
        sleep: sleep.map(toSleep),
        activities: activities.map(toActivity),
        intraday: intraday.map(toIntraday),
        body: body.map(toBody),
        fitnessAge: fitnessAge.map(toFitnessAge),
        hrZones: hrZones.map(toHrZone),
      }
    },

    async loadProfile(): Promise<UserProfile> {
      const { data, error } = await getSupabase().from('profiles').select('*').single()
      if (error) throw new Error(error.message)
      return toProfile(data)
    },

    async saveProfile(profile) {
      const { error } = await getSupabase()
        .from('profiles')
        .update({ display_name: profile.displayName, birth_year: profile.birthYear, max_hr: profile.maxHr, resting_hr_override: profile.restingHrOverride, step_goal: profile.stepGoal, locale: profile.locale })
        .eq('user_id', await userId())
      if (error) throw new Error(error.message)
    },

    async loadActivityDetail(activityId): Promise<ActivityDetail | null> {
      const supabase = getSupabase()
      const [activityRes, detailRes, notesRes] = await Promise.all([
        supabase.from('activities').select('*').eq('id', activityId).maybeSingle(),
        supabase.from('activity_details').select('laps, samples').eq('activity_id', activityId).maybeSingle(),
        supabase.from('activity_user_data').select('notes').eq('activity_id', activityId).maybeSingle(),
      ])
      if (activityRes.error) throw new Error(activityRes.error.message)
      if (!activityRes.data) return null
      const activity = { ...toActivity(activityRes.data), notes: (notesRes.data as { notes: string | null } | null)?.notes ?? null }
      const stored = detailRes.data as { samples?: { t?: unknown[] } | null } | null
      if (stored && stored.samples?.t?.length) return toDetail(activity, detailRes.data as Parameters<typeof toDetail>[1])

      // Details are fetched lazily from the provider on first open, then stored. Rows without samples
      // (stored before track import existed, or for activities without a file) are retried on open.
      try {
        await invoke('garmin-sync', { kind: 'activity-detail', activityId })
      } catch (error) {
        if (!stored) throw error
      }
      const retry = await supabase.from('activity_details').select('laps, samples').eq('activity_id', activityId).maybeSingle()
      const row = retry.data ?? detailRes.data
      return row ? toDetail(activity, row) : null
    },

    async saveActivityNotes(activityId, notes) {
      const { error } = await getSupabase().from('activity_user_data').upsert({ activity_id: activityId, user_id: await userId(), notes })
      if (error) throw new Error(error.message)
    },

    async loadSyncStatus(): Promise<SyncStatus> {
      const { data, error } = await getSupabase().from('provider_connections').select('status, sync_state, last_error, last_synced_at, history_start').eq('provider', 'garmin').maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return { provider: 'garmin', connected: false, lastSyncedAt: null, historyStart: null, state: 'idle', error: null }
      const row = connectionRowSchema.parse(data)
      return { provider: 'garmin', connected: row.status !== 'disconnected', lastSyncedAt: row.last_synced_at, historyStart: row.history_start, state: row.sync_state, error: row.last_error }
    },

    async connectGarmin(token) {
      await invoke('garmin-connect', { token })
    },

    async disconnectGarmin() {
      await invoke('garmin-disconnect')
    },

    async sync(kind) {
      return invoke<{ done: boolean }>('garmin-sync', { kind })
    },
  }
}
