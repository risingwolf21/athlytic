import { addDays, daysBetween, parseDate } from '../dates.ts'
import {
  GarminApiError,
  type GarminActivityDetails,
  type GarminClient,
  type GarminRangePayload,
} from './types.ts'

export interface HttpGarminClientOptions {
  baseUrl: string
  /** Personal API token generated in Garmin Connect (never shipped to the browser bundle). */
  token: string
  fetchImpl?: typeof fetch
}

/** Garmin pull endpoints accept at most a 24h upload-time window per request. */
const WINDOW_DAYS = 1

const RESOURCES = {
  dailies: 'dailies',
  stressDetails: 'stressDetails',
  sleeps: 'sleeps',
  hrv: 'hrv',
  userMetrics: 'userMetrics',
  activities: 'activities',
} as const

/**
 * Pull client for the Garmin Connect API. Endpoint paths and the Bearer auth scheme are modelled on
 * the Health/Activity API documentation and must be verified once a Personal API key is available
 * (see docs/GARMIN.md).
 */
export class HttpGarminClient implements GarminClient {
  private readonly fetchImpl: typeof fetch
  private readonly options: HttpGarminClientOptions

  constructor(options: HttpGarminClientOptions) {
    this.options = options
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  async ping(): Promise<{ userId: string }> {
    const body = await this.get<{ userId: string }>('user/id', {})
    return { userId: String(body.userId) }
  }

  async fetchRange(from: string, to: string): Promise<GarminRangePayload> {
    const payload: GarminRangePayload = { dailies: [], stressDetails: [], sleeps: [], hrv: [], userMetrics: [], activities: [] }
    for (let start = from; daysBetween(start, to) >= 0; start = addDays(start, WINDOW_DAYS)) {
      const startSec = Math.floor(parseDate(start) / 1000)
      const params = { uploadStartTimeInSeconds: String(startSec), uploadEndTimeInSeconds: String(startSec + WINDOW_DAYS * 86_400 - 1) }
      for (const key of Object.keys(RESOURCES) as (keyof typeof RESOURCES)[]) {
        const rows = await this.get<unknown[]>(RESOURCES[key], params)
        ;(payload[key] as unknown[]).push(...rows)
      }
    }
    return payload
  }

  async fetchActivityDetails(summaryId: string): Promise<GarminActivityDetails | null> {
    try {
      return await this.get<GarminActivityDetails>(`activityDetails/${encodeURIComponent(summaryId)}`, {})
    } catch (error) {
      if (error instanceof GarminApiError && error.status === 404) return null
      throw error
    }
  }

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${this.options.baseUrl.replace(/\/$/, '')}/${path}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    const res = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${this.options.token}`, Accept: 'application/json' } })
    if (!res.ok) {
      const retry = Number(res.headers.get('retry-after'))
      throw new GarminApiError(`Garmin API ${res.status} for ${path}`, res.status, Number.isFinite(retry) && retry > 0 ? retry : null)
    }
    return (await res.json()) as T
  }
}
