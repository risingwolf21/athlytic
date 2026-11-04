import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { METRICS, computeBaseline, isMetricKey, seriesOf, type Granularity } from '@/analytics'
import { TrendChart } from '@/components/charts/TrendChart'
import { Delta } from '@/components/Delta'
import { KindBadge } from '@/components/KindBadge'
import { ErrorState, PageSkeleton, Panel, Section } from '@/components/page'
import { Segmented } from '@/components/Segmented'
import { comparePoints, periodStat, periodWindow, trendPoints } from '@/features/analytics/series'
import { useMetricFormatter } from '@/features/analytics/use-metric-format'
import { useFitnessData } from '@/hooks/use-fitness-data'
import { formatDay, formatNumber } from '@/lib/format'
import { METRIC_STYLE } from '@/lib/metric-style'
import { useUiStore, type Period } from '@/stores/ui'

const PERIODS: Period[] = ['day', 'week', 'month', 'year']

function Stat({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular">{value}</p>
      {children}
    </div>
  )
}

export default function MetricDetailPage() {
  const { metric } = useParams()
  const { t } = useTranslation()
  const data = useFitnessData()
  const period = useUiStore((s) => s.period)
  const setPeriod = useUiStore((s) => s.setPeriod)
  const [compare, setCompare] = useState(true)
  const format = useMetricFormatter()

  if (!isMetricKey(metric)) return <Navigate to="/analytics" replace />
  if (data.isLoading) return <PageSkeleton />
  if (data.isError) return <ErrorState error={data.error} />
  const { today, records } = data
  const def = METRICS[metric]
  const { color } = METRIC_STYLE[metric]
  const granularity: Granularity = period

  const header = (
    <div className="pt-2 pb-4">
      <Link to="/analytics" className="-ml-1 inline-flex min-h-9 items-center gap-0.5 text-sm font-medium text-primary">
        <ChevronLeft className="size-4" aria-hidden />
        {t('analytics.title')}
      </Link>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h1 className="text-[1.75rem] leading-tight font-semibold">{t(`metrics.${metric}.label`)}</h1>
        <KindBadge kind={def.kind} />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t(`metrics.${metric}.description`)}</p>
    </div>
  )

  if (!today) return header

  const span = periodWindow(today, granularity)
  const points = trendPoints(records, metric, span, granularity)
  const stat = periodStat(records, metric, span)
  const baseline = granularity === 'day' ? computeBaseline(seriesOf(records, metric), today) : null
  const current = format(metric, stat.current)
  const previous = format(metric, stat.previous)

  return (
    <div className="space-y-6">
      {header}
      <Segmented label={t('analytics.period')} value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: t(`analytics.periods.${p}`) }))} className="w-full" />

      <Panel className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">{t(`analytics.aggregate.${def.aggregate}`)}</p>
            <p className="text-4xl leading-none font-semibold tabular">
              {current.text} <span className="text-base font-normal text-muted-foreground">{current.unit}</span>
            </p>
          </div>
          <Delta metric={metric} ratio={stat.deltaRatio} className="text-sm" />
        </div>
        <TrendChart
          data={points}
          granularity={granularity}
          color={color}
          variant={def.aggregate === 'sum' ? 'bar' : 'area'}
          format={(v) => format(metric, v).full}
          formatTick={(v) => format(metric, v).text}
          band={baseline}
          {...(metric.startsWith('bodyBattery') ? { bounds: { min: 0, max: 100 } } : metric === 'steps' ? { bounds: { min: 0 } } : {})}
          bandLabel={t('common.personalRange')}
          {...(compare ? { compare: comparePoints(records, metric, span, granularity, points.length), compareLabel: t('analytics.previousPeriod') } : {})}
          lowCoverageLabel={t('common.lowCoverage')}
        />
        <label className="flex min-h-9 items-center gap-2 text-sm">
          <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          {t('analytics.showPrevious')}
        </label>
      </Panel>

      <Section title={t('analytics.comparison')}>
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label={t('analytics.thisPeriod')} value={current.full} />
          <Stat label={t('analytics.previousPeriod')} value={previous.full} />
          {stat.min !== null && <Stat label={t('analytics.lowest')} value={format(metric, stat.min).full} />}
          {stat.max !== null && <Stat label={t('analytics.highest')} value={format(metric, stat.max).full} />}
        </div>
        <p className="px-1 text-xs text-muted-foreground">
          {t('analytics.window', { from: formatDay(span.from, 'full'), to: formatDay(span.to, 'full') })} · {t('analytics.coverage', { percent: formatNumber(stat.coverage * 100) })}
        </p>
      </Section>

      <Panel className="space-y-1.5 text-sm">
        <p className="font-medium">{t('analytics.about')}</p>
        <p className="text-muted-foreground">{t(`kind.${def.kind}Hint`)}</p>
        {baseline && <p className="text-muted-foreground">{t('analytics.baselineNote', { median: format(metric, baseline.median).full, samples: baseline.samples })}</p>}
        <Link to="/insights/methods" className="inline-block pt-1 font-medium text-primary">{t('common.howCalculated')}</Link>
      </Panel>
    </div>
  )
}
