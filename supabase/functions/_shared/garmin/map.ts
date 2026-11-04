import type { ActivityExtra, BodyBatteryEvent, SleepNap, SleepNeed, SleepScoreFactor } from '../domain.ts'
import type {
  ApiActivitySummary,
  ApiBodyBatteryActivityEvent,
  ApiBodyBatteryReport,
  ApiDailyHeartRate,
  ApiDailySleep,
  ApiDailySummaryV2,
  ApiFitnessAge,
  ApiHeartRateZones,
  ApiHrvChart,
  ApiHrvSummary,
  ApiHydrationDay,
  ApiSleepNeed,
  ApiSpo2Day,
  ApiSplitSummary,
  ApiSummarizedActivity,
  ApiWeightEntry,
  GarminTimestamp,
} from './api-types.ts'
import type { FitActivity } from './fit.ts'
import type {
  GarminActivity,
  GarminActivityDetails,
  GarminDaily,
  GarminFitnessAge,
  GarminHrZones,
  GarminHrv,
  GarminIntradaySeries,
  GarminSleep,
  GarminSplit,
  GarminStressDetails,
  GarminWeight,
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
const millisToSeconds = (v: unknown) => {
  const n = finite(v)
  return n == null ? undefined : Math.round(n / 1000)
}
const nonEmpty = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

function dayStartEpoch(calendarDate: string): number {
  return Math.floor(Date.parse(`${calendarDate}T00:00:00Z`) / 1000)
}

function mapBodyBatteryEvents(events: ApiBodyBatteryActivityEvent[] | undefined): BodyBatteryEvent[] | undefined {
  if (!events?.length) return undefined
  const mapped = events.map((e): BodyBatteryEvent => {
    const start = toEpochSeconds(e.eventStartTimeGmt)
    const duration = millisToSeconds(e.durationInMillis)
    return {
      type: (nonEmpty(e.eventType) ?? 'unknown').toLowerCase(),
      startTime: start == null ? null : new Date(start * 1000).toISOString(),
      durationS: duration ?? null,
      impact: finite(e.bodyBatteryImpact) ?? null,
    }
  })
  return mapped.sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
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
    bodyBatteryEndOfDayValue: finite(d.bodyBattery?.endOfDayValue),
    bodyBatteryEvents: mapBodyBatteryEvents(d.bodyBattery?.activityEvents),
    avgRespirationBreathsPerMinute: finite(d.respiration?.avgValue),
    minRespirationBreathsPerMinute: finite(d.respiration?.minValue),
    maxRespirationBreathsPerMinute: finite(d.respiration?.maxValue),
    avgSpo2Percent: finite(d.pulseOx?.avgValue),
    minSpo2Percent: finite(d.pulseOx?.minValue),
    hydrationConsumedMl: finite(d.hydration?.consumedInFractionalMl),
    hydrationGoalMl: finite(d.hydration?.goalInFractionalMl) ?? finite(d.hydration?.goalInMl),
    restStressDurationInSeconds: millisToSeconds(d.stress?.restDurationInMillis),
    lowStressDurationInSeconds: millisToSeconds(d.stress?.lowStressDurationInMillis),
    mediumStressDurationInSeconds: millisToSeconds(d.stress?.mediumStressDurationInMillis),
    highStressDurationInSeconds: millisToSeconds(d.stress?.highStressDurationInMillis),
    activityStressDurationInSeconds: millisToSeconds(d.stress?.activityDurationInMillis),
  }
}

/** Hydration statistics are a separate endpoint; they add the sweat loss and fill gaps of the daily summary. */
export function applyHydration(daily: GarminDaily, h: ApiHydrationDay): void {
  daily.hydrationConsumedMl ??= finite(h.valueInML)
  daily.hydrationGoalMl ??= finite(h.goalInML)
  daily.sweatLossMl = finite(h.sweatLossInML) ?? daily.sweatLossMl
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
    baselineBalancedLow: finite(h.baseline?.balancedLow),
    baselineBalancedUpper: finite(h.baseline?.balancedUpper),
    feedbackPhrase: nonEmpty(h.feedbackPhrase),
  }
}

function overallSleepScore(scores: ApiDailySleep['sleepScores']): GarminSleep['overallSleepScore'] {
  if (!scores) return undefined
  const key = Object.keys(scores).find((k) => k.toLowerCase() === 'overall') ?? Object.keys(scores).find((k) => /overall/i.test(k))
  const item = key ? scores[key] : undefined
  const value = finite(item?.value)
  return value == null ? undefined : { value, qualifierKey: item?.qualifierKey }
}

/** Garmin reports sleep need in minutes; values above a day's worth of minutes are treated as seconds. */
const needMinutes = (v: unknown): number | null => {
  const n = finite(v)
  if (n == null || n < 0) return null
  return Math.round(n > 1440 ? n / 60 : n)
}

function mapSleepNeed(need: ApiSleepNeed | undefined, next: ApiSleepNeed | undefined): SleepNeed | undefined {
  if (!need && !next) return undefined
  return {
    baselineMin: needMinutes(need?.baseline),
    actualMin: needMinutes(need?.actual),
    feedback: nonEmpty(need?.feedback) ?? null,
    bedtimeStartMin: finite(need?.recommendedBedtimeStartMins ?? next?.recommendedBedtimeStartMins) ?? null,
    bedtimeEndMin: finite(need?.recommendedBedtimeEndMins ?? next?.recommendedBedtimeEndMins) ?? null,
    nextActualMin: needMinutes(next?.actual),
  }
}

function mapScoreFactors(scores: ApiDailySleep['sleepScores']): Record<string, SleepScoreFactor> | undefined {
  if (!scores) return undefined
  const entries = Object.entries(scores)
    .filter(([key]) => !/overall/i.test(key))
    .map(([key, item]) => [key, { value: finite(item?.value) ?? null, qualifier: nonEmpty(item?.qualifierKey) ?? null, optimalStart: finite(item?.optimalStart) ?? null, optimalEnd: finite(item?.optimalEnd) ?? null }] as const)
  return entries.length ? Object.fromEntries(entries) : undefined
}

function mapNaps(naps: ApiDailySleep['dailyNapDTOS']): SleepNap[] | undefined {
  const mapped: SleepNap[] = []
  for (const nap of naps ?? []) {
    const start = toEpochSeconds(nap.napStartTimestampGMT)
    const duration = finite(nap.napTimeSec)
    if (start == null || !duration) continue
    const end = toEpochSeconds(nap.napEndTimestampGMT)
    mapped.push({ startTime: new Date(start * 1000).toISOString(), endTime: end == null ? null : new Date(end * 1000).toISOString(), durationS: duration, feedback: nonEmpty(nap.napFeedback) ?? null })
  }
  return mapped.length ? mapped : undefined
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
    napDurationInSeconds: finite(s.napTimeSeconds),
    awakeCount: finite(s.awakeCount),
    avgSleepStress: finite(s.avgSleepStress),
    avgHeartRateInBeatsPerMinute: finite(s.avgHeartRate),
    lowestSpo2Percent: finite(s.lowestSpO2Value),
    highestSpo2Percent: finite(s.highestSpO2Value),
    spo2EventsBelowThreshold: finite(s.numberOfEventsBelowThreshold),
    lowestRespirationBreathsPerMinute: finite(s.lowestRespirationValue),
    highestRespirationBreathsPerMinute: finite(s.highestRespirationValue),
    breathingDisruptionSeverity: nonEmpty(s.breathingDisruptionSeverity),
    scoreFeedback: nonEmpty(s.sleepScoreFeedback),
    scoreInsight: nonEmpty(s.sleepScoreInsight),
    scoreFactors: mapScoreFactors(s.sleepScores),
    need: mapSleepNeed(s.sleepNeed, s.nextSleepNeed),
    naps: mapNaps(s.dailyNapDTOS),
    alignment: s.sleepAlignment
      ? {
          status: nonEmpty(s.sleepAlignment.status) ?? null,
          windowStartMin: finite(s.sleepAlignment.optimalSleepWindowStartMins) ?? null,
          windowEndMin: finite(s.sleepAlignment.optimalSleepWindowEndMins) ?? null,
          lastMidpointMin: finite(s.sleepAlignment.lastSleepMidpointMins) ?? null,
          windowMidpointMin: finite(s.sleepAlignment.optimalSleepWindowMidpointMins) ?? null,
        }
      : undefined,
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

const FASTEST_SPLIT = /^fastestSplit_(\d+)$/
const POWER_CURVE = /^maxAvgPower_(\d+)$/

/** Drops undefined values so the stored JSON only has what the device recorded. */
function compact<T extends object>(value: T): T | undefined {
  const entries = Object.entries(value).filter(([, v]) => v !== undefined && !(typeof v === 'object' && v !== null && !Object.keys(v).length))
  return entries.length ? (Object.fromEntries(entries) as T) : undefined
}

function mapActivityExtra(a: ApiSummarizedActivity): ActivityExtra | undefined {
  const fastest: Record<string, number> = {}
  const curve: Record<string, number> = {}
  for (const [key, value] of Object.entries(a)) {
    const v = finite(value)
    if (v == null || v <= 0) continue
    const split = FASTEST_SPLIT.exec(key)
    if (split) fastest[split[1]!] = v
    const power = POWER_CURVE.exec(key)
    if (power) curve[power[1]!] = v
  }
  const powerZones = [1, 2, 3, 4, 5, 6, 7].map((i) => finite(a[`powerTimeInZone_${i}`]))
  const stressDelta = finite(a.endStress) != null && finite(a.startStress) != null ? (a.endStress as number) - (a.startStress as number) : undefined
  return compact<ActivityExtra>({
    groundContactMs: finite(a.avgGroundContactTime),
    strideLengthCm: finite(a.avgStrideLength),
    verticalOscillationCm: finite(a.avgVerticalOscillation),
    verticalRatioPct: finite(a.avgVerticalRatio),
    groundContactBalancePct: finite(a.avgGroundContactBalance),
    normPowerW: finite(a.normPower),
    maxPowerW: finite(a.maxPower),
    max20MinPowerW: finite(a.max20MinPower),
    ftpW: finite(a.maxFtp),
    tss: finite(a.trainingStressScore),
    intensityFactor: finite(a.intensityFactor),
    lactateThresholdBpm: finite(a.lactateThresholdBpm),
    gradeAdjustedSpeedMs: finite(a.avgGradeAdjustedSpeed),
    impactLoad: finite(a.impactLoad),
    avgStress: finite(a.avgStress),
    stressDelta,
    bodyBatteryDelta: finite(a.differenceBodyBattery),
    avgRespiration: finite(a.avgRespirationRate),
    minRespiration: finite(a.minRespirationRate),
    maxRespiration: finite(a.maxRespirationRate),
    minTempC: finite(a.minTemperature),
    maxTempC: finite(a.maxTemperature),
    minElevationM: finite(a.minElevation),
    maxElevationM: finite(a.maxElevation),
    steps: finite(a.steps),
    floorsClimbed: finite(a.floorsClimbed),
    moderateMin: finite(a.moderateIntensityMinutes),
    vigorousMin: finite(a.vigorousIntensityMinutes),
    maxCadence: finite(a.maxRunningCadenceInStepsPerMinute),
    lapCount: finite(a.lapCount),
    elapsedS: finite(a.elapsedDuration),
    strokes: finite(a.strokes),
    swolf: finite(a.averageSwolf),
    location: nonEmpty(a.locationName),
    description: nonEmpty(a.description),
    isPr: a.isPR === true ? true : undefined,
    trainingEffectLabel: nonEmpty(a.trainingEffectLabel),
    aerobicMessage: nonEmpty(a.aerobicTrainingEffectMessage),
    anaerobicMessage: nonEmpty(a.anaerobicTrainingEffectMessage),
    fastestSplitsS: fastest,
    powerCurveW: curve,
    powerZoneS: powerZones.every((z) => z != null) && powerZones.some((z) => (z as number) > 0) ? (powerZones as number[]) : undefined,
  })
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
    extra: mapActivityExtra(a),
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

const MAX_SAMPLES = 2_000
const STEP_SPORTS = /running|walking|hiking|treadmill/i

/** Details from the original FIT file: GPS track, per-second series and laps. Samples are thinned to keep the stored row small. */
export function mapFitDetails(fit: FitActivity, activityId: string, typeKey: string | undefined): GarminActivityDetails {
  const stride = Math.max(1, Math.ceil(fit.records.length / MAX_SAMPLES))
  const stepsBased = STEP_SPORTS.test(typeKey ?? '')
  const samples = fit.records
    .filter((_, i) => i % stride === 0)
    .map((r) => ({
      startTimeInSeconds: r.time,
      latitudeInDegree: r.lat,
      longitudeInDegree: r.lng,
      elevationInMeters: r.altitudeM,
      heartRateInBeatsPerMinute: r.heartRate,
      speedMetersPerSecond: r.speedMs,
      // FIT running cadence counts strides of one leg; Garmin Connect shows steps per minute.
      stepsPerMinute: stepsBased && r.cadence != null ? r.cadence * 2 : undefined,
      bikeCadenceInRPM: !stepsBased ? r.cadence : undefined,
      totalDistanceInMeters: r.distanceM,
    }))
  return { summaryId: activityId, samples, laps: fit.laps.map((l) => ({ startTimeInSeconds: l.startTime })) }
}

/** Weight values are kilograms per the spec, but Garmin Connect itself uses grams; anything implausible for kg is converted. */
const toKg = (v: unknown): number | undefined => {
  const n = finite(v)
  if (n == null || n <= 0) return undefined
  return n > 1000 ? n / 1000 : n
}

export function mapWeight(entry: ApiWeightEntry, fallbackDate?: string): GarminWeight | null {
  const measuredAt = toEpochSeconds(entry.timestampGMT)
  const calendarDate = entry.calendarDate ?? fallbackDate
  if (!calendarDate) return null
  const weightKg = toKg(entry.weight)
  const bodyFat = finite(entry.bodyFat)
  if (weightKg == null && bodyFat == null) return null
  return {
    calendarDate,
    measuredAtInSeconds: measuredAt ?? undefined,
    weightKg,
    bmi: finite(entry.bmi),
    bodyFatPercent: bodyFat,
    bodyWaterPercent: finite(entry.bodyWater),
    muscleMassKg: toKg(entry.muscleMass),
    boneMassKg: toKg(entry.boneMass),
    visceralFat: finite(entry.visceralFat),
    physiqueRating: finite(entry.physiqueRating),
    metabolicAge: finite(entry.metabolicAge),
  }
}

export function mapFitnessAge(f: ApiFitnessAge, fallbackDate: string): GarminFitnessAge | null {
  if (finite(f.fitnessAge) == null) return null
  const updated = toEpochSeconds(f.lastUpdated)
  return {
    calendarDate: updated == null ? fallbackDate : new Date(updated * 1000).toISOString().slice(0, 10),
    chronologicalAge: finite(f.chronologicalAge),
    fitnessAge: finite(f.fitnessAge),
    achievableFitnessAge: finite(f.achievableFitnessAge),
    previousFitnessAge: finite(f.previousFitnessAge),
    components: f.components,
  }
}

export function mapHeartRateZones(z: ApiHeartRateZones): GarminHrZones | null {
  const floors = [z.zone1Floor, z.zone2Floor, z.zone3Floor, z.zone4Floor, z.zone5Floor].map(finite)
  if (floors.some((f) => f == null)) return null
  return {
    sport: (nonEmpty(z.sport) ?? 'DEFAULT').toUpperCase(),
    trainingMethod: nonEmpty(z.trainingMethod),
    restingHeartRate: finite(z.restingHeartRateUsed),
    lactateThresholdHeartRate: finite(z.lactateThresholdHeartRateUsed),
    maxHeartRate: finite(z.maxHeartRateUsed),
    zoneFloors: floors as number[],
  }
}

export function mapHrvReadings(date: string, chart: ApiHrvChart): GarminIntradaySeries | null {
  const points: [number, number][] = []
  for (const r of chart.hrvReadings ?? []) {
    const at = toEpochSeconds(r.readingTimeGMT)
    const value = finite(r.hrvValue)
    if (at != null && value != null) points.push([at, value])
  }
  if (!points.length) return null
  return { calendarDate: date, metric: 'hrv', points: points.sort((a, b) => a[0] - b[0]) }
}

export function mapSpo2Readings(date: string, day: ApiSpo2Day): GarminIntradaySeries | null {
  const rows = day.spO2SingleValues
  if (!rows?.length) return null
  const column = (pattern: RegExp, fallback: number) => day.spO2SingleValuesDescriptorList?.find((d) => pattern.test(d.spo2ValueDescriptorKey ?? ''))?.spo2ValueDescriptorIndex ?? fallback
  const timeIndex = column(/timestamp|time/i, 0)
  const valueIndex = column(/spo2|value/i, 1)
  const points: [number, number][] = []
  for (const row of rows) {
    const at = toEpochSeconds(row[timeIndex] as GarminTimestamp)
    const value = finite(Number(row[valueIndex]))
    if (at != null && value != null) points.push([at, value])
  }
  if (!points.length) return null
  return { calendarDate: date, metric: 'spo2', points: points.sort((a, b) => a[0] - b[0]) }
}
