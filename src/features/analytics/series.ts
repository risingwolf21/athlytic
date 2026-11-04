import { addDays } from '@shared/dates.ts'
import {
  METRICS,
  bucketize,
  clean,
  compareWindows,
  previousWindow,
  seriesOf,
  sliceSeries,
  windowLength,
  windowOf,
  type DailyRecord,
  type DateWindow,
  type Granularity,
  type MetricKey,
} from '@/analytics'
import type { TrendPoint } from '@/components/charts/TrendChart'

/** Metrics where a day without a record means "nothing happened" rather than "not measured". */
const ZERO_FILLED: ReadonlySet<MetricKey> = new Set(['trainingLoad', 'distanceKm', 'durationMin', 'elevationGainM'])

/** How many buckets of each granularity the Analytics page shows. */
export const PERIOD_COUNT: Record<Granularity, number> = { day: 30, week: 12, month: 12, year: 5 }

export function periodWindow(today: string, granularity: Granularity): DateWindow {
  return windowOf(granularity, today, PERIOD_COUNT[granularity])
}

export function windowEndingAt(today: string, days: number): DateWindow {
  return { from: addDays(today, -(days - 1)), to: today }
}

export function trendPoints(records: readonly DailyRecord[], metric: MetricKey, window: DateWindow, granularity: Granularity): TrendPoint[] {
  return bucketize(seriesOf(records, metric), window, granularity, METRICS[metric].aggregate, { fillMissingWithZero: ZERO_FILLED.has(metric) }).map((b) => ({
    date: b.start,
    value: b.value,
    coverage: b.coverage,
  }))
}

/** Values of the window before `window`, aligned by position (from the end) with the current buckets. */
export function comparePoints(records: readonly DailyRecord[], metric: MetricKey, window: DateWindow, granularity: Granularity, length: number): (number | null)[] {
  const previous = trendPoints(records, metric, previousWindow(window), granularity).map((p) => p.value)
  const padded = [...Array<number | null>(Math.max(0, length - previous.length)).fill(null), ...previous]
  return padded.slice(padded.length - length)
}

export interface PeriodStat {
  metric: MetricKey
  current: number | null
  previous: number | null
  deltaRatio: number | null
  /** Share of days with data in the current window. */
  coverage: number
  min: number | null
  max: number | null
}

/** Total for sum metrics, mean otherwise, for the window and the equally long window before it. */
export function periodStat(records: readonly DailyRecord[], metric: MetricKey, window: DateWindow): PeriodStat {
  const series = seriesOf(records, metric)
  const comparison = compareWindows(series, window)
  const isSum = METRICS[metric].aggregate === 'sum'
  const total = (w: DateWindow) => {
    const values = clean(sliceSeries(series, w).map((p) => p.value))
    return values.length ? values.reduce((a, b) => a + b, 0) : null
  }
  const current = isSum ? total(window) : comparison.current.mean
  const previous = isSum ? total(previousWindow(window)) : comparison.previous.mean
  const values = clean(sliceSeries(series, window).map((p) => p.value))
  const covered = ZERO_FILLED.has(metric) ? 1 : comparison.current.samples / windowLength(window)
  return {
    metric,
    current,
    previous,
    deltaRatio: current !== null && previous !== null && previous !== 0 ? (current - previous) / Math.abs(previous) : null,
    coverage: covered,
    min: values.length ? Math.min(...values) : null,
    max: values.length ? Math.max(...values) : null,
  }
}
