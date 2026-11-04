import { addDays, daysBetween, todayInBerlin } from '../dates.ts'
import type { Activity, NormalizedBundle, SyncKind } from '../domain.ts'
import { dedupeActivities, isDuplicateActivity, mergeDaily } from '../merge.ts'
import { GarminApiError } from '../garmin/types.ts'
import { PROVIDER_PRIORITY, type DataProvider, type RawRecord } from '../provider.ts'
import type { Db } from './context.ts'
import { sha256Hex } from './crypto.ts'
import { HttpError } from './http.ts'
import { providerForConnection } from './provider-factory.ts'
import { activityFromRow, activityToRow, dailyFromRow, dailyToRow, detailToRow, intradayToRow, sleepToRow, type Row } from './rows.ts'

/** Days fetched per provider request batch; also the unit of progress for the resumable import. */
const CHUNK_DAYS = 30
/** Stay well below the Edge Function wall-clock limit; the client keeps calling until `done`. */
const TIME_BUDGET_MS = 20_000
/** Default depth of the historical import. */
const HISTORY_DAYS = 730
/** Re-fetch this many days before the last sync because providers finalize summaries late. */
const INCREMENTAL_OVERLAP_DAYS = 3
const STALE_LOCK_MS = 5 * 60_000

interface Connection {
  id: string
  user_id: string
  history_start: string | null
  history_target: string | null
  cursor: { nextTo?: string } | null
  last_synced_at: string | null
  sync_state: string
  updated_at: string
}

export async function getConnection(db: Db, userId: string): Promise<Connection> {
  const { data, error } = await db.from('provider_connections').select('*').eq('user_id', userId).eq('provider', 'garmin').maybeSingle()
  if (error) throw new Error(error.message)
  if (!data || data.status === 'disconnected') throw new HttpError(409, 'Garmin is not connected')
  return data as Connection
}

const chunk = <T>(items: T[], size: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

async function must<T>(result: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await result
  if (error) throw new Error(error.message)
  return data
}

async function storeRaw(db: Db, userId: string, connectionId: string, records: RawRecord[]): Promise<void> {
  const rows: Row[] = []
  for (const r of records) {
    const payload = JSON.stringify(r.payload)
    rows.push({
      user_id: userId,
      connection_id: connectionId,
      provider: 'garmin',
      resource_type: r.resourceType,
      external_id: r.externalId,
      calendar_date: r.calendarDate,
      payload: r.payload,
      payload_hash: await sha256Hex(payload),
    })
  }
  for (const part of chunk(rows, 100)) {
    // Identical payloads are ignored; a changed summary is kept as an additional version.
    await must(db.from('raw_payloads').upsert(part, { onConflict: 'connection_id,resource_type,external_id,payload_hash', ignoreDuplicates: true }))
  }
}

async function persistDaily(db: Db, userId: string, bundle: NormalizedBundle): Promise<number> {
  if (!bundle.daily.length) return 0
  const dates = bundle.daily.map((d) => d.date)
  const existing = new Map<string, ReturnType<typeof dailyFromRow>>()
  for (const part of chunk(dates, 200)) {
    const rows = await must(db.from('daily_metrics').select('*').eq('user_id', userId).in('date', part))
    for (const row of (rows ?? []) as Row[]) existing.set(row.date as string, dailyFromRow(row))
  }
  const merged = bundle.daily.map((d) => dailyToRow(userId, mergeDaily(existing.get(d.date), d)))
  for (const part of chunk(merged, 200)) await must(db.from('daily_metrics').upsert(part, { onConflict: 'user_id,date' }))
  return merged.length
}

async function persistSleep(db: Db, userId: string, bundle: NormalizedBundle): Promise<number> {
  if (!bundle.sleep.length) return 0
  const dates = bundle.sleep.map((s) => s.date)
  const priority = new Map<string, number>()
  for (const part of chunk(dates, 200)) {
    const rows = await must(db.from('sleep_sessions').select('date, source').eq('user_id', userId).in('date', part))
    for (const row of (rows ?? []) as { date: string; source: keyof typeof PROVIDER_PRIORITY }[]) priority.set(row.date, PROVIDER_PRIORITY[row.source] ?? 0)
  }
  const rows = bundle.sleep.filter((s) => (priority.get(s.date) ?? -1) <= PROVIDER_PRIORITY[s.provenance.source]).map((s) => sleepToRow(userId, s))
  for (const part of chunk(rows, 200)) await must(db.from('sleep_sessions').upsert(part, { onConflict: 'user_id,date' }))
  return rows.length
}

async function persistIntraday(db: Db, userId: string, bundle: NormalizedBundle): Promise<void> {
  const rows = bundle.intraday.map((s) => intradayToRow(userId, s))
  for (const part of chunk(rows, 50)) await must(db.from('intraday_samples').upsert(part, { onConflict: 'user_id,date,metric' }))
}

/** Marks workouts recorded by more than one source as duplicates of the best record. */
async function resolveDuplicates(db: Db, userId: string, activities: Activity[]): Promise<void> {
  if (!activities.length) return
  const times = activities.map((a) => Date.parse(a.startTime))
  const from = new Date(Math.min(...times) - 86_400_000).toISOString()
  const to = new Date(Math.max(...times) + 2 * 86_400_000).toISOString()
  const rows = (await must(db.from('activities').select('*').eq('user_id', userId).gte('start_time', from).lte('start_time', to))) as Row[]
  const all = rows.map(activityFromRow)
  const currentDuplicateOf = new Map(rows.map((r) => [r.id as string, (r.duplicate_of as string | null) ?? null]))
  const kept = dedupeActivities(all)
  const keptIds = new Set(kept.map((k) => k.id))
  for (const activity of all) {
    const target = keptIds.has(activity.id) ? null : (kept.find((k) => isDuplicateActivity(k, activity))?.id ?? null)
    if ((currentDuplicateOf.get(activity.id) ?? null) !== target) {
      await must(db.from('activities').update({ duplicate_of: target }).eq('id', activity.id).eq('user_id', userId))
    }
  }
}

async function persistActivities(db: Db, userId: string, bundle: NormalizedBundle): Promise<number> {
  if (!bundle.activities.length) return 0
  const rows = bundle.activities.map((a) => activityToRow(userId, a))
  for (const part of chunk(rows, 100)) await must(db.from('activities').upsert(part, { onConflict: 'user_id,source,external_id' }))
  await resolveDuplicates(db, userId, bundle.activities)
  return rows.length
}

interface SliceResult {
  days: number
  daily: number
  sleep: number
  activities: number
  oldestData: string | null
}

async function importRange(db: Db, userId: string, connectionId: string, provider: DataProvider, from: string, to: string): Promise<SliceResult> {
  const raw: RawRecord[] = []
  const bundle = await provider.fetchRange(from, to, (records) => raw.push(...records))
  await storeRaw(db, userId, connectionId, raw)
  const [daily, sleep, activities] = await Promise.all([persistDaily(db, userId, bundle), persistSleep(db, userId, bundle), persistActivities(db, userId, bundle)])
  await persistIntraday(db, userId, bundle)
  const dates = [...bundle.daily.map((d) => d.date), ...bundle.sleep.map((s) => s.date)].sort()
  return { days: daysBetween(from, to) + 1, daily, sleep, activities, oldestData: dates[0] ?? null }
}

async function acquireLock(db: Db, connection: Connection): Promise<void> {
  const stale = new Date(Date.now() - STALE_LOCK_MS).toISOString()
  const { data, error } = await db
    .from('provider_connections')
    .update({ sync_state: 'running', last_error: null })
    .eq('id', connection.id)
    .or(`sync_state.neq.running,updated_at.lt.${stale}`)
    .select('id')
  if (error) throw new Error(error.message)
  if (!data?.length) throw new HttpError(409, 'A sync is already running')
}

function describeError(error: unknown): string {
  if (error instanceof GarminApiError) {
    if (error.status === 401 || error.status === 403) return 'Garmin rejected the stored token. Reconnect Garmin in the settings.'
    if (error.status === 429) return 'Garmin rate limit reached. Try again in a few minutes.'
    return `Garmin API error (${error.status}).`
  }
  return error instanceof Error ? error.message : 'Unknown error'
}

/**
 * Runs one time-boxed slice of a sync. The historical import walks backwards from today in chunks and resumes
 * from the stored cursor; the incremental sync re-fetches the days since the last successful sync.
 * Returns `done: false` when the client should call again.
 */
export async function runSync(db: Db, userId: string, kind: SyncKind): Promise<{ done: boolean }> {
  const connection = await getConnection(db, userId)
  await acquireLock(db, connection)
  const { data: run } = await db
    .from('sync_runs')
    .insert({ user_id: userId, connection_id: connection.id, kind, status: 'running' })
    .select('id')
    .single()
  const stats: Record<string, number> = { days: 0, daily: 0, sleep: 0, activities: 0 }
  const started = Date.now()
  const today = todayInBerlin()
  let done = false
  let rangeFrom: string | null = null
  let rangeTo: string | null = null

  try {
    const provider = await providerForConnection(db, connection.id)
    const update: Record<string, unknown> = {}
    let historyStart = connection.history_start

    if (kind === 'historical') {
      const target = connection.history_target ?? addDays(today, -HISTORY_DAYS)
      update.history_target = target
      let to = connection.cursor?.nextTo ?? today
      rangeTo = to
      while (daysBetween(target, to) >= 0) {
        if (Date.now() - started > TIME_BUDGET_MS) break
        const from = addDays(to, -(CHUNK_DAYS - 1)) < target ? target : addDays(to, -(CHUNK_DAYS - 1))
        const slice = await importRange(db, userId, connection.id, provider, from, to)
        for (const key of Object.keys(stats)) stats[key] = (stats[key] ?? 0) + (slice[key as keyof SliceResult] as number)
        if (slice.oldestData && (!historyStart || slice.oldestData < historyStart)) historyStart = slice.oldestData
        rangeFrom = from
        to = addDays(from, -1)
        await must(db.from('provider_connections').update({ cursor: { nextTo: to }, history_start: historyStart }).eq('id', connection.id))
      }
      done = daysBetween(target, to) < 0
      update.history_start = historyStart
      if (done) {
        // A finished import resets the cursor so a later "import history" starts again from today.
        update.cursor = {}
        if (!connection.last_synced_at) update.last_synced_at = new Date().toISOString()
      }
    } else {
      const from = connection.last_synced_at ? addDays(connection.last_synced_at.slice(0, 10), -INCREMENTAL_OVERLAP_DAYS) : addDays(today, -7)
      rangeFrom = from
      rangeTo = today
      for (let start = from; daysBetween(start, today) >= 0; start = addDays(start, CHUNK_DAYS)) {
        const end = addDays(start, CHUNK_DAYS - 1) > today ? today : addDays(start, CHUNK_DAYS - 1)
        const slice = await importRange(db, userId, connection.id, provider, start, end)
        for (const key of Object.keys(stats)) stats[key] = (stats[key] ?? 0) + (slice[key as keyof SliceResult] as number)
        if (slice.oldestData && (!historyStart || slice.oldestData < historyStart)) historyStart = slice.oldestData
      }
      update.history_start = historyStart
      update.last_synced_at = new Date().toISOString()
      done = true
    }

    await must(db.from('provider_connections').update({ ...update, sync_state: 'idle', last_error: null, status: 'connected' }).eq('id', connection.id))
    if (run) {
      await db.from('sync_runs').update({ status: 'succeeded', stats, range_from: rangeFrom, range_to: rangeTo, finished_at: new Date().toISOString() }).eq('id', run.id)
    }
    return { done }
  } catch (error) {
    const message = describeError(error)
    const authFailure = error instanceof GarminApiError && (error.status === 401 || error.status === 403)
    await db
      .from('provider_connections')
      .update({ sync_state: 'error', last_error: message, ...(authFailure ? { status: 'error' } : {}) })
      .eq('id', connection.id)
    if (run) await db.from('sync_runs').update({ status: 'failed', stats, error: message, finished_at: new Date().toISOString() }).eq('id', run.id)
    throw error instanceof HttpError ? error : new HttpError(502, message)
  }
}

/** Fetches laps and GPS samples for a single activity on first open and stores them. */
export async function syncActivityDetail(db: Db, userId: string, activityId: string): Promise<{ stored: boolean }> {
  const row = await must(db.from('activities').select('*').eq('id', activityId).eq('user_id', userId).maybeSingle())
  if (!row) throw new HttpError(404, 'Activity not found')
  const activity = activityFromRow(row as Row)
  const connection = await getConnection(db, userId)
  const provider = await providerForConnection(db, connection.id)
  try {
    const detail = await provider.fetchActivityDetail(activity)
    if (!detail) return { stored: false }
    await must(db.from('activity_details').upsert(detailToRow(userId, activityId, detail), { onConflict: 'activity_id' }))
    return { stored: true }
  } catch (error) {
    throw new HttpError(502, describeError(error))
  }
}
