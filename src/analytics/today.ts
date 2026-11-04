import { addDays } from '@shared/dates.ts'
import type { IntradayMetric, IntradaySeries } from '@shared/domain.ts'
import { isNum, mean } from './stats.ts'
import type { DateString } from './types.ts'

export const DEFAULT_AVERAGE_WINDOW_DAYS = 28
const MIN_AVERAGE_SAMPLES = 5

export interface WindowAverage {
  average: number | null
  samples: number
  window: { from: DateString; to: DateString }
}

/** Mean of `pick` over the `windowDays` days before `date` (the day itself is excluded). Null with fewer than 5 values. */
export function windowAverage<T extends { date: DateString }>(
  items: readonly T[],
  date: DateString,
  pick: (item: T) => number | null | undefined,
  windowDays = DEFAULT_AVERAGE_WINDOW_DAYS,
): WindowAverage {
  const from = addDays(date, -windowDays)
  const to = addDays(date, -1)
  const values = items.filter((i) => i.date >= from && i.date <= to).map(pick).filter(isNum)
  return { average: values.length >= MIN_AVERAGE_SAMPLES ? mean(values) : null, samples: values.length, window: { from, to } }
}

export interface AverageComparison {
  value: number
  average: number | null
  delta: number | null
  /** delta / average; null when the average is 0 or unavailable. */
  deltaRatio: number | null
  samples: number
}

export function compareToAverage(value: number | null | undefined, avg: WindowAverage): AverageComparison | null {
  if (!isNum(value)) return null
  const delta = avg.average === null ? null : value - avg.average
  return { value, average: avg.average, delta, deltaRatio: delta !== null && avg.average ? delta / Math.abs(avg.average) : null, samples: avg.samples }
}

/** Latest intraday series of a metric on or before `date`. */
export function latestIntraday(series: readonly IntradaySeries[], metric: IntradayMetric, date: DateString): IntradaySeries | null {
  let best: IntradaySeries | null = null
  for (const s of series) {
    if (s.metric === metric && s.date <= date && s.points.length > 0 && (!best || s.date > best.date)) best = s
  }
  return best
}

export interface IntradayStats {
  /** Most recent reading. */
  last: { at: number; value: number }
  min: number
  max: number
}

export function intradayStats(points: readonly [number, number][]): IntradayStats | null {
  if (points.length === 0) return null
  let last = points[0] as [number, number]
  let min = last[1]
  let max = last[1]
  for (const p of points) {
    if (p[0] > last[0]) last = p
    min = Math.min(min, p[1])
    max = Math.max(max, p[1])
  }
  return { last: { at: last[0], value: last[1] }, min, max }
}

/** Reduces a series to one value per hour (the last reading in each hour), for sparklines. */
export function hourlyValues(points: readonly [number, number][], hours = 24): (number | null)[] {
  if (points.length === 0) return []
  const lastAt = Math.max(...points.map((p) => p[0]))
  const buckets = new Map<number, number>()
  for (const [at, value] of [...points].sort((a, b) => a[0] - b[0])) buckets.set(Math.floor(at / 3600), value)
  const lastHour = Math.floor(lastAt / 3600)
  return Array.from({ length: hours }, (_, i) => buckets.get(lastHour - (hours - 1) + i) ?? null)
}
