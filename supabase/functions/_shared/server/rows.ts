import type { Activity, ActivityDetail, DailyMetrics, IntradaySeries, ProviderId, SleepSession } from '../domain.ts'

/** Mapping between the normalized domain model and the snake_case Postgres rows. Mirrors src/services/supabase/rows.ts. */

export type Row = Record<string, unknown>

/** Garmin reports fractional values (e.g. 2670.65 s); integer columns need whole numbers. */
const int = <T extends number | null>(v: T): T => (v == null ? v : (Math.round(v) as T))

const prov = (r: Row) => ({ source: r.source as ProviderId, externalId: (r.external_id as string | null) ?? null, fetchedAt: r.fetched_at as string })

export const dailyToRow = (userId: string, d: DailyMetrics): Row => ({
  user_id: userId,
  date: d.date,
  steps: int(d.steps),
  step_goal: int(d.stepGoal),
  distance_m: int(d.distanceM),
  floors_climbed: int(d.floorsClimbed),
  active_kcal: int(d.activeKcal),
  total_kcal: int(d.totalKcal),
  intensity_minutes: int(d.intensityMinutes),
  resting_hr: int(d.restingHr),
  min_hr: int(d.minHr),
  max_hr: int(d.maxHr),
  avg_stress: int(d.avgStress),
  max_stress: int(d.maxStress),
  body_battery_high: int(d.bodyBatteryHigh),
  body_battery_low: int(d.bodyBatteryLow),
  body_battery_charged: int(d.bodyBatteryCharged),
  body_battery_drained: int(d.bodyBatteryDrained),
  hrv_last_night_avg: d.hrvLastNightAvg,
  hrv_weekly_avg: d.hrvWeeklyAvg,
  hrv_status: d.hrvStatus,
  vo2_max: d.vo2Max,
  source: d.provenance.source,
  external_id: d.provenance.externalId,
  fetched_at: d.provenance.fetchedAt,
})

export const dailyFromRow = (r: Row): DailyMetrics => ({
  date: r.date as string,
  steps: r.steps as number | null,
  stepGoal: r.step_goal as number | null,
  distanceM: r.distance_m as number | null,
  floorsClimbed: r.floors_climbed as number | null,
  activeKcal: r.active_kcal as number | null,
  totalKcal: r.total_kcal as number | null,
  intensityMinutes: r.intensity_minutes as number | null,
  restingHr: r.resting_hr as number | null,
  minHr: r.min_hr as number | null,
  maxHr: r.max_hr as number | null,
  avgStress: r.avg_stress as number | null,
  maxStress: r.max_stress as number | null,
  bodyBatteryHigh: r.body_battery_high as number | null,
  bodyBatteryLow: r.body_battery_low as number | null,
  bodyBatteryCharged: r.body_battery_charged as number | null,
  bodyBatteryDrained: r.body_battery_drained as number | null,
  hrvLastNightAvg: r.hrv_last_night_avg as number | null,
  hrvWeeklyAvg: r.hrv_weekly_avg as number | null,
  hrvStatus: r.hrv_status as DailyMetrics['hrvStatus'],
  vo2Max: r.vo2_max as number | null,
  provenance: prov(r),
})

export const sleepToRow = (userId: string, s: SleepSession): Row => ({
  user_id: userId,
  date: s.date,
  start_time: s.startTime,
  end_time: s.endTime,
  duration_s: int(s.durationS),
  deep_s: int(s.deepS),
  light_s: int(s.lightS),
  rem_s: int(s.remS),
  awake_s: int(s.awakeS),
  score: int(s.score),
  avg_respiration: s.avgRespiration,
  avg_spo2: s.avgSpo2,
  source: s.provenance.source,
  external_id: s.provenance.externalId,
  fetched_at: s.provenance.fetchedAt,
})

export const intradayToRow = (userId: string, s: IntradaySeries): Row => ({
  user_id: userId,
  date: s.date,
  metric: s.metric,
  points: s.points,
  source: s.provenance.source,
  fetched_at: s.provenance.fetchedAt,
})

/** `id` is omitted so the database assigns the uuid; (user_id, source, external_id) identifies the record. */
export const activityToRow = (userId: string, a: Activity): Row => ({
  user_id: userId,
  source: a.provenance.source,
  external_id: a.provenance.externalId,
  sport: a.sport,
  sub_sport: a.subSport,
  name: a.name,
  start_time: a.startTime,
  duration_s: int(a.durationS),
  moving_s: int(a.movingS),
  distance_m: a.distanceM,
  elevation_gain_m: a.elevationGainM,
  elevation_loss_m: a.elevationLossM,
  avg_speed_ms: a.avgSpeedMs,
  max_speed_ms: a.maxSpeedMs,
  avg_hr: int(a.avgHr),
  max_hr: int(a.maxHr),
  avg_cadence: a.avgCadence,
  avg_power_w: a.avgPowerW,
  calories: int(a.calories),
  aerobic_te: a.aerobicTe,
  anaerobic_te: a.anaerobicTe,
  training_load: a.trainingLoad,
  hr_zone_seconds: a.hrZoneSeconds?.map((z) => Math.round(z)) ?? null,
  start_lat: a.startLat,
  start_lng: a.startLng,
  fetched_at: a.provenance.fetchedAt,
})

export const activityFromRow = (r: Row): Activity => ({
  id: r.id as string,
  sport: r.sport as Activity['sport'],
  subSport: r.sub_sport as string | null,
  name: r.name as string,
  startTime: r.start_time as string,
  durationS: r.duration_s as number,
  movingS: r.moving_s as number | null,
  distanceM: r.distance_m as number | null,
  elevationGainM: r.elevation_gain_m as number | null,
  elevationLossM: r.elevation_loss_m as number | null,
  avgSpeedMs: r.avg_speed_ms as number | null,
  maxSpeedMs: r.max_speed_ms as number | null,
  avgHr: r.avg_hr as number | null,
  maxHr: r.max_hr as number | null,
  avgCadence: r.avg_cadence as number | null,
  avgPowerW: r.avg_power_w as number | null,
  calories: r.calories as number | null,
  aerobicTe: r.aerobic_te as number | null,
  anaerobicTe: r.anaerobic_te as number | null,
  trainingLoad: r.training_load as number | null,
  hrZoneSeconds: r.hr_zone_seconds as Activity['hrZoneSeconds'],
  startLat: r.start_lat as number | null,
  startLng: r.start_lng as number | null,
  notes: null,
  provenance: prov(r),
})

export const detailToRow = (userId: string, activityId: string, d: ActivityDetail): Row => ({
  activity_id: activityId,
  user_id: userId,
  laps: d.laps,
  samples: d.samples,
  fetched_at: new Date().toISOString(),
})
