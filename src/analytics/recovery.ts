import { clamp } from '@shared/prng.ts'
import { computeBaseline, deviationFromBaseline, type BaselineOptions, DEFAULT_BASELINE } from './baseline.ts'
import { isNum } from './stats.ts'
import type { DataPoint, DateString, Series } from './types.ts'

export type RecoveryComponentKey = 'hrv' | 'restingHr' | 'sleep' | 'bodyBattery' | 'loadBalance'

export interface RecoveryComponent {
  key: RecoveryComponentKey
  /** 0–100 sub-score. */
  score: number
  weight: number
  /** The measurement behind the sub-score. */
  input: number
}

export interface RecoveryEstimate {
  /** 0–100, an Athlytic estimate — not a device-reported value. */
  score: number
  components: RecoveryComponent[]
  /** Share of the full weight that was available (1 = all inputs present). */
  completeness: number
}

export interface RecoveryInputs {
  date: DateString
  hrv: number | null
  restingHr: number | null
  sleepScore: number | null
  sleepHours: number | null
  bodyBatteryHigh: number | null
  loadBalance: number | null
}

export interface RecoverySeriesInput {
  hrv: Series
  restingHr: Series
}

export const RECOVERY_WEIGHTS: Record<RecoveryComponentKey, number> = {
  hrv: 0.3,
  restingHr: 0.2,
  sleep: 0.25,
  bodyBattery: 0.15,
  loadBalance: 0.1,
}

const SLEEP_TARGET_HOURS = 8
const MIN_COMPLETENESS = 0.4

/** z = +2 → 100, z = 0 → 50, z = −2 → 0. */
const zToScore = (z: number) => clamp(50 + 25 * z, 0, 100)

/**
 * Recovery estimate = weighted mean of available sub-scores (weights renormalised to the inputs that exist).
 * HRV and resting HR are judged against the personal 28-day baseline, not against population norms.
 * Returns null when less than 40 % of the weight is available.
 */
export function computeRecovery(
  inputs: RecoveryInputs,
  history: RecoverySeriesInput,
  options: BaselineOptions = DEFAULT_BASELINE,
): RecoveryEstimate | null {
  const components: RecoveryComponent[] = []

  const hrvDev = deviationFromBaseline(inputs.hrv, computeBaseline(history.hrv, inputs.date, options))
  if (hrvDev) components.push({ key: 'hrv', score: zToScore(hrvDev.z), weight: RECOVERY_WEIGHTS.hrv, input: hrvDev.value })

  const rhrDev = deviationFromBaseline(inputs.restingHr, computeBaseline(history.restingHr, inputs.date, options))
  if (rhrDev) components.push({ key: 'restingHr', score: zToScore(-rhrDev.z), weight: RECOVERY_WEIGHTS.restingHr, input: rhrDev.value })

  if (isNum(inputs.sleepScore)) {
    components.push({ key: 'sleep', score: clamp(inputs.sleepScore, 0, 100), weight: RECOVERY_WEIGHTS.sleep, input: inputs.sleepScore })
  } else if (isNum(inputs.sleepHours)) {
    components.push({ key: 'sleep', score: clamp((inputs.sleepHours / SLEEP_TARGET_HOURS) * 100, 0, 100), weight: RECOVERY_WEIGHTS.sleep, input: inputs.sleepHours })
  }

  if (isNum(inputs.bodyBatteryHigh)) {
    components.push({ key: 'bodyBattery', score: clamp(inputs.bodyBatteryHigh, 0, 100), weight: RECOVERY_WEIGHTS.bodyBattery, input: inputs.bodyBatteryHigh })
  }

  if (isNum(inputs.loadBalance)) {
    components.push({ key: 'loadBalance', score: clamp(60 + inputs.loadBalance * 1.5, 0, 100), weight: RECOVERY_WEIGHTS.loadBalance, input: inputs.loadBalance })
  }

  const totalWeight = components.reduce((s, c) => s + c.weight, 0)
  if (totalWeight < MIN_COMPLETENESS) return null
  const score = components.reduce((s, c) => s + c.score * c.weight, 0) / totalWeight
  return { score: Math.round(score), components, completeness: totalWeight }
}

export const toPoint = (date: DateString, value: number | null): DataPoint => ({ date, value })
