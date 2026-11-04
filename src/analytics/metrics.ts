import type { Polarity, ValueKind } from './types.ts'

export const METRIC_KEYS = [
  'steps',
  'restingHr',
  'hrv',
  'sleepHours',
  'sleepScore',
  'deepSleepPct',
  'avgStress',
  'bodyBatteryHigh',
  'bodyBatteryLow',
  'intensityMinutes',
  'floors',
  'activeKcal',
  'vo2Max',
  'trainingLoad',
  'acuteLoad',
  'chronicLoad',
  'loadBalance',
  'recovery',
  'distanceKm',
  'durationMin',
  'elevationGainM',
] as const

export type MetricKey = (typeof METRIC_KEYS)[number]

export interface MetricDefinition {
  key: MetricKey
  kind: ValueKind
  unit: 'steps' | 'bpm' | 'ms' | 'h' | 'score' | 'percent' | 'min' | 'kcal' | 'floors' | 'ml/kg/min' | 'load' | 'km' | 'm'
  /** How daily values are combined into weeks/months/years. */
  aggregate: 'sum' | 'mean'
  polarity: Polarity
  decimals: number
  /** Smallest relative change (of the baseline) worth reporting as a trend. */
  trendThreshold: number
}

const def = (d: MetricDefinition) => d

export const METRICS: Record<MetricKey, MetricDefinition> = {
  steps: def({ key: 'steps', kind: 'measured', unit: 'steps', aggregate: 'mean', polarity: 'higher-better', decimals: 0, trendThreshold: 0.1 }),
  restingHr: def({ key: 'restingHr', kind: 'measured', unit: 'bpm', aggregate: 'mean', polarity: 'lower-better', decimals: 0, trendThreshold: 0.03 }),
  hrv: def({ key: 'hrv', kind: 'measured', unit: 'ms', aggregate: 'mean', polarity: 'higher-better', decimals: 0, trendThreshold: 0.07 }),
  sleepHours: def({ key: 'sleepHours', kind: 'measured', unit: 'h', aggregate: 'mean', polarity: 'higher-better', decimals: 1, trendThreshold: 0.05 }),
  sleepScore: def({ key: 'sleepScore', kind: 'measured', unit: 'score', aggregate: 'mean', polarity: 'higher-better', decimals: 0, trendThreshold: 0.05 }),
  deepSleepPct: def({ key: 'deepSleepPct', kind: 'calculated', unit: 'percent', aggregate: 'mean', polarity: 'higher-better', decimals: 0, trendThreshold: 0.1 }),
  avgStress: def({ key: 'avgStress', kind: 'measured', unit: 'score', aggregate: 'mean', polarity: 'lower-better', decimals: 0, trendThreshold: 0.1 }),
  bodyBatteryHigh: def({ key: 'bodyBatteryHigh', kind: 'measured', unit: 'score', aggregate: 'mean', polarity: 'higher-better', decimals: 0, trendThreshold: 0.07 }),
  bodyBatteryLow: def({ key: 'bodyBatteryLow', kind: 'measured', unit: 'score', aggregate: 'mean', polarity: 'higher-better', decimals: 0, trendThreshold: 0.1 }),
  intensityMinutes: def({ key: 'intensityMinutes', kind: 'measured', unit: 'min', aggregate: 'sum', polarity: 'higher-better', decimals: 0, trendThreshold: 0.15 }),
  floors: def({ key: 'floors', kind: 'measured', unit: 'floors', aggregate: 'sum', polarity: 'neutral', decimals: 0, trendThreshold: 0.15 }),
  activeKcal: def({ key: 'activeKcal', kind: 'measured', unit: 'kcal', aggregate: 'mean', polarity: 'neutral', decimals: 0, trendThreshold: 0.1 }),
  vo2Max: def({ key: 'vo2Max', kind: 'measured', unit: 'ml/kg/min', aggregate: 'mean', polarity: 'higher-better', decimals: 1, trendThreshold: 0.02 }),
  trainingLoad: def({ key: 'trainingLoad', kind: 'calculated', unit: 'load', aggregate: 'sum', polarity: 'neutral', decimals: 0, trendThreshold: 0.15 }),
  acuteLoad: def({ key: 'acuteLoad', kind: 'calculated', unit: 'load', aggregate: 'mean', polarity: 'neutral', decimals: 0, trendThreshold: 0.15 }),
  chronicLoad: def({ key: 'chronicLoad', kind: 'calculated', unit: 'load', aggregate: 'mean', polarity: 'higher-better', decimals: 0, trendThreshold: 0.1 }),
  loadBalance: def({ key: 'loadBalance', kind: 'calculated', unit: 'load', aggregate: 'mean', polarity: 'neutral', decimals: 0, trendThreshold: 0.2 }),
  recovery: def({ key: 'recovery', kind: 'calculated', unit: 'score', aggregate: 'mean', polarity: 'higher-better', decimals: 0, trendThreshold: 0.08 }),
  distanceKm: def({ key: 'distanceKm', kind: 'calculated', unit: 'km', aggregate: 'sum', polarity: 'neutral', decimals: 1, trendThreshold: 0.15 }),
  durationMin: def({ key: 'durationMin', kind: 'calculated', unit: 'min', aggregate: 'sum', polarity: 'neutral', decimals: 0, trendThreshold: 0.15 }),
  elevationGainM: def({ key: 'elevationGainM', kind: 'calculated', unit: 'm', aggregate: 'sum', polarity: 'neutral', decimals: 0, trendThreshold: 0.15 }),
}

export const isMetricKey = (value: string | undefined): value is MetricKey => !!value && value in METRICS
