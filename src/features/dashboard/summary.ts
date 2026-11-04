import { addDays } from '@shared/dates.ts'
import { computeBaseline, compareWindows, seriesOf, sliceSeries, type Baseline, type DailyRecord, type MetricKey } from '@/analytics'

export interface MetricSummary {
  metric: MetricKey
  value: number | null
  /** Last `sparkDays` days, missing days as null. */
  spark: (number | null)[]
  /** Change of the 7-day mean versus the 7 days before. */
  deltaRatio: number | null
  baseline: Baseline | null
}

/** Everything a dashboard tile needs for one metric. All numbers come from the analytics module. */
export function summarizeMetric(records: readonly DailyRecord[], metric: MetricKey, today: string, sparkDays = 14): MetricSummary {
  const series = seriesOf(records, metric)
  const byDate = new Map(series.map((p) => [p.date, p.value]))
  const spark = Array.from({ length: sparkDays }, (_, i) => byDate.get(addDays(today, i - (sparkDays - 1))) ?? null)
  const current = { from: addDays(today, -6), to: today }
  const comparison = compareWindows(series, current, { from: addDays(today, -13), to: addDays(today, -7) })
  const hasEnough = comparison.current.samples >= 3 && comparison.previous.samples >= 3
  const value = sliceSeries(series, { from: addDays(today, -1), to: today }).reduce<number | null>((latest, p) => p.value ?? latest, null)
  return {
    metric,
    value,
    spark,
    deltaRatio: hasEnough ? comparison.deltaRatio : null,
    baseline: computeBaseline(series, today),
  }
}
