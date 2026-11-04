import { addDays, daysBetween, todayInBerlin } from '../dates.ts'
import type {
  ApiActivitySummary,
  ApiBodyBatteryReport,
  ApiDailyHeartRate,
  ApiDailySleep,
  ApiDailySummariesResponse,
  ApiDailySummaryV2,
  ApiHrvDailyResponse,
  ApiSummarizedActivity,
  ApiUserSettings,
} from './api-types.ts'
import {
  heartRateOffsets,
  mapActivity,
  mapActivityDetails,
  mapBodyBattery,
  mapDailySummary,
  mapHrv,
  mapSleep,
} from './map.ts'
import {
  GarminApiError,
  type GarminActivityDetails,
  type GarminClient,
  type GarminRangePayload,
  type GarminRawRecord,
} from './types.ts'

export interface HttpGarminClientOptions {
  baseUrl: string
  /** Personal API key from Garmin Connect (never shipped to the browser bundle). It is exchanged for short-lived access tokens. */
  apiKey: string
  fetchImpl?: typeof fetch
  now?: () => Date
}

/** Longest date window per request: the sleep and Body Battery endpoints allow 31 days, the steps/stress ones 28. */
const WINDOW_DAYS = 30
/** Intraday heart rate needs one request per day, so only recent days are fetched. */
const INTRADAY_HEART_RATE_DAYS = 7
const ACTIVITY_PAGE_SIZE = 50
const MAX_ACTIVITY_PAGES = 40

const TOKEN_PATH = 'personalapitoken-service/personal-api/personal-api-key/token'
const TOKEN_FIELDS = ['access_token', 'accessToken', 'token', 'id_token'] as const

/** Pulls the access token out of the token endpoint response, which may be JSON or a bare string. */
export function parseTokenResponse(text: string): { token: string; expiresInSeconds: number | null } {
  const trimmed = text.trim()
  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (typeof parsed === 'string') return { token: parsed, expiresInSeconds: null }
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>
      for (const field of TOKEN_FIELDS) {
        const value = record[field]
        if (typeof value === 'string' && value) {
          const expires = Number(record.expires_in ?? record.expiresIn)
          return { token: value, expiresInSeconds: Number.isFinite(expires) && expires > 0 ? expires : null }
        }
      }
    }
  } catch {
    // not JSON: treat the body as the token itself
  }
  return { token: trimmed.replace(/^"|"$/g, ''), expiresInSeconds: null }
}

const byDate = (a: { calendarDate: string }, b: { calendarDate: string }) => a.calendarDate.localeCompare(b.calendarDate)

/**
 * Pull client for the Garmin Connect Personal API (https://developer.garmin.com/gc-developer-program/personal/).
 * The personal API key is exchanged for an access token (`POST …/personal-api-key/token`,
 * `Authorization: ApiKey <key>`), which is then sent as a Bearer token. Response fields follow the
 * official OpenAPI spec; see api-types.ts and map.ts.
 */
export class HttpGarminClient implements GarminClient {
  private readonly fetchImpl: typeof fetch
  private readonly now: () => Date
  private readonly options: HttpGarminClientOptions
  private accessToken: { value: string; expiresAt: number } | null = null

  constructor(options: HttpGarminClientOptions) {
    this.options = options
    this.fetchImpl = options.fetchImpl ?? fetch
    this.now = options.now ?? (() => new Date())
  }

  async ping(): Promise<{ userId: string }> {
    const settings = await this.get<ApiUserSettings>('userprofile-service/userprofile/settings')
    return { userId: settings.displayName?.trim() || 'garmin-user' }
  }

  async fetchRange(from: string, to: string): Promise<GarminRangePayload> {
    const payload: GarminRangePayload = { dailies: [], stressDetails: [], sleeps: [], hrv: [], userMetrics: [], activities: [], raw: [] }
    for (let start = from; daysBetween(start, to) >= 0; start = addDays(start, WINDOW_DAYS)) {
      const end = addDays(start, WINDOW_DAYS - 1) > to ? to : addDays(start, WINDOW_DAYS - 1)
      await this.fetchWindow(start, end, payload)
    }
    return payload
  }

  async fetchActivityDetails(summaryId: string): Promise<GarminActivityDetails | null> {
    try {
      return mapActivityDetails(await this.get<ApiActivitySummary>(`activity-service/activity/${encodeURIComponent(summaryId)}`))
    } catch (error) {
      if (error instanceof GarminApiError && error.status === 404) return null
      throw error
    }
  }

  private async fetchWindow(start: string, end: string, payload: GarminRangePayload): Promise<void> {
    const range = { startDate: start, endDate: end }
    const [summaries, sleeps, hrv, batteryReports, activities] = await Promise.all([
      this.get<ApiDailySummariesResponse>('usersummary-service/v2/dailysummaries', range),
      this.get<ApiDailySleep[]>('sleep-service/sleep/dailySleepSummariesByDate', range),
      this.get<ApiHrvDailyResponse>(`hrv-service/hrv/daily/${start}/${end}`),
      this.get<ApiBodyBatteryReport[]>('wellness-service/wellness/bodyBattery/reports/daily', range),
      this.fetchActivities(start, end),
    ])
    const raw = (resourceType: string, externalId: string, calendarDate: string | null, body: unknown): void => {
      payload.raw!.push({ resourceType, externalId, calendarDate, payload: body } satisfies GarminRawRecord)
    }

    // Garmin may return one summary per source; keep Garmin's own and one per day.
    const dailyByDate = new Map<string, ApiDailySummaryV2>()
    for (const d of summaries?.data ?? []) {
      if (d.source && d.source.toLowerCase() !== 'garmin') continue
      dailyByDate.set(d.calendarDate, d)
    }
    const dailies = [...dailyByDate.values()].map((d) => {
      raw('daily_summary', `daily:${d.calendarDate}`, d.calendarDate, d)
      return mapDailySummary(d)
    })
    payload.dailies.push(...dailies.sort(byDate))

    for (const s of sleeps ?? []) {
      const mapped = mapSleep(s)
      if (!mapped) continue
      raw('sleep', mapped.summaryId, s.calendarDate, s)
      payload.sleeps.push(mapped)
    }
    payload.sleeps.sort(byDate)

    for (const h of hrv?.hrvSummaries ?? []) {
      raw('hrv', `hrv:${h.calendarDate}`, h.calendarDate, h)
      payload.hrv.push(mapHrv(h))
    }

    for (const report of batteryReports ?? []) {
      const mapped = mapBodyBattery(report)
      if (!mapped) continue
      raw('body_battery', mapped.summaryId, mapped.calendarDate, report)
      payload.stressDetails.push(mapped)
    }

    const vo2MaxByDay = new Map<string, { at: number; vo2Max: number }>()
    for (const a of activities) {
      const mapped = mapActivity(a)
      if (!mapped) continue
      const localDay = new Date((mapped.startTimeInSeconds + mapped.startTimeOffsetInSeconds) * 1000).toISOString().slice(0, 10)
      raw('activity', mapped.summaryId, localDay, a)
      payload.activities.push(mapped)
      // The Personal API has no daily VO2max endpoint; use the latest activity-reported value of each day.
      const known = vo2MaxByDay.get(localDay)
      if (a.vO2MaxValue && (!known || known.at < mapped.startTimeInSeconds)) vo2MaxByDay.set(localDay, { at: mapped.startTimeInSeconds, vo2Max: a.vO2MaxValue })
    }
    for (const [calendarDate, { vo2Max }] of vo2MaxByDay) payload.userMetrics.push({ summaryId: `vo2max:${calendarDate}`, calendarDate, vo2Max })

    await this.addIntradayHeartRate(start, end, payload, raw)
  }

  private async addIntradayHeartRate(
    start: string,
    end: string,
    payload: GarminRangePayload,
    raw: (resourceType: string, externalId: string, calendarDate: string | null, body: unknown) => void,
  ): Promise<void> {
    const oldest = addDays(todayInBerlin(this.now()), -(INTRADAY_HEART_RATE_DAYS - 1))
    for (const daily of payload.dailies) {
      if (daily.calendarDate < start || daily.calendarDate > end || daily.calendarDate < oldest) continue
      const body = await this.get<ApiDailyHeartRate>('wellness-service/wellness/dailyHeartRate', { date: daily.calendarDate })
      const offsets = heartRateOffsets(body, daily.startTimeInSeconds)
      if (!offsets) continue
      raw('heart_rate', `heartrate:${daily.calendarDate}`, daily.calendarDate, body)
      daily.timeOffsetHeartRateSamples = offsets
    }
  }

  private async fetchActivities(start: string, end: string): Promise<ApiSummarizedActivity[]> {
    const all: ApiSummarizedActivity[] = []
    for (let page = 0; page < MAX_ACTIVITY_PAGES; page++) {
      const items = await this.get<ApiSummarizedActivity[]>('activitylist-service/activities/search/activities', {
        startDate: start,
        endDate: end,
        sortOrder: 'asc',
        start: String(page * ACTIVITY_PAGE_SIZE),
        limit: String(ACTIVITY_PAGE_SIZE),
      })
      all.push(...(items ?? []))
      if ((items?.length ?? 0) < ACTIVITY_PAGE_SIZE) break
    }
    return all
  }

  private url(path: string): URL {
    return new URL(`${this.options.baseUrl.replace(/\/$/, '')}/${path}`)
  }

  private async obtainAccessToken(): Promise<string> {
    const res = await this.fetchImpl(this.url(TOKEN_PATH), { method: 'POST', headers: { Authorization: `ApiKey ${this.options.apiKey}` } })
    if (!res.ok) throw new GarminApiError(`Garmin token endpoint ${res.status}`, res.status)
    const { token, expiresInSeconds } = parseTokenResponse(await res.text())
    if (!token) throw new GarminApiError('Garmin token endpoint returned no token', 502)
    this.accessToken = { value: token, expiresAt: Date.now() + (expiresInSeconds ?? 300) * 1000 - 30_000 }
    return token
  }

  private async currentToken(forceRefresh: boolean): Promise<string> {
    if (!forceRefresh && this.accessToken && this.accessToken.expiresAt > Date.now()) return this.accessToken.value
    return this.obtainAccessToken()
  }

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = this.url(path)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    for (let attempt = 0; ; attempt++) {
      const token = await this.currentToken(attempt > 0)
      const res = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
      if (res.status === 401 && attempt === 0) continue
      if (!res.ok) {
        const retry = Number(res.headers.get('retry-after'))
        throw new GarminApiError(`Garmin API ${res.status} for ${path}`, res.status, Number.isFinite(retry) && retry > 0 ? retry : null)
      }
      const text = await res.text()
      return (text ? JSON.parse(text) : null) as T
    }
  }
}
