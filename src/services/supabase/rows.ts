import { z } from 'zod'
import type {
  Activity,
  ActivityDetail,
  ActivityLap,
  ActivitySamples,
  BodyComposition,
  DailyMetrics,
  FitnessAge,
  HrZoneConfig,
  IntradaySeries,
  ProviderId,
  SleepSession,
  UserProfile,
} from '@shared/domain.ts'

/**
 * Runtime validation of rows coming back from PostgREST, mapped to the normalized domain model.
 * A row that fails validation throws instead of silently producing wrong numbers in the UI.
 */

const num = z.number().nullable()
/** Columns added by later migrations: tolerated as missing so an app that is ahead of the database keeps working. */
const extraNum = z.number().nullish().transform((v) => v ?? null)
const extraText = z.string().nullish().transform((v) => v ?? null)
const extraJson = <T>() => z.unknown().transform((v) => (v ?? null) as T | null)
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const provider = z.enum(['garmin', 'apple_health', 'health_connect', 'fit_import', 'csv_import'])
const sport = z.enum(['hiking', 'cycling', 'running', 'walking', 'swimming', 'strength', 'other'])

const provenance = (row: { source: string; external_id: string | null; fetched_at: string }) => ({
  source: row.source as ProviderId,
  externalId: row.external_id,
  fetchedAt: row.fetched_at,
})

export const dailyRowSchema = z.object({
  date,
  steps: num,
  step_goal: num,
  distance_m: num,
  floors_climbed: num,
  active_kcal: num,
  total_kcal: num,
  intensity_minutes: num,
  resting_hr: num,
  min_hr: num,
  max_hr: num,
  avg_stress: num,
  max_stress: num,
  body_battery_high: num,
  body_battery_low: num,
  body_battery_charged: num,
  body_battery_drained: num,
  hrv_last_night_avg: num,
  hrv_weekly_avg: num,
  hrv_status: z.enum(['balanced', 'unbalanced', 'low', 'poor']).nullable(),
  vo2_max: num,
  respiration_avg: extraNum,
  respiration_min: extraNum,
  respiration_max: extraNum,
  spo2_avg: extraNum,
  spo2_min: extraNum,
  hydration_ml: extraNum,
  hydration_goal_ml: extraNum,
  sweat_loss_ml: extraNum,
  stress_rest_s: extraNum,
  stress_low_s: extraNum,
  stress_medium_s: extraNum,
  stress_high_s: extraNum,
  stress_activity_s: extraNum,
  body_battery_end_of_day: extraNum,
  body_battery_events: extraJson<DailyMetrics['bodyBatteryEvents']>(),
  hrv_baseline_low: extraNum,
  hrv_baseline_high: extraNum,
  hrv_5min_high: extraNum,
  hrv_feedback: extraText,
  source: provider,
  external_id: z.string().nullable(),
  fetched_at: z.string(),
})

export const toDaily = (raw: unknown): DailyMetrics => {
  const r = dailyRowSchema.parse(raw)
  return {
    date: r.date,
    steps: r.steps,
    stepGoal: r.step_goal,
    distanceM: r.distance_m,
    floorsClimbed: r.floors_climbed,
    activeKcal: r.active_kcal,
    totalKcal: r.total_kcal,
    intensityMinutes: r.intensity_minutes,
    restingHr: r.resting_hr,
    minHr: r.min_hr,
    maxHr: r.max_hr,
    avgStress: r.avg_stress,
    maxStress: r.max_stress,
    bodyBatteryHigh: r.body_battery_high,
    bodyBatteryLow: r.body_battery_low,
    bodyBatteryCharged: r.body_battery_charged,
    bodyBatteryDrained: r.body_battery_drained,
    hrvLastNightAvg: r.hrv_last_night_avg,
    hrvWeeklyAvg: r.hrv_weekly_avg,
    hrvStatus: r.hrv_status,
    vo2Max: r.vo2_max,
    respirationAvg: r.respiration_avg,
    respirationMin: r.respiration_min,
    respirationMax: r.respiration_max,
    spo2Avg: r.spo2_avg,
    spo2Min: r.spo2_min,
    hydrationMl: r.hydration_ml,
    hydrationGoalMl: r.hydration_goal_ml,
    sweatLossMl: r.sweat_loss_ml,
    stressRestS: r.stress_rest_s,
    stressLowS: r.stress_low_s,
    stressMediumS: r.stress_medium_s,
    stressHighS: r.stress_high_s,
    stressActivityS: r.stress_activity_s,
    bodyBatteryEndOfDay: r.body_battery_end_of_day,
    bodyBatteryEvents: r.body_battery_events,
    hrvBaselineLow: r.hrv_baseline_low,
    hrvBaselineHigh: r.hrv_baseline_high,
    hrv5MinHigh: r.hrv_5min_high,
    hrvFeedback: r.hrv_feedback,
    provenance: provenance(r),
  }
}

export const sleepRowSchema = z.object({
  date,
  start_time: z.string(),
  end_time: z.string(),
  duration_s: z.number(),
  deep_s: num,
  light_s: num,
  rem_s: num,
  awake_s: num,
  score: num,
  avg_respiration: num,
  avg_spo2: num,
  nap_s: extraNum,
  awake_count: extraNum,
  avg_sleep_stress: extraNum,
  avg_hr: extraNum,
  spo2_low: extraNum,
  spo2_high: extraNum,
  spo2_events: extraNum,
  respiration_low: extraNum,
  respiration_high: extraNum,
  breathing_disruption: extraText,
  score_feedback: extraText,
  score_insight: extraText,
  score_factors: extraJson<SleepSession['scoreFactors']>(),
  need: extraJson<SleepSession['need']>(),
  naps: extraJson<SleepSession['naps']>(),
  alignment: extraJson<SleepSession['alignment']>(),
  source: provider,
  external_id: z.string().nullable(),
  fetched_at: z.string(),
})

export const toSleep = (raw: unknown): SleepSession => {
  const r = sleepRowSchema.parse(raw)
  return {
    date: r.date,
    startTime: r.start_time,
    endTime: r.end_time,
    durationS: r.duration_s,
    deepS: r.deep_s,
    lightS: r.light_s,
    remS: r.rem_s,
    awakeS: r.awake_s,
    score: r.score,
    avgRespiration: r.avg_respiration,
    avgSpo2: r.avg_spo2,
    napS: r.nap_s,
    awakeCount: r.awake_count,
    avgSleepStress: r.avg_sleep_stress,
    avgHr: r.avg_hr,
    spo2Low: r.spo2_low,
    spo2High: r.spo2_high,
    spo2Events: r.spo2_events,
    respirationLow: r.respiration_low,
    respirationHigh: r.respiration_high,
    breathingDisruption: r.breathing_disruption,
    scoreFeedback: r.score_feedback,
    scoreInsight: r.score_insight,
    scoreFactors: r.score_factors,
    need: r.need,
    naps: r.naps,
    alignment: r.alignment,
    provenance: provenance(r),
  }
}

export const intradayRowSchema = z.object({
  date,
  metric: z.enum(['heart_rate', 'stress', 'body_battery', 'hrv', 'spo2']),
  points: z.array(z.tuple([z.number(), z.number()])),
  source: provider,
  fetched_at: z.string(),
})

export const toIntraday = (raw: unknown): IntradaySeries => {
  const r = intradayRowSchema.parse(raw)
  return { date: r.date, metric: r.metric, points: r.points, provenance: provenance({ source: r.source, external_id: null, fetched_at: r.fetched_at }) }
}

export const activityRowSchema = z.object({
  id: z.string(),
  source: provider,
  external_id: z.string(),
  sport,
  sub_sport: z.string().nullable(),
  name: z.string(),
  start_time: z.string(),
  duration_s: z.number(),
  moving_s: num,
  distance_m: num,
  elevation_gain_m: num,
  elevation_loss_m: num,
  avg_speed_ms: num,
  max_speed_ms: num,
  avg_hr: num,
  max_hr: num,
  avg_cadence: num,
  avg_power_w: num,
  calories: num,
  aerobic_te: num,
  anaerobic_te: num,
  training_load: num,
  hr_zone_seconds: z.array(z.number()).length(5).nullable(),
  start_lat: num,
  start_lng: num,
  extra: extraJson<Activity['extra']>(),
  fetched_at: z.string(),
})

export const toActivity = (raw: unknown): Activity => {
  const r = activityRowSchema.parse(raw)
  return {
    id: r.id,
    sport: r.sport,
    subSport: r.sub_sport,
    name: r.name,
    startTime: r.start_time,
    durationS: r.duration_s,
    movingS: r.moving_s,
    distanceM: r.distance_m,
    elevationGainM: r.elevation_gain_m,
    elevationLossM: r.elevation_loss_m,
    avgSpeedMs: r.avg_speed_ms,
    maxSpeedMs: r.max_speed_ms,
    avgHr: r.avg_hr,
    maxHr: r.max_hr,
    avgCadence: r.avg_cadence,
    avgPowerW: r.avg_power_w,
    calories: r.calories,
    aerobicTe: r.aerobic_te,
    anaerobicTe: r.anaerobic_te,
    trainingLoad: r.training_load,
    hrZoneSeconds: r.hr_zone_seconds as Activity['hrZoneSeconds'],
    startLat: r.start_lat,
    startLng: r.start_lng,
    notes: null,
    extra: r.extra,
    provenance: provenance({ source: r.source, external_id: r.external_id, fetched_at: r.fetched_at }),
  }
}

export const bodyRowSchema = z.object({
  date,
  measured_at: extraText,
  weight_kg: extraNum,
  bmi: extraNum,
  body_fat_pct: extraNum,
  body_water_pct: extraNum,
  muscle_mass_kg: extraNum,
  bone_mass_kg: extraNum,
  visceral_fat: extraNum,
  physique_rating: extraNum,
  metabolic_age: extraNum,
  source: provider,
  external_id: z.string().nullable(),
  fetched_at: z.string(),
})

export const toBody = (raw: unknown): BodyComposition => {
  const r = bodyRowSchema.parse(raw)
  return {
    date: r.date,
    measuredAt: r.measured_at,
    weightKg: r.weight_kg,
    bmi: r.bmi,
    bodyFatPct: r.body_fat_pct,
    bodyWaterPct: r.body_water_pct,
    muscleMassKg: r.muscle_mass_kg,
    boneMassKg: r.bone_mass_kg,
    visceralFat: r.visceral_fat,
    physiqueRating: r.physique_rating,
    metabolicAge: r.metabolic_age,
    provenance: provenance(r),
  }
}

export const fitnessAgeRowSchema = z.object({
  date,
  chronological_age: extraNum,
  fitness_age: extraNum,
  achievable_fitness_age: extraNum,
  previous_fitness_age: extraNum,
  components: extraJson<FitnessAge['components']>(),
  source: provider,
  fetched_at: z.string(),
})

export const toFitnessAge = (raw: unknown): FitnessAge => {
  const r = fitnessAgeRowSchema.parse(raw)
  return {
    date: r.date,
    chronologicalAge: r.chronological_age,
    fitnessAge: r.fitness_age,
    achievableFitnessAge: r.achievable_fitness_age,
    previousFitnessAge: r.previous_fitness_age,
    components: r.components,
    provenance: provenance({ source: r.source, external_id: null, fetched_at: r.fetched_at }),
  }
}

export const hrZoneRowSchema = z.object({
  sport: z.string(),
  training_method: extraText,
  resting_hr: extraNum,
  lactate_threshold_hr: extraNum,
  max_hr: extraNum,
  zone_floors: z.array(z.number()).length(5),
  source: provider,
  fetched_at: z.string(),
})

export const toHrZone = (raw: unknown): HrZoneConfig => {
  const r = hrZoneRowSchema.parse(raw)
  return {
    sport: r.sport,
    trainingMethod: r.training_method,
    restingHr: r.resting_hr,
    lactateThresholdHr: r.lactate_threshold_hr,
    maxHr: r.max_hr,
    zoneFloors: r.zone_floors as HrZoneConfig['zoneFloors'],
    provenance: provenance({ source: r.source, external_id: null, fetched_at: r.fetched_at }),
  }
}

const lapSchema = z.object({
  index: z.number(),
  startOffsetS: z.number(),
  durationS: z.number(),
  distanceM: num,
  avgSpeedMs: num,
  avgHr: num,
  avgCadence: num,
  elevationGainM: num,
})

const column = z.array(z.number().nullable())
const samplesSchema = z.object({ t: z.array(z.number()), lat: column, lng: column, elevation: column, hr: column, speed: column, cadence: column, distance: column })

export const detailRowSchema = z.object({ laps: z.array(lapSchema), samples: samplesSchema })

export const toDetail = (activity: Activity, raw: unknown): ActivityDetail => {
  const r = detailRowSchema.parse(raw)
  return { activity, laps: r.laps as ActivityLap[], samples: r.samples as ActivitySamples }
}

export const profileRowSchema = z.object({
  display_name: z.string(),
  birth_year: num,
  max_hr: z.number(),
  resting_hr_override: num,
  step_goal: z.number(),
  locale: z.string(),
})

export const toProfile = (raw: unknown): UserProfile => {
  const r = profileRowSchema.parse(raw)
  return { displayName: r.display_name, birthYear: r.birth_year, maxHr: r.max_hr, restingHrOverride: r.resting_hr_override, stepGoal: r.step_goal, locale: r.locale }
}

export const connectionRowSchema = z.object({
  status: z.enum(['connected', 'error', 'disconnected']),
  sync_state: z.enum(['idle', 'running', 'error']),
  last_error: z.string().nullable(),
  last_synced_at: z.string().nullable(),
  history_start: date.nullable(),
})
