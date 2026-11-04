import { addDays } from '@shared/dates.ts'
import type { DateString, Series } from './types.ts'
import { clean, isNum, mad, median } from './stats.ts'

export interface BaselineOptions {
  /** Number of days before the reference day that form the baseline. */
  windowDays: number
  /** Minimum number of measurements; with fewer the baseline is reported as unavailable. */
  minSamples: number
  /** Floor for the spread, as fraction of the median, so very stable metrics do not produce absurd z-scores. */
  minSpreadRatio: number
}

export const DEFAULT_BASELINE: BaselineOptions = { windowDays: 28, minSamples: 10, minSpreadRatio: 0.03 }

export interface Baseline {
  median: number
  /** Robust standard deviation estimate: 1.4826 × MAD. */
  spread: number
  /** Normal range: median ± 1.5 × spread. */
  low: number
  high: number
  samples: number
  window: { from: DateString; to: DateString }
}

/** Baseline over the `windowDays` days *before* `referenceDate` (the reference day itself is excluded). */
export function computeBaseline(series: Series, referenceDate: DateString, options: BaselineOptions = DEFAULT_BASELINE): Baseline | null {
  const from = addDays(referenceDate, -options.windowDays)
  const to = addDays(referenceDate, -1)
  const values = clean(series.filter((p) => p.date >= from && p.date <= to).map((p) => p.value))
  if (values.length < options.minSamples) return null
  const med = median(values) as number
  const spread = Math.max(1.4826 * (mad(values) ?? 0), Math.abs(med) * options.minSpreadRatio, 1e-6)
  return { median: med, spread, low: med - 1.5 * spread, high: med + 1.5 * spread, samples: values.length, window: { from, to } }
}

export type DeviationStatus = 'within' | 'above' | 'below' | 'unknown'

export interface Deviation {
  value: number
  z: number
  status: DeviationStatus
  baseline: Baseline
}

/** Robust z-score of a value against a baseline; |z| > 1.5 is outside the personal normal range. */
export function deviationFromBaseline(value: number | null | undefined, baseline: Baseline | null): Deviation | null {
  if (!isNum(value) || !baseline) return null
  const z = (value - baseline.median) / baseline.spread
  return { value, z, status: z > 1.5 ? 'above' : z < -1.5 ? 'below' : 'within', baseline }
}

/** Latest data point at or before `date` that has a value. */
export function latestValue(series: Series, date: DateString): { date: DateString; value: number } | null {
  for (let i = series.length - 1; i >= 0; i--) {
    const p = series[i] as Series[number]
    if (p.date <= date && isNum(p.value)) return { date: p.date, value: p.value }
  }
  return null
}
