import type { DateWindow, Series } from './types.ts'
import { clean, mean, stdev } from './stats.ts'
import { previousWindow, sliceSeries, windowLength } from './aggregate.ts'

export interface WindowSummary {
  window: DateWindow
  mean: number | null
  samples: number
  coverage: number
}

export interface WindowComparison {
  current: WindowSummary
  previous: WindowSummary
  /** current − previous (in metric units). */
  delta: number | null
  /** delta relative to |previous|. */
  deltaRatio: number | null
  /** Cohen's d with the pooled SD of both windows — how large the change is relative to normal day-to-day variation. */
  effectSize: number | null
}

export function summarizeWindow(series: Series, window: DateWindow): WindowSummary {
  const values = clean(sliceSeries(series, window).map((p) => p.value))
  return { window, mean: mean(values), samples: values.length, coverage: values.length / windowLength(window) }
}

/** Compares the mean of `window` with the mean of the window of equal length right before it (or an explicit `against`). */
export function compareWindows(series: Series, window: DateWindow, against: DateWindow = previousWindow(window)): WindowComparison {
  const current = summarizeWindow(series, window)
  const previous = summarizeWindow(series, against)
  const delta = current.mean !== null && previous.mean !== null ? current.mean - previous.mean : null
  const deltaRatio = delta !== null && previous.mean ? delta / Math.abs(previous.mean) : null

  const a = clean(sliceSeries(series, window).map((p) => p.value))
  const b = clean(sliceSeries(series, against).map((p) => p.value))
  let effectSize: number | null = null
  if (a.length >= 3 && b.length >= 3 && delta !== null) {
    const sa = stdev(a) as number
    const sb = stdev(b) as number
    const pooled = Math.sqrt(((a.length - 1) * sa ** 2 + (b.length - 1) * sb ** 2) / (a.length + b.length - 2))
    effectSize = pooled > 0 ? delta / pooled : null
  }
  return { current, previous, delta, deltaRatio, effectSize }
}

export type TrendDirection = 'up' | 'down' | 'flat'

/**
 * A change is only called a trend if it is both large enough to matter (`minRatio`) and clearly larger than
 * the usual day-to-day variation (|d| ≥ 0.5), based on enough data in both windows.
 */
export function classifyTrend(
  comparison: WindowComparison,
  options: { minRatio: number; minCoverage?: number; minEffectSize?: number },
): TrendDirection | null {
  const { minRatio, minCoverage = 0.6, minEffectSize = 0.5 } = options
  if (comparison.current.coverage < minCoverage || comparison.previous.coverage < minCoverage) return null
  if (comparison.deltaRatio === null || comparison.effectSize === null) return null
  if (Math.abs(comparison.deltaRatio) < minRatio || Math.abs(comparison.effectSize) < minEffectSize) return 'flat'
  return comparison.deltaRatio > 0 ? 'up' : 'down'
}
