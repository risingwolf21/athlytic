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

/** A Body Battery change caused by an activity, sleep or stress. */
export interface BodyBatteryEvent {
  /** `activity`, `sleep`, `nap`, `recovery`, ... as reported by the provider. */
  type: string
  startTime: string | null
  durationS: number | null
  /** Body Battery points gained (positive) or spent (negative). */
  impact: number | null
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
  /** Waking respiration in breaths per minute. */
  respirationAvg: number | null
  respirationMin: number | null
  respirationMax: number | null
  /** Blood oxygen saturation in percent. */
  spo2Avg: number | null
  spo2Min: number | null
  hydrationMl: number | null
  hydrationGoalMl: number | null
  sweatLossMl: number | null
  /** Seconds per stress band. */
  stressRestS: number | null
  stressLowS: number | null
  stressMediumS: number | null
  stressHighS: number | null
  stressActivityS: number | null
  bodyBatteryEndOfDay: number | null
  bodyBatteryEvents: BodyBatteryEvent[] | null
  /** Lower/upper bound of the personal "balanced" HRV range, as computed by the provider. */
  hrvBaselineLow: number | null
  hrvBaselineHigh: number | null
  hrv5MinHigh: number | null
  /** Provider feedback key for the HRV status, e.g. `HRV_BALANCED_3`. */
  hrvFeedback: string | null
  provenance: Provenance
}

export interface SleepScoreFactor {
  /** 0-100. */
  value: number | null
  qualifier: string | null
  optimalStart: number | null
  optimalEnd: number | null
}

/** Sleep need in minutes. */
export interface SleepNeed {
  baselineMin: number | null
  actualMin: number | null
  /** Provider feedback key (training, HRV, history and nap adjustments are folded into `actualMin`). */
  feedback: string | null
  /** Minutes since midnight (can exceed 1440 or be negative for after-midnight times). */
  bedtimeStartMin: number | null
  bedtimeEndMin: number | null
  nextActualMin: number | null
}

export interface SleepNap {
  startTime: string
  endTime: string | null
  durationS: number
  feedback: string | null
}

/** How well the last sleep matched the optimal sleep window. Times are minutes since midnight. */
export interface SleepAlignment {
  status: string | null
  windowStartMin: number | null
  windowEndMin: number | null
  lastMidpointMin: number | null
  windowMidpointMin: number | null
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
  napS: number | null
  awakeCount: number | null
  avgSleepStress: number | null
  avgHr: number | null
  spo2Low: number | null
  spo2High: number | null
  /** Number of readings that fell below the device's SpO2 threshold. */
  spo2Events: number | null
  respirationLow: number | null
  respirationHigh: number | null
  breathingDisruption: string | null
  scoreFeedback: string | null
  scoreInsight: string | null
  /** Score components such as `totalDuration`, `stress`, `awakeCount`, `remPercentage`, `restlessness`, `lightPercentage`, `deepPercentage`. */
  scoreFactors: Record<string, SleepScoreFactor> | null
  need: SleepNeed | null
  naps: SleepNap[] | null
  alignment: SleepAlignment | null
  provenance: Provenance
}

export type IntradayMetric = 'heart_rate' | 'stress' | 'body_battery' | 'hrv' | 'spo2'

/** Intraday series as [epoch seconds, value] pairs. */
export interface IntradaySeries {
  date: string
  metric: IntradayMetric
  points: [number, number][]
  provenance: Provenance
}

/** Curated additional activity metrics; each is present only when the device recorded it. */
export interface ActivityExtra {
  groundContactMs?: number
  strideLengthCm?: number
  verticalOscillationCm?: number
  /** Vertical oscillation relative to stride length, percent. */
  verticalRatioPct?: number
  /** Left share of ground contact time, percent. */
  groundContactBalancePct?: number
  normPowerW?: number
  maxPowerW?: number
  max20MinPowerW?: number
  ftpW?: number
  tss?: number
  intensityFactor?: number
  lactateThresholdBpm?: number
  gradeAdjustedSpeedMs?: number
  impactLoad?: number
  avgStress?: number
  /** End minus start stress level. */
  stressDelta?: number
  bodyBatteryDelta?: number
  avgRespiration?: number
  minRespiration?: number
  maxRespiration?: number
  minTempC?: number
  maxTempC?: number
  minElevationM?: number
  maxElevationM?: number
  steps?: number
  floorsClimbed?: number
  moderateMin?: number
  vigorousMin?: number
  maxCadence?: number
  lapCount?: number
  elapsedS?: number
  strokes?: number
  swolf?: number
  location?: string
  description?: string
  isPr?: boolean
  trainingEffectLabel?: string
  aerobicMessage?: string
  anaerobicMessage?: string
  /** Fastest time in seconds per distance in metres (e.g. `{ "5000": 1480 }`). */
  fastestSplitsS?: Record<string, number>
  /** Best average power in watts per duration in seconds. */
  powerCurveW?: Record<string, number>
  /** Seconds in power zones 1..7. */
  powerZoneS?: number[]
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
  extra: ActivityExtra | null
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

export interface BodyComposition {
  date: string
  measuredAt: string | null
  weightKg: number | null
  bmi: number | null
  bodyFatPct: number | null
  bodyWaterPct: number | null
  muscleMassKg: number | null
  boneMassKg: number | null
  visceralFat: number | null
  physiqueRating: number | null
  metabolicAge: number | null
  provenance: Provenance
}

export interface FitnessAgeComponent {
  value: number | null
  targetValue: number | null
  improvementValue: number | null
  potentialAge: number | null
  priority: number | null
  lastMeasurementDate: string | null
}

export interface FitnessAge {
  date: string
  chronologicalAge: number | null
  fitnessAge: number | null
  achievableFitnessAge: number | null
  previousFitnessAge: number | null
  /** Keys as reported by the provider, e.g. `vo2Max`, `bmi`, `rhr`, `vigorousDaysAvg`. */
  components: Record<string, FitnessAgeComponent> | null
  provenance: Provenance
}

/** Heart rate zone settings of the user for one sport (`DEFAULT` applies to sports without their own). */
export interface HrZoneConfig {
  sport: string
  trainingMethod: string | null
  restingHr: number | null
  lactateThresholdHr: number | null
  maxHr: number | null
  /** Lower bounds (bpm) of zones 1..5. */
  zoneFloors: [number, number, number, number, number]
  provenance: Provenance
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
  body: BodyComposition[]
  fitnessAge: FitnessAge[]
  hrZones: HrZoneConfig[]
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
