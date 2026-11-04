import { Activity, BatteryMedium, Bed, Droplets, Flame, Footprints, Gauge, HeartPulse, Mountain, Percent, Route, Scale, Timer, TrendingUp, Waves, Wind, Zap, type LucideIcon } from 'lucide-react'
import type { MetricKey } from '@/analytics'

export interface MetricStyle {
  /** CSS color expression usable in both HTML and SVG. */
  color: string
  icon: LucideIcon
}

export const METRIC_STYLE: Record<MetricKey, MetricStyle> = {
  steps: { color: 'var(--m-steps)', icon: Footprints },
  restingHr: { color: 'var(--m-hr)', icon: HeartPulse },
  hrv: { color: 'var(--m-hrv)', icon: Activity },
  sleepHours: { color: 'var(--m-sleep)', icon: Bed },
  sleepScore: { color: 'var(--m-sleep)', icon: Bed },
  deepSleepPct: { color: 'var(--m-sleep)', icon: Bed },
  avgStress: { color: 'var(--m-stress)', icon: Waves },
  bodyBatteryHigh: { color: 'var(--m-battery)', icon: BatteryMedium },
  bodyBatteryLow: { color: 'var(--m-battery)', icon: BatteryMedium },
  intensityMinutes: { color: 'var(--m-load)', icon: Timer },
  floors: { color: 'var(--m-elevation)', icon: Mountain },
  activeKcal: { color: 'var(--m-hr)', icon: Flame },
  vo2Max: { color: 'var(--m-hrv)', icon: Gauge },
  trainingLoad: { color: 'var(--m-load)', icon: Zap },
  acuteLoad: { color: 'var(--m-load)', icon: Zap },
  chronicLoad: { color: 'var(--m-load)', icon: TrendingUp },
  loadBalance: { color: 'var(--m-load)', icon: TrendingUp },
  recovery: { color: 'var(--m-recovery)', icon: HeartPulse },
  distanceKm: { color: 'var(--m-steps)', icon: Route },
  durationMin: { color: 'var(--m-load)', icon: Timer },
  elevationGainM: { color: 'var(--m-elevation)', icon: Mountain },
  spo2Avg: { color: 'var(--m-hr)', icon: Droplets },
  respirationAvg: { color: 'var(--m-battery)', icon: Wind },
  hydrationMl: { color: 'var(--m-steps)', icon: Droplets },
  highStressMin: { color: 'var(--m-stress)', icon: Waves },
  sleepDebtMin: { color: 'var(--m-sleep)', icon: Bed },
  sleepStress: { color: 'var(--m-stress)', icon: Waves },
  weightKg: { color: 'var(--m-recovery)', icon: Scale },
  bodyFatPct: { color: 'var(--m-recovery)', icon: Percent },
}

/** Metrics offered in the Analytics page selector, in display order. */
export const ANALYTICS_METRICS: MetricKey[] = ['steps', 'restingHr', 'hrv', 'sleepHours', 'sleepScore', 'avgStress', 'bodyBatteryHigh', 'trainingLoad', 'recovery', 'distanceKm', 'elevationGainM', 'vo2Max', 'spo2Avg', 'respirationAvg', 'highStressMin', 'sleepDebtMin', 'hydrationMl', 'weightKg', 'bodyFatPct']
