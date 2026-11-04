import { clamp } from '@shared/prng.ts'
import type { Activity } from '@shared/domain.ts'
import { ewma, isNum, mean, sum } from './stats.ts'

/** Scale that maps Edwards TRIMP (zone-weighted minutes) onto a Garmin-like load number. */
export const EDWARDS_TO_LOAD = 0.5

/** Upper HR-zone boundaries as fraction of max HR: Z1 <60 %, Z2 <70 %, Z3 <80 %, Z4 <90 %, Z5 ≥90 %. */
export const ZONE_LOWER_BOUNDS = [0.5, 0.6, 0.7, 0.8, 0.9] as const

export type LoadSource = 'provider' | 'estimated'

export interface ActivityLoad {
  value: number
  source: LoadSource
}

export function zoneOfHeartRate(hr: number, maxHr: number): 0 | 1 | 2 | 3 | 4 | null {
  const pct = hr / maxHr
  if (pct < ZONE_LOWER_BOUNDS[0]) return null
  if (pct < ZONE_LOWER_BOUNDS[1]) return 0
  if (pct < ZONE_LOWER_BOUNDS[2]) return 1
  if (pct < ZONE_LOWER_BOUNDS[3]) return 2
  if (pct < ZONE_LOWER_BOUNDS[4]) return 3
  return 4
}

/** Edwards TRIMP = Σ (minutes in zone z × z), z = 1..5. */
export function edwardsTrimp(zoneSeconds: readonly number[]): number {
  return zoneSeconds.reduce((acc, seconds, z) => acc + (seconds / 60) * (z + 1), 0)
}

/**
 * Load of one activity. Prefers the value reported by the device; otherwise estimates it from HR zones,
 * or — least precise — from average HR and duration.
 */
export function activityLoad(activity: Activity, maxHr: number): ActivityLoad | null {
  if (isNum(activity.trainingLoad)) return { value: activity.trainingLoad, source: 'provider' }
  if (activity.hrZoneSeconds) return { value: edwardsTrimp(activity.hrZoneSeconds) * EDWARDS_TO_LOAD, source: 'estimated' }
  if (isNum(activity.avgHr)) {
    const zone = zoneOfHeartRate(activity.avgHr, maxHr)
    if (zone === null) return { value: 0, source: 'estimated' }
    return { value: (activity.durationS / 60) * (zone + 1) * EDWARDS_TO_LOAD, source: 'estimated' }
  }
  return null
}

export function localDate(startTime: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(startTime))
}

export interface LoadSeries {
  daily: number[]
  acute: number[]
  chronic: number[]
  balance: number[]
}

/**
 * Acute (7-day) and chronic (42-day) exponentially weighted load; balance = chronic − acute.
 * Both averages start at the mean daily load of the first 28 days so the warm-up period is not biased towards zero.
 */
export function computeLoadSeries(dailyLoad: number[], acuteDays = 7, chronicDays = 42): LoadSeries {
  const seed = mean(dailyLoad.slice(0, 28)) ?? 0
  const acute = ewma(dailyLoad, acuteDays, seed)
  const chronic = ewma(dailyLoad, chronicDays, seed)
  return { daily: dailyLoad, acute, chronic, balance: chronic.map((c, i) => c - (acute[i] as number)) }
}

/** Acute:chronic workload ratio. Values above ~1.5 mean the recent load is much higher than what the body is used to. */
export function acuteChronicRatio(acute: number, chronic: number): number | null {
  return chronic > 1 ? acute / chronic : null
}

export function weeklyLoad(dailyLoad: number[]): number {
  return sum(dailyLoad.slice(-7))
}

export const clampScore = (v: number) => clamp(v, 0, 100)
