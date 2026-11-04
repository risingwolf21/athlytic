import { addDays } from '@shared/dates.ts'
import type { Activity } from '@shared/domain.ts'
import { DEFAULT_BASELINE, computeBaseline, deviationFromBaseline, type BaselineOptions } from './baseline.ts'
import { lagCorrelation, isNoteworthy } from './correlation.ts'
import { latestDataDate, recordOn, seriesOf, type DailyRecord } from './daily.ts'
import type { FormulaId } from './formulas.ts'
import { acuteChronicRatio, localDate } from './load.ts'
import { METRICS, type MetricKey } from './metrics.ts'
import { isRecent, personalRecords } from './records.ts'
import { sliceSeries } from './aggregate.ts'
import { classifyTrend, compareWindows } from './trend.ts'
import type { DataPoint, DateString } from './types.ts'

export type InsightKind = 'deviation' | 'trend' | 'correlation' | 'record' | 'load' | 'recovery' | 'sleep'
export type InsightTone = 'positive' | 'attention' | 'neutral'
export type Confidence = 'low' | 'medium' | 'high'

/** The raw data points an insight was computed from. */
export interface InsightEvidence {
  metric: MetricKey
  role: 'value' | 'baseline' | 'current' | 'previous' | 'x' | 'y'
  from: DateString
  to: DateString
  points: DataPoint[]
}

export interface Insight {
  id: string
  kind: InsightKind
  tone: InsightTone
  /** 0–100, used to order the feed. */
  priority: number
  /** Key below `insights.` in the i18n files; `.title`, `.body` and optionally `.explain` are derived from it. */
  messageKey: string
  /** Numeric inputs for the message templates (raw, formatting happens in the UI). */
  params: Record<string, number | string>
  metric: MetricKey | null
  formula: FormulaId
  confidence: Confidence
  date: DateString
  evidence: InsightEvidence[]
  /** Activity the insight refers to, for records. */
  activityId?: string
}

export interface InsightOptions {
  baseline: BaselineOptions
  trendWindowDays: number
  correlationWindowDays: number
  /** Metrics checked against their personal baseline for the latest day. */
  deviationMetrics: MetricKey[]
  trendMetrics: MetricKey[]
  maxInsights: number
}

export const DEFAULT_INSIGHT_OPTIONS: InsightOptions = {
  baseline: DEFAULT_BASELINE,
  trendWindowDays: 14,
  correlationWindowDays: 180,
  deviationMetrics: ['hrv', 'restingHr', 'sleepHours', 'avgStress', 'spo2Avg', 'respirationAvg'],
  trendMetrics: ['restingHr', 'hrv', 'sleepHours', 'steps', 'avgStress', 'trainingLoad', 'vo2Max', 'weightKg', 'bodyFatPct'],
  maxInsights: 12,
}

const CORRELATION_PAIRS: { x: MetricKey; y: MetricKey; lag: number }[] = [
  { x: 'trainingLoad', y: 'hrv', lag: 1 },
  { x: 'trainingLoad', y: 'restingHr', lag: 1 },
  { x: 'sleepHours', y: 'hrv', lag: 0 },
  { x: 'sleepScore', y: 'bodyBatteryHigh', lag: 0 },
  { x: 'avgStress', y: 'sleepScore', lag: 1 },
  { x: 'steps', y: 'sleepScore', lag: 0 },
  { x: 'avgStress', y: 'sleepStress', lag: 0 },
  { x: 'trainingLoad', y: 'sleepDebtMin', lag: 1 },
]

function toneFor(metric: MetricKey, direction: 'up' | 'down'): InsightTone {
  const polarity = METRICS[metric].polarity
  if (polarity === 'neutral') return 'neutral'
  const good = (polarity === 'higher-better') === (direction === 'up')
  return good ? 'positive' : 'attention'
}

const round = (v: number, decimals = 1) => Math.round(v * 10 ** decimals) / 10 ** decimals

function confidenceFor(samples: number, coverage: number): Confidence {
  if (samples >= 20 && coverage >= 0.8) return 'high'
  if (samples >= 10 && coverage >= 0.5) return 'medium'
  return 'low'
}

function points(records: readonly DailyRecord[], metric: MetricKey, from: DateString, to: DateString): DataPoint[] {
  return sliceSeries(seriesOf(records, metric), { from, to })
}

export function generateInsights(
  records: readonly DailyRecord[],
  activities: readonly Activity[],
  options: InsightOptions = DEFAULT_INSIGHT_OPTIONS,
): Insight[] {
  const today = latestDataDate(records)
  if (!today) return []
  const insights: Insight[] = []

  // 1) Latest values outside the personal normal range
  for (const metric of options.deviationMetrics) {
    const series = seriesOf(records, metric)
    const reference = [today, addDays(today, -1)].find((d) => (recordOn(records, d)?.[metric] ?? null) !== null)
    if (!reference) continue
    const baseline = computeBaseline(series, reference, options.baseline)
    const dev = deviationFromBaseline(recordOn(records, reference)?.[metric], baseline)
    if (!dev || dev.status === 'within') continue
    const direction = dev.status === 'above' ? 'up' : 'down'
    const tone = toneFor(metric, direction)
    insights.push({
      id: `deviation:${metric}:${reference}`,
      kind: 'deviation',
      tone,
      priority: Math.min(95, 60 + Math.abs(dev.z) * 8 + (tone === 'attention' ? 10 : 0)),
      messageKey: `deviation.${direction}`,
      params: { value: round(dev.value, METRICS[metric].decimals + 1), median: round(dev.baseline.median, METRICS[metric].decimals + 1), low: round(dev.baseline.low, METRICS[metric].decimals + 1), high: round(dev.baseline.high, METRICS[metric].decimals + 1), z: round(dev.z, 1), days: dev.baseline.samples },
      metric,
      formula: 'deviation',
      confidence: confidenceFor(dev.baseline.samples, dev.baseline.samples / options.baseline.windowDays),
      date: reference,
      evidence: [
        { metric, role: 'baseline', from: dev.baseline.window.from, to: dev.baseline.window.to, points: points(records, metric, dev.baseline.window.from, dev.baseline.window.to) },
        { metric, role: 'value', from: reference, to: reference, points: points(records, metric, reference, reference) },
      ],
    })
  }

  // 2) Changes between the last N days and the N days before
  const n = options.trendWindowDays
  const current = { from: addDays(today, -(n - 1)), to: today }
  const previous = { from: addDays(today, -(2 * n - 1)), to: addDays(today, -n) }
  for (const metric of options.trendMetrics) {
    const series = seriesOf(records, metric)
    const cmp = compareWindows(series, current, previous)
    const direction = classifyTrend(cmp, { minRatio: METRICS[metric].trendThreshold })
    if (direction !== 'up' && direction !== 'down') continue
    const tone = toneFor(metric, direction)
    insights.push({
      id: `trend:${metric}:${today}`,
      kind: 'trend',
      tone,
      priority: 45 + Math.min(25, Math.abs(cmp.effectSize ?? 0) * 12) + (tone === 'attention' ? 8 : 0),
      messageKey: `trend.${direction}`,
      params: { days: n, current: round(cmp.current.mean ?? 0, METRICS[metric].decimals + 1), previous: round(cmp.previous.mean ?? 0, METRICS[metric].decimals + 1), delta: round(cmp.delta ?? 0, METRICS[metric].decimals + 1), percent: round((cmp.deltaRatio ?? 0) * 100, 0), effect: round(cmp.effectSize ?? 0, 1) },
      metric,
      formula: 'windowComparison',
      confidence: confidenceFor(Math.min(cmp.current.samples, cmp.previous.samples), Math.min(cmp.current.coverage, cmp.previous.coverage)),
      date: today,
      evidence: [
        { metric, role: 'current', ...current, points: sliceSeries(series, current) },
        { metric, role: 'previous', ...previous, points: sliceSeries(series, previous) },
      ],
    })
  }

  // 3) Statistical associations (never causal claims)
  const corrFrom = addDays(today, -options.correlationWindowDays)
  for (const pair of CORRELATION_PAIRS) {
    const x = sliceSeries(seriesOf(records, pair.x), { from: corrFrom, to: today })
    const y = sliceSeries(seriesOf(records, pair.y), { from: corrFrom, to: addDays(today, pair.lag) })
    const result = lagCorrelation(x, y, pair.lag)
    if (!result || !isNoteworthy(result)) continue
    insights.push({
      id: `correlation:${pair.x}:${pair.y}:${pair.lag}`,
      kind: 'correlation',
      tone: 'neutral',
      priority: 35 + Math.abs(result.rho) * 30,
      messageKey: `correlation.${result.rho > 0 ? 'positive' : 'negative'}`,
      params: { xMetric: pair.x, yMetric: pair.y, rho: round(result.rho, 2), pairs: result.pairs, lag: pair.lag, strength: result.strength, p: result.pValue === null ? 'n/a' : result.pValue < 0.001 ? '<0.001' : round(result.pValue, 3) },
      metric: pair.y,
      formula: 'lagCorrelation',
      confidence: result.pairs >= 90 ? 'high' : result.pairs >= 45 ? 'medium' : 'low',
      date: today,
      evidence: [
        { metric: pair.x, role: 'x', from: corrFrom, to: today, points: result.points.map((p) => ({ date: p.xDate, value: p.x })) },
        { metric: pair.y, role: 'y', from: corrFrom, to: addDays(today, pair.lag), points: result.points.map((p) => ({ date: p.yDate, value: p.y })) },
      ],
    })
  }

  // 4) Training load balance
  const latest = recordOn(records, today)
  if (latest) {
    const ratio = acuteChronicRatio(latest.acuteLoad, latest.chronicLoad)
    const from = addDays(today, -41)
    if (ratio !== null && (ratio > 1.4 || ratio < 0.7)) {
      insights.push({
        id: `load:${today}`,
        kind: 'load',
        tone: ratio > 1.4 ? 'attention' : 'neutral',
        priority: ratio > 1.4 ? 75 : 40,
        messageKey: ratio > 1.4 ? 'load.high' : 'load.low',
        params: { acute: round(latest.acuteLoad, 0), chronic: round(latest.chronicLoad, 0), ratio: round(ratio, 2) },
        metric: 'acuteLoad',
        formula: 'acuteChronic',
        confidence: 'medium',
        date: today,
        evidence: [
          { metric: 'acuteLoad', role: 'value', from, to: today, points: points(records, 'acuteLoad', from, today) },
          { metric: 'chronicLoad', role: 'baseline', from, to: today, points: points(records, 'chronicLoad', from, today) },
        ],
      })
    }

    // 5) Recovery estimate
    if (latest.recovery !== null && latest.recoveryDetail) {
      const weakest = [...latest.recoveryDetail.components].sort((a, b) => a.score - b.score)[0]
      if (latest.recovery < 45 || latest.recovery >= 80) {
        insights.push({
          id: `recovery:${today}`,
          kind: 'recovery',
          tone: latest.recovery >= 80 ? 'positive' : 'attention',
          priority: latest.recovery < 45 ? 80 : 50,
          messageKey: latest.recovery >= 80 ? 'recovery.high' : 'recovery.low',
          params: { score: latest.recovery, weakest: weakest?.key ?? '', completeness: round(latest.recoveryDetail.completeness * 100, 0) },
          metric: 'recovery',
          formula: 'recovery',
          confidence: latest.recoveryDetail.completeness >= 0.85 ? 'high' : latest.recoveryDetail.completeness >= 0.6 ? 'medium' : 'low',
          date: today,
          evidence: [{ metric: 'recovery', role: 'value', from: addDays(today, -13), to: today, points: points(records, 'recovery', addDays(today, -13), today) }],
        })
      }
    }
  }

  // 6) Sleep debt over the last week
  const debtFrom = addDays(today, -6)
  const debtPoints = points(records, 'sleepDebtMin', debtFrom, today)
  const debtValues = debtPoints.map((p) => p.value).filter((v): v is number => v !== null)
  if (debtValues.length >= 4) {
    const avg = debtValues.reduce((a, b) => a + b, 0) / debtValues.length
    if (avg >= 45) {
      insights.push({
        id: `sleep:debt:${today}`,
        kind: 'sleep',
        tone: 'attention',
        priority: 58 + Math.min(20, avg / 6),
        messageKey: 'sleep.debt',
        params: { minutes: round(avg, 0), nights: debtValues.length },
        metric: 'sleepDebtMin',
        formula: 'sleepDebt',
        confidence: debtValues.length >= 6 ? 'high' : 'medium',
        date: today,
        evidence: [{ metric: 'sleepDebtMin', role: 'value', from: debtFrom, to: today, points: debtPoints }],
      })
    }
  }

  // 7) How training time is spread over intensity zones
  const zoneFrom = addDays(today, -27)
  const zoned = activities.filter((a) => a.hrZoneSeconds && localDate(a.startTime) >= zoneFrom && localDate(a.startTime) <= today)
  const zoneTotals = zoned.reduce((acc, a) => (a.hrZoneSeconds as number[]).map((s, i) => (acc[i] ?? 0) + s), [] as number[])
  const zoneSeconds = zoneTotals.reduce((a, b) => a + b, 0)
  if (zoned.length >= 3 && zoneSeconds >= 2 * 3600) {
    const easy = ((zoneTotals[0] ?? 0) + (zoneTotals[1] ?? 0)) / zoneSeconds
    const moderate = (zoneTotals[2] ?? 0) / zoneSeconds
    const hard = ((zoneTotals[3] ?? 0) + (zoneTotals[4] ?? 0)) / zoneSeconds
    const tooMuchModerate = moderate >= 0.4
    const balanced = easy >= 0.7 && hard >= 0.08
    if (tooMuchModerate || balanced) {
      insights.push({
        id: `load:intensity:${today}`,
        kind: 'load',
        tone: balanced ? 'positive' : 'neutral',
        priority: balanced ? 42 : 52,
        messageKey: balanced ? 'intensity.balanced' : 'intensity.moderate',
        params: { easy: round(easy * 100, 0), moderate: round(moderate * 100, 0), hard: round(hard * 100, 0), activities: zoned.length, hours: round(zoneSeconds / 3600, 1) },
        metric: 'trainingLoad',
        formula: 'intensityDistribution',
        confidence: zoned.length >= 8 ? 'high' : 'medium',
        date: today,
        evidence: [{ metric: 'trainingLoad', role: 'value', from: zoneFrom, to: today, points: points(records, 'trainingLoad', zoneFrom, today) }],
      })
    }
  }

  // 8) Fresh personal records
  for (const rec of personalRecords(activities, records)) {
    if (!isRecent(rec, today, 10) || rec.previousValue === null) continue
    insights.push({
      id: `record:${rec.id}:${rec.date}`,
      kind: 'record',
      tone: 'positive',
      priority: 55,
      messageKey: `record.${rec.kind}`,
      params: { value: rec.value, previous: rec.previousValue, sport: rec.sport ?? 'all', unit: rec.unit },
      metric: null,
      formula: 'personalRecord',
      confidence: 'high',
      date: rec.date,
      evidence: [],
      ...(rec.activityId ? { activityId: rec.activityId } : {}),
    })
  }

  return insights.sort((a, b) => b.priority - a.priority).slice(0, options.maxInsights)
}
