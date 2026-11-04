import type {
  ApiActivitySummary,
  ApiBodyBatteryReport,
  ApiDailyHeartRate,
  ApiDailySleep,
  ApiDailySummaryV2,
  ApiHrvSummary,
  ApiSplitSummary,
  ApiSummarizedActivity,
  GarminTimestamp,
} from './api-types.ts'
import type {
  GarminActivity,
  GarminActivityDetails,
  GarminDaily,
  GarminHrv,
  GarminSleep,
  GarminSplit,
  GarminStressDetails,
} from './types.ts'

/** Maps Garmin Connect Personal API responses to the adapter's intermediate payloads. Pure functions, no I/O. */

const ZONE_SUFFIX = /(Z|[+-]\d\d:?\d\d)$/i

/** Epoch seconds from the different timestamp encodings Garmin uses; zone-less strings are UTC. */
export function toEpochSeconds(value: GarminTimestamp | undefined): number | null {
  if (value == null) return null
  if (typeof value === 'object') return toEpochSeconds(value.date ?? null)
  if (typeof value === 'number') return Number.isFinite(value) ? Math.floor(value > 1e11 ? value / 1000 : value) : null
  const text = value.trim()
  if (/^\d+(\.\d+)?$/.test(text)) return toEpochSeconds(Number(text))
  const isoLike = text.replace(' ', 'T')
  const ms = Date.parse(ZONE_SUFFIX.test(isoLike) ? isoLike : `${isoLike}Z`)
  return Number.isNaN(ms) ? null : Math.floor(ms / 1000)
}

const finite = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const minutesToSeconds = (v: number | undefined) => (v == null ? undefined : v * 60)

function dayStartEpoch(calendarDate: string): number {
  return Math.floor(Date.parse(`${calendarDate}T00:00:00Z`) / 1000)
}

export function mapDailySummary(d: ApiDailySummaryV2): GarminDaily {
  const startGmt = toEpochSeconds(d.wellnessChronology?.startTimestampGmt)
  const startLocal = toEpochSeconds(d.wellnessChronology?.startTimestampLocal)
  const durationMs = finite(d.wellnessChronology?.totalDurationInMillis)
  return {
    summaryId: `daily:${d.calendarDate}`,
    calendarDate: d.calendarDate,
    startTimeInSeconds: startGmt ?? dayStartEpoch(d.calendarDate),
    startTimeOffsetInSeconds: startGmt != null && startLocal != null ? startLocal - startGmt : 0,
    durationInSeconds: durationMs != null ? Math.round(durationMs / 1000) : 86_400,
    steps: finite(d.movement?.steps?.value),
    stepsGoal: finite(d.movement?.steps?.goal),
    distanceInMeters: finite(d.movement?.steps?.distanceInMeters),
    floorsClimbed: finite(d.movement?.floorsAscended?.value),
    activeKilocalories: finite(d.calories?.burnedActive),
    bmrKilocalories: finite(d.calories?.burnedResting),
    moderateIntensityDurationInSeconds: minutesToSeconds(finite(d.intensityMinutes?.moderate)),
    vigorousIntensityDurationInSeconds: minutesToSeconds(finite(d.intensityMinutes?.vigorous)),
    minHeartRateInBeatsPerMinute: finite(d.heartRate?.minValue),
    maxHeartRateInBeatsPerMinute: finite(d.heartRate?.maxValue),
    restingHeartRateInBeatsPerMinute: finite(d.heartRate?.restingValue),
    averageStressLevel: finite(d.stress?.avgLevel),
    maxStressLevel: finite(d.stress?.maxLevel),
    bodyBatteryChargedValue: finite(d.bodyBattery?.chargedValue),
    bodyBatteryDrainedValue: finite(d.bodyBattery?.drainedValue),
    bodyBatteryHighestValue: finite(d.bodyBattery?.maxValue),
    bodyBatteryLowestValue: finite(d.bodyBattery?.minValue),
  }
}

const HRV_STATUS = new Set(['BALANCED', 'UNBALANCED', 'LOW', 'POOR'])

export function mapHrv(h: ApiHrvSummary): GarminHrv {
  const status = h.status?.toUpperCase()
  return {
    summaryId: `hrv:${h.calendarDate}`,
    calendarDate: h.calendarDate,
    lastNightAvg: finite(h.lastNightAvg),
    lastNight5MinHigh: finite(h.lastNight5MinHigh),
    weeklyAvg: finite(h.weeklyAvg),
    status: status && HRV_STATUS.has(status) ? (status as GarminHrv['status']) : undefined,
  }
}

function overallSleepScore(scores: ApiDailySleep['sleepScores']): GarminSleep['overallSleepScore'] {
  if (!scores) return undefined
  const key = Object.keys(scores).find((k) => k.toLowerCase() === 'overall') ?? Object.keys(scores).find((k) => /overall/i.test(k))
  const item = key ? scores[key] : undefined
  const value = finite(item?.value)
  return value == null ? undefined : { value, qualifierKey: item?.qualifierKey }
}

/** Returns null for days without a measured sleep session (Garmin still returns an empty DTO for them). */
export function mapSleep(s: ApiDailySleep): GarminSleep | null {
  const start = toEpochSeconds(s.sleepStartTimestampGMT)
  const duration = finite(s.sleepTimeSeconds)
  if (start == null || !duration || duration <= 0) return null
  const startLocal = toEpochSeconds(s.sleepStartTimestampLocal)
  return {
    summaryId: `sleep:${s.calendarDate}`,
    calendarDate: s.calendarDate,
    startTimeInSeconds: start,
    startTimeOffsetInSeconds: startLocal != null ? startLocal - start : 0,
    durationInSeconds: duration,
    deepSleepDurationInSeconds: finite(s.deepSleepSeconds),
    lightSleepDurationInSeconds: finite(s.lightSleepSeconds),
    remSleepInSeconds: finite(s.remSleepSeconds),
    awakeDurationInSeconds: finite(s.awakeSleepSeconds),
    overallSleepScore: overallSleepScore(s.sleepScores),
    avgRespirationBreathsPerMinute: finite(s.averageRespirationValue),
    avgSpo2Percent: finite(s.averageSpO2Value),
  }
}

/** Intraday heart rate as offsets (seconds) from `baseEpoch`. */
export function heartRateOffsets(dto: ApiDailyHeartRate, baseEpoch: number): Record<string, number> | undefined {
  const rows = dto.heartRateValues
  if (!rows?.length) return undefined
  const column = (key: string, fallback: number) => dto.heartRateValueDescriptors?.find((d) => d.key.toLowerCase() === key)?.index ?? fallback
  const timeIndex = column('timestamp', 0)
  const bpmIndex = column('heartrate', 1)
  const offsets: Record<string, number> = {}
  for (const row of rows) {
    const at = toEpochSeconds(row[timeIndex])
    const bpm = finite(row[bpmIndex])
    if (at != null && bpm != null) offsets[String(at - baseEpoch)] = bpm
  }
  return Object.keys(offsets).length ? offsets : undefined
}

/** Intraday Body Battery levels, carried in the intermediate `stressDetails` shape (offsets from the first reading). */
export function mapBodyBattery(report: ApiBodyBatteryReport): GarminStressDetails | null {
  const rows = report.bodyBatteryValuesArray
  if (!report.date || !rows?.length) return null
  const column = (pattern: RegExp, fallback: number) =>
    report.bodyBatteryValueDescriptorDTOList?.find((d) => pattern.test(d.bodyBatteryValueDescriptorKey))?.bodyBatteryValueDescriptorIndex ?? fallback
  const timeIndex = column(/timestamp/i, 0)
  const levelIndex = column(/level/i, 2)
  const points: [number, number][] = []
  for (const row of rows) {
    const at = toEpochSeconds(row[timeIndex] as GarminTimestamp)
    const level = finite(row[levelIndex])
    if (at != null && level != null) points.push([at, level])
  }
  if (!points.length) return null
  points.sort((a, b) => a[0] - b[0])
  const base = points[0]![0]
  return {
    summaryId: `bodybattery:${report.date}`,
    calendarDate: report.date,
    startTimeInSeconds: base,
    durationInSeconds: points[points.length - 1]![0] - base,
    timeOffsetBodyBatteryValues: Object.fromEntries(points.map(([at, level]) => [String(at - base), level])),
  }
}

export function mapActivity(a: ApiSummarizedActivity): GarminActivity | null {
  const start = toEpochSeconds(a.startTimeGMT)
  if (start == null || a.duration == null) return null
  const startLocal = toEpochSeconds(a.startTimeLocal)
  const zones = [a.hrTimeInZone_1, a.hrTimeInZone_2, a.hrTimeInZone_3, a.hrTimeInZone_4, a.hrTimeInZone_5]
  const calories = finite(a.calories)
  const bmr = finite(a.bmrCalories)
  return {
    summaryId: String(a.activityId),
    activityId: a.activityId,
    activityName: a.activityName,
    activityType: (a.activityType?.typeKey ?? 'other').toUpperCase(),
    startTimeInSeconds: start,
    startTimeOffsetInSeconds: startLocal != null ? startLocal - start : 0,
    durationInSeconds: a.duration,
    movingDurationInSeconds: finite(a.movingDuration),
    distanceInMeters: finite(a.distance),
    averageSpeedInMetersPerSecond: finite(a.averageSpeed),
    maxSpeedInMetersPerSecond: finite(a.maxSpeed),
    averageHeartRateInBeatsPerMinute: finite(a.averageHR),
    maxHeartRateInBeatsPerMinute: finite(a.maxHR),
    averageBikeCadenceInRoundsPerMinute: finite(a.averageBikingCadenceInRevPerMinute),
    averageRunCadenceInStepsPerMinute: finite(a.averageRunningCadenceInStepsPerMinute),
    averagePowerInWatts: finite(a.avgPower),
    totalElevationGainInMeters: finite(a.elevationGain),
    totalElevationLossInMeters: finite(a.elevationLoss),
    activeKilocalories: calories != null ? (bmr != null && calories >= bmr ? calories - bmr : calories) : undefined,
    aerobicTrainingEffect: finite(a.aerobicTrainingEffect),
    anaerobicTrainingEffect: finite(a.anaerobicTrainingEffect),
    activityTrainingLoad: finite(a.activityTrainingLoad),
    timeInHeartRateZonesInSeconds: zones.every((z) => finite(z) != null) ? (zones as number[]) : undefined,
    startingLatitudeInDegree: finite(a.startLatitude),
    startingLongitudeInDegree: finite(a.startLongitude),
  }
}

/** Split types that correspond to laps in Garmin Connect, in order of preference. */
const LAP_TYPE_GROUPS: RegExp[] = [/^(INTERVAL_|RUN_|RWD_|WORKOUT_ROUND|ROUND_)/, /^MARKER_(KILOMETER|MILE)$/, /^MARKER_MANUAL$/]

function selectLapSplits(splits: ApiSplitSummary[]): ApiSplitSummary[] {
  const single = splits.filter((s) => (s.noOfSplits ?? 1) <= 1 && s.splitType)
  for (const group of LAP_TYPE_GROUPS) {
    const match = single.filter((s) => group.test(s.splitType!))
    if (match.length) return match
  }
  return []
}

function mapSplit(s: ApiSplitSummary): GarminSplit | null {
  const start = toEpochSeconds(s.startTimeGMT)
  if (start == null || s.duration == null) return null
  return {
    startTimeInSeconds: start,
    durationInSeconds: s.duration,
    distanceInMeters: finite(s.distance),
    averageSpeedInMetersPerSecond: finite(s.averageSpeed),
    averageHeartRateInBeatsPerMinute: finite(s.averageHR),
    averageCadence: finite(s.averageRunCadence) ?? finite(s.maxBikeCadence),
    elevationGainInMeters: finite(s.elevationGain),
  }
}

/** The Personal API exposes no per-second samples as JSON (only the original FIT file), so details carry lap aggregates only. */
export function mapActivityDetails(a: ApiActivitySummary): GarminActivityDetails {
  const splits = selectLapSplits(a.splitSummaries ?? [])
    .map(mapSplit)
    .filter((s): s is GarminSplit => s !== null)
    .sort((x, y) => x.startTimeInSeconds - y.startTimeInSeconds)
  return { summaryId: String(a.activityId), samples: [], laps: [], splits }
}
