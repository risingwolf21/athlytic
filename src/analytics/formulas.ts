import type { MetricKey } from './metrics.ts'
import type { ValueKind } from './types.ts'

export type FormulaId =
  | 'baseline'
  | 'deviation'
  | 'windowComparison'
  | 'recovery'
  | 'trainingLoad'
  | 'acuteChronic'
  | 'lagCorrelation'
  | 'personalRecord'

export interface FormulaDoc {
  id: FormulaId
  kind: ValueKind
  /** Language-neutral notation. Names and prose explanations are in the i18n files under `methods.<id>`. */
  formula: string
  inputs: MetricKey[]
}

/** Single source of truth for how every calculated number is produced. Mirrors docs/ANALYTICS.md. */
export const FORMULAS: Record<FormulaId, FormulaDoc> = {
  baseline: {
    id: 'baseline',
    kind: 'calculated',
    formula: 'median = median(x[d−28 … d−1]);  σ = max(1.4826 · MAD, 3 % · median);  normal range = median ± 1.5 σ  (≥ 10 values required)',
    inputs: ['restingHr', 'hrv', 'sleepHours', 'steps'],
  },
  deviation: {
    id: 'deviation',
    kind: 'calculated',
    formula: 'z = (x − median) / σ;   |z| > 1.5 → outside the personal normal range',
    inputs: ['restingHr', 'hrv', 'sleepHours', 'sleepScore', 'avgStress'],
  },
  windowComparison: {
    id: 'windowComparison',
    kind: 'calculated',
    formula: 'Δ = mean(last N days) − mean(N days before);  Δ% = Δ / |mean before|;  d = Δ / pooled SD;  trend if |Δ%| ≥ threshold and |d| ≥ 0.5 and coverage ≥ 60 %',
    inputs: ['restingHr', 'hrv', 'sleepHours', 'steps', 'avgStress', 'trainingLoad'],
  },
  recovery: {
    id: 'recovery',
    kind: 'calculated',
    formula:
      'score = Σ wᵢ·sᵢ / Σ wᵢ over available inputs;  HRV 30 % (50 + 25·z), resting HR 20 % (50 − 25·z), sleep 25 % (sleep score or hours/8·100), Body Battery 15 %, load balance 10 % (60 + 1.5·balance);  needs ≥ 40 % of weight',
    inputs: ['hrv', 'restingHr', 'sleepScore', 'sleepHours', 'bodyBatteryHigh', 'loadBalance'],
  },
  trainingLoad: {
    id: 'trainingLoad',
    kind: 'calculated',
    formula: 'activity load = device value, else 0.5 · Σ (minutes in HR zone z · z) (Edwards TRIMP);  day load = Σ activity loads',
    inputs: ['trainingLoad'],
  },
  acuteChronic: {
    id: 'acuteChronic',
    kind: 'calculated',
    formula: 'acute = EWMA₇(day load);  chronic = EWMA₄₂(day load);  balance = chronic − acute;  ratio = acute / chronic',
    inputs: ['acuteLoad', 'chronicLoad', 'loadBalance'],
  },
  lagCorrelation: {
    id: 'lagCorrelation',
    kind: 'calculated',
    formula: 'ρ = Spearman(x[d], y[d + lag]) over all complete day pairs (≥ 21);  p from Fisher z = atanh(ρ)·√(n − 3);  reported if |ρ| ≥ 0.3 and p ≤ 0.01',
    inputs: ['trainingLoad', 'hrv', 'restingHr', 'sleepHours', 'sleepScore', 'avgStress', 'steps'],
  },
  personalRecord: {
    id: 'personalRecord',
    kind: 'measured',
    formula: 'best single-activity or single-day value of a metric over all imported data',
    inputs: ['distanceKm', 'elevationGainM', 'steps', 'hrv', 'restingHr', 'sleepScore'],
  },
}
