import { addDays, daysBetween, eachDay, formatDate, isoWeekday, parseDate } from '@shared/dates.ts'
import type { DateString, DateWindow, Granularity, Series } from './types.ts'
import { clean, isNum, max, mean, min, sum } from './stats.ts'

export type Aggregate = 'sum' | 'mean' | 'max' | 'min'

export interface Bucket {
  /** First day of the bucket. */
  start: DateString
  end: DateString
  value: number | null
  /** Days with a measurement. */
  samples: number
  /** Days the bucket spans (clipped to the requested window). */
  expected: number
  /** samples / expected. Buckets with low coverage are estimates, not facts. */
  coverage: number
}

export function bucketStart(date: DateString, granularity: Granularity): DateString {
  switch (granularity) {
    case 'day':
      return date
    case 'week':
      return addDays(date, -isoWeekday(date))
    case 'month':
      return `${date.slice(0, 7)}-01`
    case 'year':
      return `${date.slice(0, 4)}-01-01`
  }
}

export function bucketEnd(start: DateString, granularity: Granularity): DateString {
  switch (granularity) {
    case 'day':
      return start
    case 'week':
      return addDays(start, 6)
    case 'month': {
      const d = new Date(parseDate(start))
      return formatDate(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    }
    case 'year':
      return `${start.slice(0, 4)}-12-31`
  }
}

const reduce = (values: number[], aggregate: Aggregate): number | null => {
  if (!values.length) return null
  switch (aggregate) {
    case 'sum':
      return sum(values)
    case 'mean':
      return mean(values)
    case 'max':
      return max(values)
    case 'min':
      return min(values)
  }
}

/**
 * Groups a daily series into calendar buckets within `window`. Empty buckets stay in the output with
 * `value: null` so charts show real gaps instead of silently connecting over missing data.
 * For `sum`, missing days count as zero only for metrics where "no record" means "nothing happened"
 * (pass `fillMissingWithZero`); otherwise the sum covers measured days only and `coverage` tells how much is missing.
 */
export function bucketize(
  series: Series,
  window: DateWindow,
  granularity: Granularity,
  aggregate: Aggregate,
  options: { fillMissingWithZero?: boolean } = {},
): Bucket[] {
  const byDate = new Map(series.map((p) => [p.date, p.value]))
  const buckets = new Map<DateString, { values: number[]; days: number }>()
  for (const date of eachDay(window.from, window.to)) {
    const key = bucketStart(date, granularity)
    const entry = buckets.get(key) ?? { values: [], days: 0 }
    entry.days++
    const v = byDate.get(date)
    if (isNum(v)) entry.values.push(v)
    else if (options.fillMissingWithZero) entry.values.push(0)
    buckets.set(key, entry)
  }
  return [...buckets.entries()].map(([start, { values, days }]) => {
    const measured = options.fillMissingWithZero ? values.length : clean(values).length
    return {
      start,
      end: bucketEnd(start, granularity),
      value: reduce(values, aggregate),
      samples: measured,
      expected: days,
      coverage: days ? measured / days : 0,
    }
  })
}

export function windowOf(granularity: Granularity, anchor: DateString, count: number): DateWindow {
  const start = bucketStart(anchor, granularity)
  switch (granularity) {
    case 'day':
      return { from: addDays(anchor, -(count - 1)), to: anchor }
    case 'week':
      return { from: addDays(start, -7 * (count - 1)), to: anchor }
    case 'month': {
      const d = new Date(parseDate(start))
      return { from: formatDate(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - (count - 1), 1)), to: anchor }
    }
    case 'year':
      return { from: `${Number(start.slice(0, 4)) - (count - 1)}-01-01`, to: anchor }
  }
}

export function windowLength(window: DateWindow): number {
  return daysBetween(window.from, window.to) + 1
}

/** The window of equal length directly before `window`. */
export function previousWindow(window: DateWindow): DateWindow {
  const len = windowLength(window)
  return { from: addDays(window.from, -len), to: addDays(window.from, -1) }
}

export function sliceSeries(series: Series, window: DateWindow): Series {
  return series.filter((p) => p.date >= window.from && p.date <= window.to)
}
