/**
 * Provider-independent normalized domain model.
 *
 * This file is dependency-free on purpose: it is imported by the browser app
 * (via the `@shared` alias) and by Supabase Edge Functions (Deno).
 * Dates are ISO strings; `date` fields are local calendar days (YYYY-MM-DD).
 */

export type ProviderId =
  | 'garmin'
  | 'apple_health'
  | 'health_connect'
  | 'fit_import'
  | 'csv_import'

export const SPORTS = [
  'hiking',
  'cycling',
  'running',
  'walking',
  'swimming',
  'strength',
  'other',
] as const
export type Sport = (typeof SPORTS)[number]

export type HrvStatus = 'balanced' | 'unbalanced' | 'low' | 'poor'

/** Where a record came from and when it was fetched. */
export interface Provenance {
  source: ProviderId
  /** Id of the record at the provider, when it has one. */
  externalId: string | null
  fetchedAt: string
}

/** Values reported by the device/provider. Anything not listed here is calculated in `src/analytics`. */
export interface DailyMetrics {
  date: string
  steps: number | null
  stepGoal: number | null
  distanceM: number | null
  floorsClimbed: number | null
  activeKcal: number | null
  totalKcal: number | null
  intensityMinutes: number | null
  restingHr: number | null
  minHr: number | null
  maxHr: number | null
  avgStress: number | null
  maxStress: number | null
  bodyBatteryHigh: number | null
  bodyBatteryLow: number | null
  bodyBatteryCharged: number | null
  bodyBatteryDrained: number | null
  hrvLastNightAvg: number | null
  hrvWeeklyAvg: number | null
  hrvStatus: HrvStatus | null
  vo2Max: number | null
  provenance: Provenance
}

export interface SleepSession {
  date: string
  startTime: string
  endTime: string
  durationS: number
  deepS: number | null
  lightS: number | null
  remS: number | null
  awakeS: number | null
  score: number | null
  avgRespiration: number | null
  avgSpo2: number | null
  provenance: Provenance
}

export type IntradayMetric = 'heart_rate' | 'stress' | 'body_battery'

/** Intraday series as [epoch seconds, value] pairs. */
export interface IntradaySeries {
  date: string
  metric: IntradayMetric
  points: [number, number][]
  provenance: Provenance
}

export interface Activity {
  id: string
  sport: Sport
  subSport: string | null
  name: string
  startTime: string
  durationS: number
  movingS: number | null
  distanceM: number | null
  elevationGainM: number | null
  elevationLossM: number | null
  avgSpeedMs: number | null
  maxSpeedMs: number | null
  avgHr: number | null
  maxHr: number | null
  avgCadence: number | null
  avgPowerW: number | null
  calories: number | null
  aerobicTe: number | null
  anaerobicTe: number | null
  /** Provider-reported training load (e.g. Garmin EPOC-based load). */
  trainingLoad: number | null
  /** Seconds spent in HR zones 1..5. */
  hrZoneSeconds: [number, number, number, number, number] | null
  startLat: number | null
  startLng: number | null
  notes: string | null
  provenance: Provenance
}

export interface ActivityLap {
  index: number
  startOffsetS: number
  durationS: number
  distanceM: number | null
  avgSpeedMs: number | null
  avgHr: number | null
  avgCadence: number | null
  elevationGainM: number | null
}

/** Column-oriented samples; all arrays have the same length. `null` marks a missing sample. */
export interface ActivitySamples {
  /** Seconds since activity start. */
  t: number[]
  lat: (number | null)[]
  lng: (number | null)[]
  elevation: (number | null)[]
  hr: (number | null)[]
  speed: (number | null)[]
  cadence: (number | null)[]
  distance: (number | null)[]
}

export interface ActivityDetail {
  activity: Activity
  laps: ActivityLap[]
  samples: ActivitySamples
}

export interface UserProfile {
  displayName: string
  birthYear: number | null
  maxHr: number
  restingHrOverride: number | null
  stepGoal: number
  locale: string
}

export const DEFAULT_PROFILE: UserProfile = {
  displayName: '',
  birthYear: null,
  maxHr: 190,
  restingHrOverride: null,
  stepGoal: 10000,
  locale: 'de',
}

/** Everything the analytics module needs, already normalized. */
export interface NormalizedBundle {
  daily: DailyMetrics[]
  sleep: SleepSession[]
  intraday: IntradaySeries[]
  activities: Activity[]
}

export type SyncKind = 'historical' | 'incremental'

export interface SyncStatus {
  provider: ProviderId
  connected: boolean
  lastSyncedAt: string | null
  /** Oldest day that has been imported so far. */
  historyStart: string | null
  state: 'idle' | 'running' | 'error'
  error: string | null
}
