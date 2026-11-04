import { addDays, daysBetween, parseDate } from '../dates.ts'
import {
  GarminApiError,
  type GarminActivityDetails,
  type GarminClient,
  type GarminRangePayload,
} from './types.ts'

export interface HttpGarminClientOptions {
  baseUrl: string
  /** Personal API key from Garmin Connect (never shipped to the browser bundle). It is exchanged for short-lived access tokens. */
  apiKey: string
  fetchImpl?: typeof fetch
}

/** Garmin pull endpoints accept at most a 24h upload-time window per request. */
const WINDOW_DAYS = 1

const TOKEN_PATH = 'personalapitoken-service/personal-api/personal-api-key/token'
const TOKEN_FIELDS = ['access_token', 'accessToken', 'token', 'id_token'] as const

const RESOURCES = {
  dailies: 'dailies',
  stressDetails: 'stressDetails',
  sleeps: 'sleeps',
  hrv: 'hrv',
  userMetrics: 'userMetrics',
  activities: 'activities',
} as const

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

/**
 * Pull client for the Garmin Connect Personal API. The personal API key is exchanged for an access token
 * (`POST …/personal-api-key/token`, `Authorization: ApiKey <key>`), which is then sent as a Bearer token.
 * Data endpoint paths are modelled on the Health/Activity API documentation and must be verified against
 * a real account (see docs/GARMIN.md).
 */
export class HttpGarminClient implements GarminClient {
  private readonly fetchImpl: typeof fetch
  private readonly options: HttpGarminClientOptions
  private accessToken: { value: string; expiresAt: number } | null = null

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

  private async get<T>(path: string, params: Record<string, string>): Promise<T> {
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
      return (await res.json()) as T
    }
  }
}
