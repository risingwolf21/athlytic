import { addDays } from '@shared/dates.ts'
import type { Series } from './types.ts'
import { correlationPValue, isNum, spearman } from './stats.ts'

export type CorrelationStrength = 'weak' | 'moderate' | 'strong'

export interface CorrelationResult {
  /** Spearman rank correlation, −1…1. */
  rho: number
  pairs: number
  /** Approximate two-sided p-value (Fisher z). Small values mean "unlikely to be pure chance", not "proven". */
  pValue: number | null
  lagDays: number
  strength: CorrelationStrength
  /** The actual (x, y) pairs used — kept so every correlation can be traced back to the data. */
  points: { xDate: string; yDate: string; x: number; y: number }[]
}

export const strengthOf = (rho: number): CorrelationStrength => {
  const a = Math.abs(rho)
  return a >= 0.6 ? 'strong' : a >= 0.4 ? 'moderate' : 'weak'
}

/**
 * Pairs x on day d with y on day d + lagDays and computes the Spearman correlation.
 * Needs at least `minPairs` complete pairs; returns null otherwise.
 */
export function lagCorrelation(x: Series, y: Series, lagDays: number, minPairs = 21): CorrelationResult | null {
  const yByDate = new Map(y.map((p) => [p.date, p.value]))
  const points: CorrelationResult['points'] = []
  for (const p of x) {
    if (!isNum(p.value)) continue
    const yDate = addDays(p.date, lagDays)
    const yv = yByDate.get(yDate)
    if (isNum(yv)) points.push({ xDate: p.date, yDate, x: p.value, y: yv })
  }
  if (points.length < minPairs) return null
  const rho = spearman(points.map((p) => p.x), points.map((p) => p.y))
  if (rho === null) return null
  return { rho, pairs: points.length, pValue: correlationPValue(rho, points.length), lagDays, strength: strengthOf(rho), points }
}

/** A correlation worth mentioning: not tiny and unlikely to be noise. This still says nothing about causation. */
export const isNoteworthy = (c: CorrelationResult, minAbsRho = 0.3, maxP = 0.01) =>
  Math.abs(c.rho) >= minAbsRho && c.pValue !== null && c.pValue <= maxP
