import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { METRICS, personalRecords, type Granularity, type MetricKey } from '@/analytics'
import { Heatmap } from '@/components/charts/Heatmap'
import { TrendChart } from '@/components/charts/TrendChart'
import { Delta } from '@/components/Delta'
import { KindBadge } from '@/components/KindBadge'
import { EmptyState, ErrorState, PageHeader, PageSkeleton, Panel, Section } from '@/components/page'
import { Segmented } from '@/components/Segmented'
import { formatRecordValue } from '@/features/insights/insight-text'
import { comparePoints, periodStat, periodWindow, trendPoints } from '@/features/analytics/series'
import { useMetricFormatter } from '@/features/analytics/use-metric-format'
import { useFitnessData } from '@/hooks/use-fitness-data'
import { formatDay, formatNumber } from '@/lib/format'
import { ANALYTICS_METRICS, METRIC_STYLE } from '@/lib/metric-style'
import { useUiStore, type Period } from '@/stores/ui'

const PERIODS: Period[] = ['day', 'week', 'month', 'year']
type VolumeMetric = 'durationMin' | 'distanceKm' | 'elevationGainM' | 'trainingLoad'
const VOLUME_METRICS: VolumeMetric[] = ['durationMin', 'distanceKm', 'elevationGainM', 'trainingLoad']

export default function AnalyticsPage() {
  const { t } = useTranslation()
  const data = useFitnessData()
  const period = useUiStore((s) => s.period)
  const setPeriod = useUiStore((s) => s.setPeriod)
  const [volumeMetric, setVolumeMetric] = useState<VolumeMetric>('durationMin')
  const [compare, setCompare] = useState(false)
  const format = useMetricFormatter()
  const granularity: Granularity = period
  const { records, activities, today } = data

  const span = useMemo(() => (today ? periodWindow(today, granularity) : null), [today, granularity])
  const recordList = useMemo(() => (today ? personalRecords(activities, records) : []), [activities, records, today])
  const heatmap = useMemo(() => new Map(records.filter((r) => r.trainingLoad > 0).map((r) => [r.date, r.trainingLoad])), [records])

  if (data.isLoading) return <PageSkeleton />
  if (data.isError) return <ErrorState error={data.error} />
  if (!today || !span) return (
    <>
      <PageHeader title={t('analytics.title')} />
      <EmptyState title={t('dashboard.emptyTitle')} description={t('dashboard.emptyDescription')} />
    </>
  )

  const volumeData = trendPoints(records, volumeMetric, span, granularity)
  const volumeFormat = (v: number) => format(volumeMetric, v).full
  const volumeTick = (v: number) => format(volumeMetric, v).text

  return (
    <div className="space-y-6">
      <PageHeader title={t('analytics.title')} subtitle={t('analytics.subtitle')} />

      <Segmented label={t('analytics.period')} value={period} onChange={setPeriod} options={PERIODS.map((p) => ({ value: p, label: t(`analytics.periods.${p}`) }))} className="w-full" />
      <p className="-mt-3 px-1 text-xs text-muted-foreground">
        {t('analytics.window', { from: formatDay(span.from, 'full'), to: formatDay(span.to, 'full') })}
      </p>

      <Section title={t('analytics.volume')}>
        <Panel className="space-y-4">
          <Segmented label={t('analytics.volume')} value={volumeMetric} onChange={setVolumeMetric} options={VOLUME_METRICS.map((m) => ({ value: m, label: t(`analytics.volumeLabels.${m}`) }))} className="w-full" />
          <TrendChart
            data={volumeData}
            granularity={granularity}
            color={METRIC_STYLE[volumeMetric].color}
            variant="bar"
            format={volumeFormat}
            formatTick={volumeTick}
            {...(compare ? { compare: comparePoints(records, volumeMetric, span, granularity, volumeData.length), compareLabel: t('analytics.previousPeriod') } : {})}
            lowCoverageLabel={t('common.lowCoverage')}
          />
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="size-4 accent-[var(--primary)]" />
            {t('analytics.showPrevious')}
          </label>
        </Panel>
      </Section>

      <Section title={t('analytics.compare')} action={<span className="text-xs text-muted-foreground">{t('analytics.compareHint')}</span>}>
        <div className="surface divide-y overflow-hidden rounded-2xl">
          {ANALYTICS_METRICS.map((metric: MetricKey) => {
            const stat = periodStat(records, metric, span)
            const { icon: Icon, color } = METRIC_STYLE[metric]
            const value = format(metric, stat.current)
            return (
              <Link key={metric} to={`/analytics/${metric}`} className="flex min-h-14 items-center gap-3 px-4 py-3 transition-colors active:bg-muted">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in oklch, ${color} 14%, transparent)`, color }}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t(`metrics.${metric}.label`)}</p>
                  <p className="text-xs text-muted-foreground">{stat.coverage < 0.6 ? t('common.lowCoverage') : t(`analytics.aggregate.${METRICS[metric].aggregate}`)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular">
                    {value.text} <span className="font-normal text-muted-foreground">{value.unit}</span>
                  </p>
                  <Delta metric={metric} ratio={stat.deltaRatio} />
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            )
          })}
        </div>
      </Section>

      <Section title={t('analytics.activityCalendar')}>
        <Panel>
          <Heatmap values={heatmap} endDate={today} color="var(--m-load)" format={(v) => `${formatNumber(v)} ${t('metrics.trainingLoad.label')}`} emptyLabel={t('analytics.restDay')} />
        </Panel>
      </Section>

      <Section title={t('analytics.records')} action={<KindBadge kind="calculated" />}>
        {recordList.length === 0 ? (
          <EmptyState title={t('analytics.noRecords')} />
        ) : (
          <div className="surface divide-y overflow-hidden rounded-2xl">
            {recordList.map((record) => {
              const label = `${t(`records.${record.kind}`)}${record.sport ? ` · ${t(`sports.${record.sport}`)}` : ''}`
              const inner = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{formatDay(record.date, 'full')}</p>
                  </div>
                  <p className="text-sm font-semibold tabular">{formatRecordValue(record.kind, record.value)}</p>
                </>
              )
              return record.activityId ? (
                <Link key={record.id} to={`/activities/${record.activityId}`} className="flex min-h-14 items-center gap-3 px-4 py-3 active:bg-muted">
                  {inner}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              ) : (
                <div key={record.id} className="flex min-h-14 items-center gap-3 px-4 py-3">
                  {inner}
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}
