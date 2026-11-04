/**
 * Raw payload shapes of the Garmin Connect API, modelled on the documented Health/Activity API
 * field names. Only fields Athlytic uses are listed. These types never leave the Garmin adapter.
 *
 * NOTE: Field names follow the public Health API documentation. They have NOT yet been verified
 * against a live Personal API response (no API key available yet) — see docs/GARMIN.md.
 */

export interface GarminDaily {
  summaryId: string
  calendarDate: string
  startTimeInSeconds: number
  startTimeOffsetInSeconds: number
  durationInSeconds: number
  steps?: number
  stepsGoal?: number
  distanceInMeters?: number
  floorsClimbed?: number
  activeKilocalories?: number
  bmrKilocalories?: number
  moderateIntensityDurationInSeconds?: number
  vigorousIntensityDurationInSeconds?: number
  minHeartRateInBeatsPerMinute?: number
  maxHeartRateInBeatsPerMinute?: number
  restingHeartRateInBeatsPerMinute?: number
  averageStressLevel?: number
  maxStressLevel?: number
  bodyBatteryChargedValue?: number
  bodyBatteryDrainedValue?: number
  bodyBatteryHighestValue?: number
  bodyBatteryLowestValue?: number
  /** Offset in seconds from `startTimeInSeconds` → bpm. */
  timeOffsetHeartRateSamples?: Record<string, number>
}

export interface GarminStressDetails {
  summaryId: string
  calendarDate: string
  startTimeInSeconds: number
  durationInSeconds: number
  timeOffsetStressLevelValues?: Record<string, number>
  timeOffsetBodyBatteryValues?: Record<string, number>
}

export interface GarminSleep {
  summaryId: string
  calendarDate: string
  startTimeInSeconds: number
  startTimeOffsetInSeconds: number
  durationInSeconds: number
  deepSleepDurationInSeconds?: number
  lightSleepDurationInSeconds?: number
  remSleepInSeconds?: number
  awakeDurationInSeconds?: number
  overallSleepScore?: { value: number; qualifierKey?: string }
  avgRespirationBreathsPerMinute?: number
  avgSpo2Percent?: number
}

export interface GarminHrv {
  summaryId: string
  calendarDate: string
  lastNightAvg?: number
  lastNight5MinHigh?: number
  weeklyAvg?: number
  status?: 'BALANCED' | 'UNBALANCED' | 'LOW' | 'POOR'
}

export interface GarminUserMetrics {
  summaryId: string
  calendarDate: string
  vo2Max?: number
}

export interface GarminActivity {
  summaryId: string
  activityId: number
  activityName?: string
  activityType: string
  startTimeInSeconds: number
  startTimeOffsetInSeconds: number
  durationInSeconds: number
  movingDurationInSeconds?: number
  distanceInMeters?: number
  averageSpeedInMetersPerSecond?: number
  maxSpeedInMetersPerSecond?: number
  averageHeartRateInBeatsPerMinute?: number
  maxHeartRateInBeatsPerMinute?: number
  averageBikeCadenceInRoundsPerMinute?: number
  averageRunCadenceInStepsPerMinute?: number
  averagePowerInWatts?: number
  totalElevationGainInMeters?: number
  totalElevationLossInMeters?: number
  activeKilocalories?: number
  aerobicTrainingEffect?: number
  anaerobicTrainingEffect?: number
  activityTrainingLoad?: number
  timeInHeartRateZonesInSeconds?: number[]
  startingLatitudeInDegree?: number
  startingLongitudeInDegree?: number
}

export interface GarminActivitySample {
  startTimeInSeconds: number
  latitudeInDegree?: number
  longitudeInDegree?: number
  elevationInMeters?: number
  heartRateInBeatsPerMinute?: number
  speedMetersPerSecond?: number
  bikeCadenceInRPM?: number
  stepsPerMinute?: number
  totalDistanceInMeters?: number
}

export interface GarminActivityDetails {
  summaryId: string
  samples: GarminActivitySample[]
  laps: { startTimeInSeconds: number }[]
}

export interface GarminRangePayload {
  dailies: GarminDaily[]
  stressDetails: GarminStressDetails[]
  sleeps: GarminSleep[]
  hrv: GarminHrv[]
  userMetrics: GarminUserMetrics[]
  activities: GarminActivity[]
}

export interface GarminClient {
  /** Verifies credentials; returns the provider-side user id. */
  ping(): Promise<{ userId: string }>
  /** All summaries whose calendar day lies in [from, to] (inclusive). */
  fetchRange(from: string, to: string): Promise<GarminRangePayload>
  fetchActivityDetails(summaryId: string): Promise<GarminActivityDetails | null>
}

export class GarminApiError extends Error {
  readonly status: number
  readonly retryAfterSeconds: number | null

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message)
    this.name = 'GarminApiError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}
