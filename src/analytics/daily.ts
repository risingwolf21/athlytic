import { addDays, eachDay } from '@shared/dates.ts'
import type { Activity, BodyComposition, DailyMetrics, NormalizedBundle, SleepSession, UserProfile } from '@shared/domain.ts'
import { activityLoad, computeLoadSeries, localDate, type LoadSource } from './load.ts'
import type { MetricKey } from './metrics.ts'
import { computeRecovery, type RecoveryEstimate } from './recovery.ts'
import type { DateString, Series } from './types.ts'
import { isNum } from './stats.ts'

/** One calendar day with every measured and calculated value the app shows. */
export interface DailyRecord {
  date: DateString
  steps: number | null
  restingHr: number | null
  hrv: number | null
  sleepHours: number | null
  sleepScore: number | null
  deepSleepPct: number | null
  avgStress: number | null
  bodyBatteryHigh: number | null
  bodyBatteryLow: number | null
  intensityMinutes: number | null
  floors: number | null
  activeKcal: number | null
  vo2Max: number | null
  spo2Avg: number | null
  respirationAvg: number | null
  hydrationMl: number | null
  /** Minutes in the device's "high stress" band. */
  highStressMin: number | null
  /** Calculated: sleep need minus actual sleep, in minutes. Positive means a deficit, never below 0. */
  sleepDebtMin: number | null
  sleepStress: number | null
  weightKg: number | null
  bodyFatPct: number | null
  /** Sum of the day's activity loads; 0 on rest days. */
  trainingLoad: number
  /** `provider` if every contributing load was reported by the device. */
  loadSource: LoadSource | null
  acuteLoad: number
  chronicLoad: number
  loadBalance: number
  recovery: number | null
  recoveryDetail: RecoveryEstimate | null
  distanceKm: number
  durationMin: number
  elevationGainM: number
  activityIds: string[]
  hasData: boolean
}

export interface AnalyticsInput {
  bundle: Pick<NormalizedBundle, 'daily' | 'sleep' | 'activities'> & Partial<Pick<NormalizedBundle, 'body'>>
  profile: Pick<UserProfile, 'maxHr'>
}

const scalar = (v: number | null) => (isNum(v) ? v : null)

/** Tonight's adjusted sleep need (device estimate) minus the sleep actually recorded; null when the device gave no need. */
export function sleepDebt(sleep: SleepSession | undefined): number | null {
  const need = sleep?.need
  const needed = need?.actualMin ?? need?.baselineMin
  if (!sleep || !isNum(needed)) return null
  return Math.max(0, needed - sleep.durationS / 60)
}

export function buildDailyRecords({ bundle, profile }: AnalyticsInput): DailyRecord[] {
  const dailyByDate = new Map<DateString, DailyMetrics>(bundle.daily.map((d) => [d.date, d]))
  const sleepByDate = new Map<DateString, SleepSession>(bundle.sleep.map((s) => [s.date, s]))
  const bodyByDate = new Map<DateString, BodyComposition>()
  for (const b of [...(bundle.body ?? [])].sort((a, c) => (a.measuredAt ?? '').localeCompare(c.measuredAt ?? ''))) bodyByDate.set(b.date, b)
  const activitiesByDate = new Map<DateString, Activity[]>()
  for (const a of bundle.activities) {
    const date = localDate(a.startTime)
    activitiesByDate.set(date, [...(activitiesByDate.get(date) ?? []), a])
  }

  const dates = [...dailyByDate.keys(), ...sleepByDate.keys(), ...activitiesByDate.keys(), ...bodyByDate.keys()].sort()
  const first = dates[0]
  const last = dates[dates.length - 1]
  if (!first || !last) return []
  const days = eachDay(first, last)

  const dayLoads = days.map((date) => {
    const acts = activitiesByDate.get(date) ?? []
    const loads = acts.map((a) => activityLoad(a, profile.maxHr)).filter((l): l is NonNullable<typeof l> => l !== null)
    return {
      total: loads.reduce((s, l) => s + l.value, 0),
      source: loads.length ? (loads.every((l) => l.source === 'provider') ? ('provider' as const) : ('estimated' as const)) : null,
    }
  })
  const load = computeLoadSeries(dayLoads.map((d) => d.total))

  const records: DailyRecord[] = days.map((date, i) => {
    const d = dailyByDate.get(date)
    const s = sleepByDate.get(date)
    const acts = activitiesByDate.get(date) ?? []
    const sleepHours = s ? s.durationS / 3600 : null
    const body = bodyByDate.get(date)
    const deepPct = s && s.deepS != null && s.durationS > 0 ? (s.deepS / s.durationS) * 100 : null
    return {
      date,
      steps: scalar(d?.steps ?? null),
      restingHr: scalar(d?.restingHr ?? null),
      hrv: scalar(d?.hrvLastNightAvg ?? null),
      sleepHours,
      sleepScore: scalar(s?.score ?? null),
      deepSleepPct: deepPct,
      avgStress: scalar(d?.avgStress ?? null),
      bodyBatteryHigh: scalar(d?.bodyBatteryHigh ?? null),
      bodyBatteryLow: scalar(d?.bodyBatteryLow ?? null),
      intensityMinutes: scalar(d?.intensityMinutes ?? null),
      floors: scalar(d?.floorsClimbed ?? null),
      activeKcal: scalar(d?.activeKcal ?? null),
      vo2Max: scalar(d?.vo2Max ?? null),
      spo2Avg: scalar(d?.spo2Avg ?? null),
      respirationAvg: scalar(d?.respirationAvg ?? null),
      hydrationMl: scalar(d?.hydrationMl ?? null),
      highStressMin: isNum(d?.stressHighS) ? d.stressHighS / 60 : null,
      sleepDebtMin: sleepDebt(s),
      sleepStress: scalar(s?.avgSleepStress ?? null),
      weightKg: scalar(body?.weightKg ?? null),
      bodyFatPct: scalar(body?.bodyFatPct ?? null),
      trainingLoad: (dayLoads[i] as { total: number }).total,
      loadSource: (dayLoads[i] as { source: LoadSource | null }).source,
      acuteLoad: load.acute[i] as number,
      chronicLoad: load.chronic[i] as number,
      loadBalance: load.balance[i] as number,
      recovery: null,
      recoveryDetail: null,
      distanceKm: acts.reduce((s2, a) => s2 + (a.distanceM ?? 0), 0) / 1000,
      durationMin: acts.reduce((s2, a) => s2 + a.durationS, 0) / 60,
      elevationGainM: acts.reduce((s2, a) => s2 + (a.elevationGainM ?? 0), 0),
      activityIds: acts.map((a) => a.id),
      hasData: !!d || !!s,
    }
  })

  const history = {
    hrv: records.map((r) => ({ date: r.date, value: r.hrv })),
    restingHr: records.map((r) => ({ date: r.date, value: r.restingHr })),
  }
  for (const r of records) {
    const estimate = computeRecovery(r, history)
    r.recovery = estimate?.score ?? null
    r.recoveryDetail = estimate
  }
  return records
}

export function seriesOf(records: readonly DailyRecord[], key: MetricKey): Series {
  return records.map((r) => ({ date: r.date, value: r[key] }))
}

export function recordOn(records: readonly DailyRecord[], date: DateString): DailyRecord | undefined {
  return records.find((r) => r.date === date)
}

/** Most recent date that has device data. */
export function latestDataDate(records: readonly DailyRecord[]): DateString | null {
  for (let i = records.length - 1; i >= 0; i--) if ((records[i] as DailyRecord).hasData) return (records[i] as DailyRecord).date
  return null
}

export function previousDay(date: DateString): DateString {
  return addDays(date, -1)
}
