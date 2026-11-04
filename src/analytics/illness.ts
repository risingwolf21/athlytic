import { addDays } from '@shared/dates.ts'
import { DEFAULT_BASELINE, computeBaseline, type BaselineOptions } from './baseline.ts'
import { recordOn, seriesOf, type DailyRecord } from './daily.ts'
import { acuteChronicRatio } from './load.ts'
import type { MetricKey } from './metrics.ts'
import { isNum } from './stats.ts'
import type { DateString } from './types.ts'

/**
 * Early-warning pattern: several physiological signals moving the way they typically do around an
 * infection, for several days in a row, relative to the person's own baseline.
 * This is a heuristic derived from published wearable studies, not a diagnosis (see docs/ANALYTICS.md).
 */
export type IllnessSignalMetric = 'restingHr' | 'hrv' | 'respirationAvg' | 'spo2Avg'

export const ILLNESS_SIGNALS: { metric: IllnessSignalMetric; /** Direction of change that counts as unfavourable. */ direction: 'up' | 'down' }[] = [
  { metric: 'restingHr', direction: 'up' },
  { metric: 'hrv', direction: 'down' },
  { metric: 'respirationAvg', direction: 'up' },
  { metric: 'spo2Avg', direction: 'down' },
]

export interface IllnessOptions {
  baseline: BaselineOptions
  /** A signal counts when its unfavourable z-score reaches this value. */
  signalZ: number
  /** A day counts when at least this many signals count … */
  minSignals: number
  /** … and at least one of them reaches this stronger threshold. */
  strongZ: number
  /** Consecutive flagged days needed before the pattern is reported. */
  persistenceDays: number
  /** Days of history scanned for past episodes. */
  historyDays: number
}

export const DEFAULT_ILLNESS_OPTIONS: IllnessOptions = {
  baseline: DEFAULT_BASELINE,
  signalZ: 1.5,
  minSignals: 2,
  strongZ: 2,
  persistenceDays: 2,
  historyDays: 365,
}

export interface IllnessSignalReading {
  metric: IllnessSignalMetric
  value: number
  median: number
  /** Robust z-score, signed so that positive always means "in the unfavourable direction". */
  unfavourableZ: number
  flagged: boolean
}

export interface IllnessDay {
  date: DateString
  /** Only signals with a value and a baseline on this day. */
  signals: IllnessSignalReading[]
  flaggedCount: number
  flagged: boolean
}

export type IllnessState =
  /** Fewer than two signals have a usable baseline. */
  | 'insufficient'
  | 'normal'
  /** Some signals unusual, but not enough or not long enough to report a pattern. */
  | 'watch'
  | 'pattern'

export type IllnessConfounder = 'highLoad' | 'sleepDebt' | 'highStress'

export interface IllnessEpisode {
  from: DateString
  to: DateString
  days: number
}

export interface IllnessAssessment {
  state: IllnessState
  /** The day the state refers to (latest day with enough data). */
  date: DateString | null
  day: IllnessDay | null
  /** Consecutive flagged days ending on `date`. */
  streak: number
  /** Last days, oldest first, for display. */
  recent: IllnessDay[]
  /** Other plausible explanations that apply right now. */
  confounders: IllnessConfounder[]
  /** Past runs of flagged days (≥ persistenceDays) in the scanned history, oldest first. */
  episodes: IllnessEpisode[]
  historyDays: number
}

export function illnessDay(records: readonly DailyRecord[], date: DateString, options: IllnessOptions = DEFAULT_ILLNESS_OPTIONS): IllnessDay {
  const signals: IllnessSignalReading[] = []
  const record = recordOn(records, date)
  for (const { metric, direction } of ILLNESS_SIGNALS) {
    const value = record?.[metric]
    if (!isNum(value)) continue
    const baseline = computeBaseline(seriesOf(records, metric), date, options.baseline)
    if (!baseline) continue
    const z = (value - baseline.median) / baseline.spread
    const unfavourableZ = direction === 'up' ? z : -z
    signals.push({ metric, value, median: baseline.median, unfavourableZ, flagged: unfavourableZ >= options.signalZ })
  }
  const flaggedCount = signals.filter((s) => s.flagged).length
  return { date, signals, flaggedCount, flagged: signals.length >= 2 && flaggedCount >= options.minSignals && signals.some((s) => s.unfavourableZ >= options.strongZ) }
}

function confoundersFor(records: readonly DailyRecord[], date: DateString, options: IllnessOptions): IllnessConfounder[] {
  const found: IllnessConfounder[] = []
  const lastDays = [date, addDays(date, -1)]
  if (lastDays.some((d) => {
    const r = recordOn(records, d)
    const ratio = r ? acuteChronicRatio(r.acuteLoad, r.chronicLoad) : null
    return ratio !== null && ratio > 1.3
  })) found.push('highLoad')

  const debts = [0, 1, 2].map((i) => recordOn(records, addDays(date, -i))?.sleepDebtMin).filter(isNum)
  if (debts.length >= 2 && debts.reduce((a, b) => a + b, 0) / debts.length >= 60) found.push('sleepDebt')

  const stress = recordOn(records, date)?.avgStress
  const stressBaseline = computeBaseline(seriesOf(records, 'avgStress'), date, options.baseline)
  if (isNum(stress) && stressBaseline && (stress - stressBaseline.median) / stressBaseline.spread >= options.signalZ) found.push('highStress')
  return found
}

/** Latest day with at least one illness signal measured. */
function referenceDate(records: readonly DailyRecord[]): DateString | null {
  for (let i = records.length - 1; i >= 0; i--) {
    const r = records[i] as DailyRecord
    if (ILLNESS_SIGNALS.some(({ metric }) => isNum(r[metric]))) return r.date
  }
  return null
}

export function assessIllnessPattern(records: readonly DailyRecord[], options: IllnessOptions = DEFAULT_ILLNESS_OPTIONS): IllnessAssessment {
  const date = referenceDate(records)
  const empty: IllnessAssessment = { state: 'insufficient', date, day: null, streak: 0, recent: [], confounders: [], episodes: [], historyDays: options.historyDays }
  if (!date) return empty

  // Days are evaluated from the oldest scanned day to the reference day so streaks can be counted.
  const days: IllnessDay[] = []
  for (let i = options.historyDays; i >= 0; i--) days.push(illnessDay(records, addDays(date, -i), options))

  const episodes: IllnessEpisode[] = []
  let run: IllnessDay[] = []
  const closeRun = () => {
    if (run.length >= options.persistenceDays) episodes.push({ from: run[0]!.date, to: run[run.length - 1]!.date, days: run.length })
    run = []
  }
  for (const day of days) {
    if (day.flagged) run.push(day)
    else closeRun()
  }
  const streak = run.length
  closeRun()

  const day = days[days.length - 1] ?? null
  if (!day || day.signals.length < 2) return { ...empty, day, recent: days.slice(-14), episodes }

  const state: IllnessState = streak >= options.persistenceDays ? 'pattern' : day.flaggedCount >= 1 ? 'watch' : 'normal'
  return {
    state,
    date,
    day,
    streak,
    recent: days.slice(-14),
    confounders: state === 'normal' ? [] : confoundersFor(records, date, options),
    episodes,
    historyDays: options.historyDays,
  }
}

export const ILLNESS_METRICS: MetricKey[] = ILLNESS_SIGNALS.map((s) => s.metric)
