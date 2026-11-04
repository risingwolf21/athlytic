/**
 * Subset of the Garmin Connect Personal API response schemas that Athlytic reads.
 * Names and units follow the official OpenAPI spec
 * (https://developer.garmin.com/gc-developer-program/personal/swagger-docs/).
 * Every field is optional: Garmin omits whatever the device did not record.
 * These types never leave the Garmin adapter.
 */

/** Date-time values arrive as ISO strings (often without offset = UTC), epoch numbers or `{ date }` wrappers. */
export type GarminTimestamp = string | number | { date?: string | number; localDate?: string } | null

export interface ApiMovementValue {
  goal?: number
  value?: number
  distanceInMeters?: number
}

export interface ApiDailySummaryV2 {
  calendarDate: string
  source?: string
  wellnessChronology?: {
    startTimestampGmt?: GarminTimestamp
    startTimestampLocal?: GarminTimestamp
    totalDurationInMillis?: number
  }
  movement?: { steps?: ApiMovementValue; floorsAscended?: ApiMovementValue }
  calories?: { burnedResting?: number; burnedActive?: number; burnedTotal?: number }
  heartRate?: { minValue?: number; maxValue?: number; restingValue?: number }
  intensityMinutes?: { goal?: number; moderate?: number; vigorous?: number }
  stress?: { avgLevel?: number; maxLevel?: number }
  bodyBattery?: { minValue?: number; maxValue?: number; chargedValue?: number; drainedValue?: number }
}

export interface ApiDailySummariesResponse {
  data?: ApiDailySummaryV2[]
}

export interface ApiHrvSummary {
  calendarDate: string
  weeklyAvg?: number
  lastNightAvg?: number
  lastNight5MinHigh?: number
  status?: string
}

export interface ApiHrvDailyResponse {
  hrvSummaries?: ApiHrvSummary[]
}

export interface ApiDailySleep {
  calendarDate: string
  sleepTimeSeconds?: number
  sleepStartTimestampGMT?: GarminTimestamp
  sleepStartTimestampLocal?: GarminTimestamp
  deepSleepSeconds?: number
  lightSleepSeconds?: number
  remSleepSeconds?: number
  awakeSleepSeconds?: number
  averageRespirationValue?: number
  averageSpO2Value?: number
  sleepScores?: Record<string, { value?: number; qualifierKey?: string }>
}

export interface ApiHeartRateValueDescriptor {
  index: number
  key: string
}

export interface ApiDailyHeartRate {
  calendarDate?: unknown
  /** Rows of `[timestamp, bpm]`; the column layout is given by `heartRateValueDescriptors`. */
  heartRateValues?: (number | null)[][] | null
  heartRateValueDescriptors?: ApiHeartRateValueDescriptor[]
}

export interface ApiBodyBatteryReport {
  date?: string
  charged?: number
  drained?: number
  bodyBatteryValuesArray?: (number | string | null)[][] | null
  bodyBatteryValueDescriptorDTOList?: { bodyBatteryValueDescriptorIndex: number; bodyBatteryValueDescriptorKey: string }[]
}

export interface ApiActivityType {
  typeId?: number
  typeKey?: string
}

/** Item of `/activitylist-service/activities/search/activities`. */
export interface ApiSummarizedActivity {
  activityId: number
  activityName?: string
  startTimeLocal?: string
  startTimeGMT?: string
  activityType?: ApiActivityType
  distance?: number
  duration?: number
  movingDuration?: number
  elevationGain?: number
  elevationLoss?: number
  averageSpeed?: number
  maxSpeed?: number
  startLatitude?: number
  startLongitude?: number
  calories?: number
  bmrCalories?: number
  averageHR?: number
  maxHR?: number
  averageRunningCadenceInStepsPerMinute?: number
  averageBikingCadenceInRevPerMinute?: number
  avgPower?: number
  aerobicTrainingEffect?: number
  anaerobicTrainingEffect?: number
  activityTrainingLoad?: number
  vO2MaxValue?: number
  hrTimeInZone_1?: number
  hrTimeInZone_2?: number
  hrTimeInZone_3?: number
  hrTimeInZone_4?: number
  hrTimeInZone_5?: number
}

export interface ApiSplitSummary {
  splitType?: string
  noOfSplits?: number
  startTimeGMT?: GarminTimestamp
  duration?: number
  distance?: number
  averageSpeed?: number
  averageHR?: number
  averageRunCadence?: number
  maxBikeCadence?: number
  elevationGain?: number
}

/** Response of `/activity-service/activity/{activityId}`. */
export interface ApiActivitySummary {
  activityId: number
  activityTypeDTO?: ApiActivityType
  summaryDTO?: { startTimeGMT?: GarminTimestamp }
  splitSummaries?: ApiSplitSummary[]
}

export interface ApiUserSettings {
  displayName?: string
}
