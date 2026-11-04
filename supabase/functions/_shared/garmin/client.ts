import { addDays, daysBetween, todayInBerlin } from '../dates.ts'
import type {
  ApiActivitySummary,
  ApiBodyBatteryReport,
  ApiDailyHeartRate,
  ApiDailySleep,
  ApiDailySummariesResponse,
  ApiDailySummaryV2,
  ApiFitnessAge,
  ApiHeartRateZones,
  ApiHrvChart,
  ApiHrvDailyResponse,
  ApiHydrationDay,
  ApiSpo2Day,
  ApiSummarizedActivity,
  ApiUserSettings,
  ApiWeightEntry,
} from './api-types.ts'
import { decodeActivityFile } from './fit.ts'
import {
  applyHydration,
  heartRateOffsets,
  mapActivity,
  mapActivityDetails,
  mapBodyBattery,
  mapDailySummary,
  mapFitDetails,
  mapFitnessAge,
  mapHeartRateZones,
  mapHrv,
  mapHrvReadings,
  mapSleep,
  mapSpo2Readings,
  mapWeight,
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
/** Intraday heart rate, HRV and SpO2 need one request per day and metric, so only recent days are fetched. */
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

type RawSink = (resourceType: string, externalId: string, calendarDate: string | null, body: unknown) => void

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
    const payload: GarminRangePayload = { dailies: [], stressDetails: [], sleeps: [], hrv: [], userMetrics: [], activities: [], weights: [], fitnessAge: [], hrZones: [], intradayExtra: [], raw: [] }
    for (let start = from; daysBetween(start, to) >= 0; start = addDays(start, WINDOW_DAYS)) {
      const end = addDays(start, WINDOW_DAYS - 1) > to ? to : addDays(start, WINDOW_DAYS - 1)
      await this.fetchWindow(start, end, payload)
    }
    await this.addProfileData(to, payload)
    return payload
  }

  async fetchActivityDetails(summaryId: string): Promise<GarminActivityDetails | null> {
    let summary: ApiActivitySummary
    try {
      summary = await this.get<ApiActivitySummary>(`activity-service/activity/${encodeURIComponent(summaryId)}`)
    } catch (error) {
      if (error instanceof GarminApiError && error.status === 404) return null
      throw error
    }
    const fallback = mapActivityDetails(summary)
    try {
      const file = await this.getBytes(`download-service/files/activity/${encodeURIComponent(summaryId)}`)
      const fit = await decodeActivityFile(file)
      if (fit.records.length) return { ...mapFitDetails(fit, summaryId, summary.activityTypeDTO?.typeKey), splits: fallback.splits }
    } catch (error) {
      // No file (e.g. manual activity) or an undecodable one: keep the lap aggregates from the summary.
      if (error instanceof GarminApiError && (error.status === 401 || error.status === 429)) throw error
    }
    return fallback
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

    await this.addHydration(start, end, payload, raw)
    await this.addWeights(start, end, payload, raw)
    await this.addIntradayHeartRate(start, end, payload, raw)
    await this.addRecentIntraday(start, end, payload, raw)
  }

  /** Heart rate zone settings and Fitness Age are not tied to a date window; they are refreshed with every slice. */
  private async addProfileData(to: string, payload: GarminRangePayload): Promise<void> {
    const raw = (resourceType: string, externalId: string, body: unknown) => payload.raw!.push({ resourceType, externalId, calendarDate: null, payload: body })
    const zones = await this.soft<ApiHeartRateZones[]>('biometric-service/heartRateZones/v2')
    for (const z of zones ?? []) {
      const mapped = mapHeartRateZones(z)
      if (!mapped) continue
      raw('hr_zones', `hrzones:${mapped.sport}`, z)
      payload.hrZones.push(mapped)
    }
    const ages = await this.soft<ApiFitnessAge[]>(`fitnessage-service/fitnessage/v2/${to}`, { fullHistoryScan: 'true' })
    for (const a of ages ?? []) {
      const mapped = mapFitnessAge(a, to)
      if (!mapped) continue
      raw('fitness_age', `fitnessage:${mapped.calendarDate}`, a)
      payload.fitnessAge.push(mapped)
    }
  }

  private async addHydration(start: string, end: string, payload: GarminRangePayload, raw: RawSink): Promise<void> {
    const days = await this.soft<ApiHydrationDay[]>(`usersummary-service/stats/hydration/daily/${start}/${end}`)
    const byDate = new Map(payload.dailies.map((d) => [d.calendarDate, d]))
    for (const h of days ?? []) {
      const daily = h.calendarDate ? byDate.get(h.calendarDate) : undefined
      if (!daily || !h.calendarDate) continue
      raw('hydration', `hydration:${h.calendarDate}`, h.calendarDate, h)
      applyHydration(daily, h)
    }
  }

  private async addWeights(start: string, end: string, payload: GarminRangePayload, raw: RawSink): Promise<void> {
    const entries = await this.soft<ApiWeightEntry[]>(`weight-service/weight/all/${start}/${end}`)
    const latestByDate = new Map<string, ReturnType<typeof mapWeight>>()
    for (const entry of [...(entries ?? [])].sort((a, b) => String(a.timestampGMT ?? '').localeCompare(String(b.timestampGMT ?? '')))) {
      const mapped = mapWeight(entry)
      if (!mapped) continue
      raw('weight', `weight:${mapped.calendarDate}`, mapped.calendarDate, entry)
      latestByDate.set(mapped.calendarDate, mapped)
    }
    for (const w of latestByDate.values()) if (w) payload.weights.push(w)
  }

  private async addRecentIntraday(start: string, end: string, payload: GarminRangePayload, raw: RawSink): Promise<void> {
    const oldest = addDays(todayInBerlin(this.now()), -(INTRADAY_HEART_RATE_DAYS - 1))
    for (const daily of payload.dailies) {
      if (daily.calendarDate < start || daily.calendarDate > end || daily.calendarDate < oldest) continue
      const [hrvChart, spo2] = await Promise.all([
        this.soft<ApiHrvChart>(`hrv-service/hrv/${daily.calendarDate}`),
        this.soft<ApiSpo2Day>(`wellness-service/wellness/daily/spo2acclimation/${daily.calendarDate}`),
      ])
      const hrvSeries = hrvChart ? mapHrvReadings(daily.calendarDate, hrvChart) : null
      if (hrvSeries) {
        raw('hrv_readings', `hrvreadings:${daily.calendarDate}`, daily.calendarDate, hrvChart)
        payload.intradayExtra.push(hrvSeries)
      }
      const spo2Series = spo2 ? mapSpo2Readings(daily.calendarDate, spo2) : null
      if (spo2Series) {
        raw('spo2', `spo2:${daily.calendarDate}`, daily.calendarDate, spo2)
        payload.intradayExtra.push(spo2Series)
      }
    }
  }

  private async addIntradayHeartRate(
    start: string,
    end: string,
    payload: GarminRangePayload,
    raw: RawSink,
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

  private async request(path: string, params: Record<string, string>, accept: string): Promise<Response> {
    const url = this.url(path)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    for (let attempt = 0; ; attempt++) {
      const token = await this.currentToken(attempt > 0)
      const res = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${token}`, Accept: accept } })
      if (res.status === 401 && attempt === 0) continue
      if (!res.ok) {
        const retry = Number(res.headers.get('retry-after'))
        throw new GarminApiError(`Garmin API ${res.status} for ${path}`, res.status, Number.isFinite(retry) && retry > 0 ? retry : null)
      }
      return res
    }
  }

  private async get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const text = await (await this.request(path, params, 'application/json')).text()
    return (text ? JSON.parse(text) : null) as T
  }

  /** Optional endpoints: a failure (unsupported device, missing permission, bad body) must not abort the import. */
  private async soft<T>(path: string, params: Record<string, string> = {}): Promise<T | undefined> {
    try {
      return (await this.get<T>(path, params)) ?? undefined
    } catch (error) {
      if (error instanceof GarminApiError && (error.status === 401 || error.status === 429)) throw error
      return undefined
    }
  }

  private async getBytes(path: string): Promise<Uint8Array> {
    return new Uint8Array(await (await this.request(path, {}, '*/*')).arrayBuffer())
  }
}
