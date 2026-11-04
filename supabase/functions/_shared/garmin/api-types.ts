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
  stress?: {
    avgLevel?: number
    maxLevel?: number
    restDurationInMillis?: number
    activityDurationInMillis?: number
    lowStressDurationInMillis?: number
    mediumStressDurationInMillis?: number
    highStressDurationInMillis?: number
  }
  bodyBattery?: {
    minValue?: number
    maxValue?: number
    chargedValue?: number
    drainedValue?: number
    endOfDayValue?: number
    activityEvents?: ApiBodyBatteryActivityEvent[]
  }
  hydration?: { goalInFractionalMl?: number; goalInMl?: number; consumedInFractionalMl?: number }
  respiration?: { avgValue?: number; maxValue?: number; minValue?: number }
  pulseOx?: { avgValue?: number; minValue?: number }
}

export interface ApiBodyBatteryActivityEvent {
  eventType?: string
  eventStartTimeGmt?: GarminTimestamp
  durationInMillis?: number
  bodyBatteryImpact?: number
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
  feedbackPhrase?: string
  baseline?: { lowUpper?: number; balancedLow?: number; balancedUpper?: number; markerValue?: number }
}

export interface ApiHrvDailyResponse {
  hrvSummaries?: ApiHrvSummary[]
}

export interface ApiSleepScoreItem {
  value?: number
  qualifierKey?: string
  optimalStart?: number
  optimalEnd?: number
}

export interface ApiSleepNeed {
  baseline?: number
  actual?: number
  feedback?: string
  recommendedBedtimeStartMins?: number
  recommendedBedtimeEndMins?: number
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
  sleepScores?: Record<string, ApiSleepScoreItem>
  napTimeSeconds?: number
  awakeCount?: number
  avgSleepStress?: number
  avgHeartRate?: number
  lowestSpO2Value?: number
  highestSpO2Value?: number
  numberOfEventsBelowThreshold?: number
  lowestRespirationValue?: number
  highestRespirationValue?: number
  breathingDisruptionSeverity?: string
  sleepScoreFeedback?: string
  sleepScoreInsight?: string
  sleepNeed?: ApiSleepNeed
  nextSleepNeed?: ApiSleepNeed
  dailyNapDTOS?: { napTimeSec?: number; napStartTimestampGMT?: GarminTimestamp; napEndTimestampGMT?: GarminTimestamp; napFeedback?: string }[]
  sleepAlignment?: {
    status?: string
    optimalSleepWindowStartMins?: number
    optimalSleepWindowEndMins?: number
    optimalSleepWindowMidpointMins?: number
    lastSleepMidpointMins?: number
  }
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
  // Extras
  avgGroundContactTime?: number
  avgStrideLength?: number
  avgVerticalOscillation?: number
  avgVerticalRatio?: number
  avgGroundContactBalance?: number
  normPower?: number
  maxPower?: number
  max20MinPower?: number
  maxFtp?: number
  trainingStressScore?: number
  intensityFactor?: number
  lactateThresholdBpm?: number
  avgGradeAdjustedSpeed?: number
  impactLoad?: number
  avgStress?: number
  startStress?: number
  endStress?: number
  differenceBodyBattery?: number
  avgRespirationRate?: number
  minRespirationRate?: number
  maxRespirationRate?: number
  minTemperature?: number
  maxTemperature?: number
  minElevation?: number
  maxElevation?: number
  steps?: number
  floorsClimbed?: number
  moderateIntensityMinutes?: number
  vigorousIntensityMinutes?: number
  maxRunningCadenceInStepsPerMinute?: number
  lapCount?: number
  elapsedDuration?: number
  strokes?: number
  averageSwolf?: number
  locationName?: string
  description?: string
  isPR?: boolean
  trainingEffectLabel?: string
  aerobicTrainingEffectMessage?: string
  anaerobicTrainingEffectMessage?: string
  [key: `fastestSplit_${number}`]: number | undefined
  [key: `maxAvgPower_${number}`]: number | undefined
  [key: `powerTimeInZone_${number}`]: number | undefined
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

export interface ApiWeightEntry {
  calendarDate?: string
  date?: GarminTimestamp
  timestampGMT?: GarminTimestamp
  /** Kilograms per the spec; some responses use grams. */
  weight?: number
  bmi?: number
  bodyFat?: number
  bodyWater?: number
  boneMass?: number
  muscleMass?: number
  physiqueRating?: number
  visceralFat?: number
  metabolicAge?: number
}

export interface ApiWeightRange {
  dailyWeightSummaries?: { summaryDate?: string; latestWeight?: ApiWeightEntry }[]
}

export interface ApiHydrationDay {
  calendarDate?: string
  valueInML?: number
  goalInML?: number
  sweatLossInML?: number
}

export interface ApiFitnessAge {
  chronologicalAge?: number
  fitnessAge?: number
  achievableFitnessAge?: number
  previousFitnessAge?: number
  components?: Record<
    string,
    { value?: number; targetValue?: number; improvementValue?: number; potentialAge?: number; priority?: number; lastMeasurementDate?: string }
  >
  lastUpdated?: GarminTimestamp
  invalidReason?: string
}

export interface ApiHeartRateZones {
  trainingMethod?: string
  restingHeartRateUsed?: number
  lactateThresholdHeartRateUsed?: number
  zone1Floor?: number
  zone2Floor?: number
  zone3Floor?: number
  zone4Floor?: number
  zone5Floor?: number
  maxHeartRateUsed?: number
  sport?: string
}

export interface ApiHrvChart {
  hrvReadings?: { hrvValue?: number; readingTimeGMT?: GarminTimestamp }[]
}

export interface ApiSpo2Day {
  calendarDate?: string
  spO2SingleValuesDescriptorList?: { spo2ValueDescriptorIndex?: number; spo2ValueDescriptorKey?: string }[]
  spO2SingleValues?: (number | string | null)[][] | null
}
