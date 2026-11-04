import type {
  Activity,
  ActivityDetail,
  ActivityLap,
  ActivitySamples,
  BodyComposition,
  DailyMetrics,
  FitnessAge,
  FitnessAgeComponent,
  HrvStatus,
  HrZoneConfig,
  IntradaySeries,
  NormalizedBundle,
  Provenance,
  SleepSession,
  Sport,
} from '../domain.ts'
import type {
  GarminActivity,
  GarminActivityDetails,
  GarminDaily,
  GarminFitnessAge,
  GarminHrZones,
  GarminRangePayload,
  GarminSplit,
  GarminWeight,
} from './types.ts'

const iso = (epochSeconds: number) => new Date(epochSeconds * 1000).toISOString()

/** Invalid or implausible measurements become `null` instead of polluting analytics. */
function inRange(value: number | undefined | null, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null
}
const heartRate = (v: number | undefined) => inRange(v, 25, 250)
const percent = (v: number | undefined) => inRange(v, 0, 100)
const nonNegative = (v: number | undefined) => inRange(v, 0, Number.MAX_SAFE_INTEGER)
const spo2 = (v: number | undefined) => inRange(v, 50, 100)
const respiration = (v: number | undefined) => inRange(v, 3, 60)
const orNull = <T>(v: T | undefined): T | null => v ?? null

const SPORT_BY_TYPE: Record<string, Sport> = {
  HIKING: 'hiking',
  CYCLING: 'cycling',
  MOUNTAIN_BIKING: 'cycling',
  ROAD_BIKING: 'cycling',
  GRAVEL_CYCLING: 'cycling',
  INDOOR_CYCLING: 'cycling',
  E_BIKING: 'cycling',
  RUNNING: 'running',
  TRAIL_RUNNING: 'running',
  VIRTUAL_RIDE: 'cycling',
  E_BIKE_FITNESS: 'cycling',
  E_BIKE_MOUNTAIN: 'cycling',
  INDOOR_WALKING: 'walking',
  CASUAL_WALKING: 'walking',
  SPEED_WALKING: 'walking',
  TREADMILL_RUNNING: 'running',
  WALKING: 'walking',
  LAP_SWIMMING: 'swimming',
  OPEN_WATER_SWIMMING: 'swimming',
  STRENGTH_TRAINING: 'strength',
}

const HRV_STATUS: Record<string, HrvStatus> = {
  BALANCED: 'balanced',
  UNBALANCED: 'unbalanced',
  LOW: 'low',
  POOR: 'poor',
}

function provenance(externalId: string | null, fetchedAt: string): Provenance {
  return { source: 'garmin', externalId, fetchedAt }
}

function bodyBatteryRange(values: number[]): { high: number | null; low: number | null } {
  return values.length ? { high: Math.max(...values), low: Math.min(...values) } : { high: null, low: null }
}

function intradayFromOffsets(
  startEpoch: number,
  offsets: Record<string, number> | undefined,
  valid: (v: number) => boolean,
): [number, number][] {
  if (!offsets) return []
  return Object.entries(offsets)
    .map(([offset, value]) => [startEpoch + Number(offset), value] as [number, number])
    .filter(([, value]) => valid(value))
    .sort((a, b) => a[0] - b[0])
}

export function normalizeGarminRange(payload: GarminRangePayload, fetchedAt: string): NormalizedBundle {
  const hrvByDate = new Map(payload.hrv.map((h) => [h.calendarDate, h]))
  const metricsByDate = new Map(payload.userMetrics.map((m) => [m.calendarDate, m]))
  const stressByDate = new Map(payload.stressDetails.map((s) => [s.calendarDate, s]))

  const intraday: IntradaySeries[] = []
  const daily: DailyMetrics[] = payload.dailies.map((d: GarminDaily) => {
    const prov = provenance(d.summaryId, fetchedAt)
    const hrv = hrvByDate.get(d.calendarDate)
    const detail = stressByDate.get(d.calendarDate)

    const battery = intradayFromOffsets(detail?.startTimeInSeconds ?? d.startTimeInSeconds, detail?.timeOffsetBodyBatteryValues, (v) => v >= 0 && v <= 100)
    const stress = intradayFromOffsets(detail?.startTimeInSeconds ?? d.startTimeInSeconds, detail?.timeOffsetStressLevelValues, (v) => v >= 0 && v <= 100)
    const hr = intradayFromOffsets(d.startTimeInSeconds, d.timeOffsetHeartRateSamples, (v) => v >= 25 && v <= 250)
    if (hr.length) intraday.push({ date: d.calendarDate, metric: 'heart_rate', points: hr, provenance: prov })
    if (stress.length) intraday.push({ date: d.calendarDate, metric: 'stress', points: stress, provenance: prov })
    if (battery.length) intraday.push({ date: d.calendarDate, metric: 'body_battery', points: battery, provenance: prov })
    const derived = bodyBatteryRange(battery.map(([, v]) => v))

    const hrvSeries = (payload.intradayExtra ?? []).filter((x) => x.calendarDate === d.calendarDate)
    for (const series of hrvSeries) {
      const points = series.points.filter(([, v]) => (series.metric === 'hrv' ? v >= 1 && v <= 300 : v >= 50 && v <= 100))
      if (points.length) intraday.push({ date: d.calendarDate, metric: series.metric, points, provenance: prov })
    }

    const intensity =
      d.moderateIntensityDurationInSeconds == null && d.vigorousIntensityDurationInSeconds == null
        ? null
        : Math.round(((d.moderateIntensityDurationInSeconds ?? 0) + 2 * (d.vigorousIntensityDurationInSeconds ?? 0)) / 60)

    return {
      date: d.calendarDate,
      steps: nonNegative(d.steps),
      stepGoal: nonNegative(d.stepsGoal),
      distanceM: nonNegative(d.distanceInMeters),
      floorsClimbed: nonNegative(d.floorsClimbed),
      activeKcal: nonNegative(d.activeKilocalories),
      totalKcal: d.activeKilocalories != null && d.bmrKilocalories != null ? d.activeKilocalories + d.bmrKilocalories : null,
      intensityMinutes: intensity,
      restingHr: heartRate(d.restingHeartRateInBeatsPerMinute),
      minHr: heartRate(d.minHeartRateInBeatsPerMinute),
      maxHr: heartRate(d.maxHeartRateInBeatsPerMinute),
      avgStress: percent(d.averageStressLevel),
      maxStress: percent(d.maxStressLevel),
      bodyBatteryHigh: percent(d.bodyBatteryHighestValue) ?? derived.high,
      bodyBatteryLow: percent(d.bodyBatteryLowestValue) ?? derived.low,
      bodyBatteryCharged: percent(d.bodyBatteryChargedValue),
      bodyBatteryDrained: percent(d.bodyBatteryDrainedValue),
      hrvLastNightAvg: inRange(hrv?.lastNightAvg, 1, 300),
      hrvWeeklyAvg: inRange(hrv?.weeklyAvg, 1, 300),
      hrvStatus: hrv?.status ? (HRV_STATUS[hrv.status] ?? null) : null,
      vo2Max: inRange(metricsByDate.get(d.calendarDate)?.vo2Max, 10, 100),
      respirationAvg: respiration(d.avgRespirationBreathsPerMinute),
      respirationMin: respiration(d.minRespirationBreathsPerMinute),
      respirationMax: respiration(d.maxRespirationBreathsPerMinute),
      spo2Avg: spo2(d.avgSpo2Percent),
      spo2Min: spo2(d.minSpo2Percent),
      hydrationMl: nonNegative(d.hydrationConsumedMl),
      hydrationGoalMl: nonNegative(d.hydrationGoalMl),
      sweatLossMl: nonNegative(d.sweatLossMl),
      stressRestS: nonNegative(d.restStressDurationInSeconds),
      stressLowS: nonNegative(d.lowStressDurationInSeconds),
      stressMediumS: nonNegative(d.mediumStressDurationInSeconds),
      stressHighS: nonNegative(d.highStressDurationInSeconds),
      stressActivityS: nonNegative(d.activityStressDurationInSeconds),
      bodyBatteryEndOfDay: percent(d.bodyBatteryEndOfDayValue),
      bodyBatteryEvents: d.bodyBatteryEvents?.length ? d.bodyBatteryEvents : null,
      hrvBaselineLow: inRange(hrv?.baselineBalancedLow, 1, 300),
      hrvBaselineHigh: inRange(hrv?.baselineBalancedUpper, 1, 300),
      hrv5MinHigh: null,
      hrvFeedback: orNull(hrv?.feedbackPhrase),
      provenance: prov,
    }
  })

  const sleep: SleepSession[] = payload.sleeps.map((s) => ({
    date: s.calendarDate,
    startTime: iso(s.startTimeInSeconds),
    endTime: iso(s.startTimeInSeconds + s.durationInSeconds + (s.awakeDurationInSeconds ?? 0)),
    durationS: s.durationInSeconds,
    deepS: nonNegative(s.deepSleepDurationInSeconds),
    lightS: nonNegative(s.lightSleepDurationInSeconds),
    remS: nonNegative(s.remSleepInSeconds),
    awakeS: nonNegative(s.awakeDurationInSeconds),
    score: percent(s.overallSleepScore?.value),
    avgRespiration: respiration(s.avgRespirationBreathsPerMinute),
    avgSpo2: spo2(s.avgSpo2Percent),
    napS: nonNegative(s.napDurationInSeconds),
    awakeCount: nonNegative(s.awakeCount),
    avgSleepStress: percent(s.avgSleepStress),
    avgHr: heartRate(s.avgHeartRateInBeatsPerMinute),
    spo2Low: spo2(s.lowestSpo2Percent),
    spo2High: spo2(s.highestSpo2Percent),
    spo2Events: nonNegative(s.spo2EventsBelowThreshold),
    respirationLow: respiration(s.lowestRespirationBreathsPerMinute),
    respirationHigh: respiration(s.highestRespirationBreathsPerMinute),
    breathingDisruption: orNull(s.breathingDisruptionSeverity),
    scoreFeedback: orNull(s.scoreFeedback),
    scoreInsight: orNull(s.scoreInsight),
    scoreFactors: s.scoreFactors ?? null,
    need: orNull(s.need),
    naps: orNull(s.naps),
    alignment: orNull(s.alignment),
    provenance: provenance(s.summaryId, fetchedAt),
  }))

  return {
    daily,
    sleep,
    intraday,
    activities: payload.activities.map((a) => normalizeGarminActivity(a, fetchedAt)),
    body: (payload.weights ?? []).map((w) => normalizeWeight(w, fetchedAt)),
    fitnessAge: (payload.fitnessAge ?? []).map((f) => normalizeFitnessAge(f, fetchedAt)),
    hrZones: (payload.hrZones ?? []).flatMap((z) => normalizeHrZones(z, fetchedAt)),
  }
}

function normalizeWeight(w: GarminWeight, fetchedAt: string): BodyComposition {
  return {
    date: w.calendarDate,
    measuredAt: w.measuredAtInSeconds != null ? iso(w.measuredAtInSeconds) : null,
    weightKg: inRange(w.weightKg, 20, 400),
    bmi: inRange(w.bmi, 8, 80),
    bodyFatPct: inRange(w.bodyFatPercent, 1, 80),
    bodyWaterPct: inRange(w.bodyWaterPercent, 10, 90),
    muscleMassKg: inRange(w.muscleMassKg, 5, 200),
    boneMassKg: inRange(w.boneMassKg, 0.5, 20),
    visceralFat: inRange(w.visceralFat, 0, 60),
    physiqueRating: inRange(w.physiqueRating, 0, 20),
    metabolicAge: inRange(w.metabolicAge, 10, 120),
    provenance: provenance(`weight:${w.calendarDate}`, fetchedAt),
  }
}

function normalizeFitnessAge(f: GarminFitnessAge, fetchedAt: string): FitnessAge {
  const components = f.components
    ? Object.fromEntries(
        Object.entries(f.components).map(([key, c]): [string, FitnessAgeComponent] => [
          key,
          {
            value: orNull(c.value),
            targetValue: orNull(c.targetValue),
            improvementValue: orNull(c.improvementValue),
            potentialAge: orNull(c.potentialAge),
            priority: orNull(c.priority),
            lastMeasurementDate: orNull(c.lastMeasurementDate),
          },
        ]),
      )
    : null
  return {
    date: f.calendarDate,
    chronologicalAge: inRange(f.chronologicalAge, 5, 120),
    fitnessAge: inRange(f.fitnessAge, 5, 120),
    achievableFitnessAge: inRange(f.achievableFitnessAge, 5, 120),
    previousFitnessAge: inRange(f.previousFitnessAge, 5, 120),
    components,
    provenance: provenance(`fitnessage:${f.calendarDate}`, fetchedAt),
  }
}

function normalizeHrZones(z: GarminHrZones, fetchedAt: string): HrZoneConfig[] {
  const floors = z.zoneFloors.map(heartRate)
  const ascending = floors.every((f, i) => f != null && (i === 0 || f > (floors[i - 1] as number)))
  if (!ascending) return []
  return [
    {
      sport: z.sport,
      trainingMethod: orNull(z.trainingMethod),
      restingHr: heartRate(z.restingHeartRate),
      lactateThresholdHr: heartRate(z.lactateThresholdHeartRate),
      maxHr: heartRate(z.maxHeartRate),
      zoneFloors: floors as HrZoneConfig['zoneFloors'],
      provenance: provenance(`hrzones:${z.sport}`, fetchedAt),
    },
  ]
}

export function normalizeGarminActivity(a: GarminActivity, fetchedAt: string): Activity {
  const zones = a.timeInHeartRateZonesInSeconds
  return {
    id: `garmin:${a.summaryId}`,
    sport: SPORT_BY_TYPE[a.activityType] ?? 'other',
    subSport: a.activityType.toLowerCase(),
    name: a.activityName?.trim() || a.activityType,
    startTime: iso(a.startTimeInSeconds),
    durationS: a.durationInSeconds,
    movingS: nonNegative(a.movingDurationInSeconds),
    distanceM: nonNegative(a.distanceInMeters),
    elevationGainM: nonNegative(a.totalElevationGainInMeters),
    elevationLossM: nonNegative(a.totalElevationLossInMeters),
    avgSpeedMs: nonNegative(a.averageSpeedInMetersPerSecond),
    maxSpeedMs: nonNegative(a.maxSpeedInMetersPerSecond),
    avgHr: heartRate(a.averageHeartRateInBeatsPerMinute),
    maxHr: heartRate(a.maxHeartRateInBeatsPerMinute),
    avgCadence: nonNegative(a.averageBikeCadenceInRoundsPerMinute ?? a.averageRunCadenceInStepsPerMinute),
    avgPowerW: nonNegative(a.averagePowerInWatts),
    calories: nonNegative(a.activeKilocalories),
    aerobicTe: inRange(a.aerobicTrainingEffect, 0, 5),
    anaerobicTe: inRange(a.anaerobicTrainingEffect, 0, 5),
    trainingLoad: nonNegative(a.activityTrainingLoad),
    hrZoneSeconds: zones && zones.length === 5 ? (zones as [number, number, number, number, number]) : null,
    startLat: inRange(a.startingLatitudeInDegree, -90, 90),
    startLng: inRange(a.startingLongitudeInDegree, -180, 180),
    notes: null,
    extra: orNull(a.extra),
    provenance: provenance(a.summaryId, fetchedAt),
  }
}

function lapsFromSplits(splits: GarminSplit[], startEpoch: number): ActivityLap[] {
  return splits.map((s, index) => ({
    index,
    startOffsetS: s.startTimeInSeconds - startEpoch,
    durationS: s.durationInSeconds,
    distanceM: nonNegative(s.distanceInMeters),
    avgSpeedMs: nonNegative(s.averageSpeedInMetersPerSecond),
    avgHr: heartRate(s.averageHeartRateInBeatsPerMinute),
    avgCadence: nonNegative(s.averageCadence),
    elevationGainM: nonNegative(s.elevationGainInMeters),
  }))
}

export function normalizeGarminActivityDetails(activity: Activity, details: GarminActivityDetails): ActivityDetail {
  const startEpoch = Math.floor(new Date(activity.startTime).getTime() / 1000)
  const samples: ActivitySamples = { t: [], lat: [], lng: [], elevation: [], hr: [], speed: [], cadence: [], distance: [] }
  for (const s of details.samples) {
    samples.t.push(s.startTimeInSeconds - startEpoch)
    samples.lat.push(s.latitudeInDegree ?? null)
    samples.lng.push(s.longitudeInDegree ?? null)
    samples.elevation.push(s.elevationInMeters ?? null)
    samples.hr.push(heartRate(s.heartRateInBeatsPerMinute))
    samples.speed.push(s.speedMetersPerSecond ?? null)
    samples.cadence.push(s.bikeCadenceInRPM ?? s.stepsPerMinute ?? null)
    samples.distance.push(s.totalDistanceInMeters ?? null)
  }

  if (!details.laps.length && details.splits?.length) {
    return { activity, laps: lapsFromSplits(details.splits, startEpoch), samples }
  }

  const starts = details.laps.map((l) => l.startTimeInSeconds - startEpoch)
  const laps: ActivityLap[] = starts.map((start, index) => {
    const end = starts[index + 1] ?? activity.durationS
    const idx = samples.t.flatMap((t, i) => (t >= start && t < end ? [i] : []))
    const first = idx[0]
    const last = idx[idx.length - 1]
    const avg = (values: (number | null)[]) => {
      const v = idx.map((i) => values[i]).filter((x): x is number => x != null)
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
    }
    let gain = 0
    for (let k = 1; k < idx.length; k++) {
      const delta = (samples.elevation[idx[k]!] ?? 0) - (samples.elevation[idx[k - 1]!] ?? 0)
      if (delta > 0) gain += delta
    }
    const distance =
      first != null && last != null && samples.distance[first] != null && samples.distance[last] != null
        ? (samples.distance[last] as number) - (samples.distance[first] as number)
        : null
    return {
      index,
      startOffsetS: start,
      durationS: end - start,
      distanceM: distance,
      avgSpeedMs: distance != null && end - start > 0 ? distance / (end - start) : null,
      avgHr: avg(samples.hr),
      avgCadence: avg(samples.cadence.map((c) => (c ? c : null))),
      elevationGainM: gain,
    }
  })
  return { activity, laps, samples }
}
