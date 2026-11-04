import { useTranslation } from 'react-i18next'
import { METRICS, type Insight, type MetricKey, type PersonalRecord } from '@/analytics'
import { formatDistanceKm, formatDuration, formatNumber, formatPercent, formatSigned, formatSpeedKmh } from '@/lib/format'

export interface InsightText {
  title: string
  body: string
  /** Extra caveat shown on correlation insights. */
  caution?: string
}

export function formatRecordValue(kind: PersonalRecord['kind'], value: number): string {
  switch (kind) {
    case 'longestDistance':
      return `${formatDistanceKm(value)} km`
    case 'longestDuration':
      return formatDuration(value)
    case 'mostElevation':
      return `${formatNumber(value)} m`
    case 'fastestAvgSpeed':
      return `${formatSpeedKmh(value)} km/h`
    case 'highestTrainingLoad':
      return formatNumber(value)
    case 'mostSteps':
      return formatNumber(value)
    case 'bestSleepScore':
      return formatNumber(value)
    case 'highestHrv':
      return `${formatNumber(value)} ms`
    case 'lowestRestingHr':
      return `${formatNumber(value)} bpm`
  }
}

/** Translates an insight into German text. Insight objects carry raw numbers; wording and number formatting live here. */
export function useInsightText() {
  const { t } = useTranslation()

  const metricLabel = (key: MetricKey) => t(`metrics.${key}.label`)
  const metricUnit = (key: MetricKey) => t(`units.${METRICS[key].unit}`)

  return (insight: Insight): InsightText => {
    const p = insight.params
    const metric = insight.metric
    const base: Record<string, unknown> = {}
    for (const [name, value] of Object.entries(p)) {
      base[name] = typeof value === 'number' ? formatNumber(value, Number.isInteger(value) ? 0 : Math.abs(value) < 10 ? 2 : 1) : value
    }
    if (metric) {
      base.metric = metricLabel(metric)
      base.unit = metricUnit(metric)
    }
    const key = `insights.${insight.messageKey}`
    const text = (suffix: "title" | "body"): string => String(t(`${key}.${suffix}` as never, base as never))

    switch (insight.kind) {
      case 'trend':
        base.percentText = formatPercent(Number(p.percent) / 100)
        base.deltaText = formatSigned(Number(p.delta), METRICS[insight.metric as MetricKey].decimals + 1)
        break
      case 'correlation': {
        base.x = metricLabel(p.xMetric as MetricKey)
        base.y = metricLabel(p.yMetric as MetricKey)
        base.strengthText = t(`insights.strength.${String(p.strength)}` as never) as string
        base.lagText = Number(p.lag) === 0 ? t('insights.sameDay') : t('insights.nextDay')
        break
      }
      case 'recovery':
        base.weakestText = p.weakest ? t(`insights.recoveryComponents.${String(p.weakest)}` as never) : ''
        break
      case 'record': {
        const kind = insight.messageKey.replace('record.', '') as PersonalRecord['kind']
        base.value = formatRecordValue(kind, Number(p.value))
        base.previous = formatRecordValue(kind, Number(p.previous))
        base.sport = p.sport === 'all' ? '' : ` · ${t(`sports.${String(p.sport)}` as never)}`
        break
      }
      default:
        break
    }

    const result: InsightText = { title: text('title'), body: text('body') }
    if (insight.kind === 'correlation') result.caution = t('insights.correlationCaution')
    return result
  }
}
