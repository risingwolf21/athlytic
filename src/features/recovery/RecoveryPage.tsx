import { useMemo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { addDays } from '@shared/dates.ts'
import {
  RECOVERY_WEIGHTS,
  computeBaseline,
  isNoteworthy,
  lagCorrelation,
  seriesOf,
  sliceSeries,
  type MetricKey,
} from '@/analytics'
import { IntradayChart } from '@/components/charts/IntradayChart'
import { RelationChart, type ScatterPoint } from '@/components/charts/RelationChart'
import { RingGauge } from '@/components/charts/RingGauge'
import { SleepStagesBar } from '@/components/charts/SleepStagesBar'
import { TrendChart } from '@/components/charts/TrendChart'
import { KindBadge } from '@/components/KindBadge'
import { EmptyState, ErrorState, PageHeader, PageSkeleton, Panel, Section } from '@/components/page'
import { Segmented } from '@/components/Segmented'
import { trendPoints, windowEndingAt } from '@/features/analytics/series'
import { BatteryEvents, HrvStatusCard, StressBreakdown } from '@/features/recovery/DayDetail'
import { IllnessPanel } from '@/features/recovery/IllnessPanel'
import { SleepDetail } from '@/features/recovery/SleepDetail'
import { useFitnessData } from '@/hooks/use-fitness-data'
import { formatClock, formatDay, formatHours, formatMetricValue, formatNumber, formatDuration } from '@/lib/format'
import { METRIC_STYLE } from '@/lib/metric-style'
import { RANGE_DAYS, useUiStore, type RangePreset } from '@/stores/ui'

const RANGES: RangePreset[] = ['7d', '30d', '90d']

function MetricTrend({ metric, title, records, today, days, variant = 'line' }: { metric: MetricKey; title: string; records: ReturnType<typeof useFitnessData>['records']; today: string; days: number; variant?: 'line' | 'area' | 'bar' }) {
  const { t } = useTranslation()
  const { color } = METRIC_STYLE[metric]
  const span = windowEndingAt(today, days)
  const baseline = computeBaseline(seriesOf(records, metric), today)
  const data = trendPoints(records, metric, span, 'day')
  const decimals = metric === 'sleepHours' ? 1 : 0
  const format = (v: number) => (metric === 'sleepHours' ? formatHours(v) : formatNumber(v, decimals))
  return (
    <Section title={title} action={<KindBadge kind="measured" />}>
      <Panel>
        <TrendChart data={data} color={color} variant={variant} format={format} formatTick={(v) => (metric === 'sleepHours' ? `${formatNumber(v, 0)} h` : formatNumber(v, 0))} band={baseline} bandLabel={t('common.personalRange')} lowCoverageLabel={t('common.lowCoverage')} />
        <p className="mt-3 text-xs text-muted-foreground">
          {baseline ? t('recovery.baselineNote', { median: format(baseline.median), low: format(baseline.low), high: format(baseline.high), samples: baseline.samples }) : t('recovery.noBaseline')}
        </p>
      </Panel>
    </Section>
  )
}

export default function RecoveryPage() {
  const { t } = useTranslation()
  const data = useFitnessData()
  const range = useUiStore((s) => s.range)
  const setRange = useUiStore((s) => s.setRange)
  const effectiveRange: RangePreset = RANGES.includes(range) ? range : '30d'
  const days = RANGE_DAYS[effectiveRange]

  const { records, today, latest, bundle } = data

  const sleep = useMemo(() => {
    if (!bundle || !today) return null
    return [...bundle.sleep].filter((s) => s.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
  }, [bundle, today])

  const intraday = useMemo(() => {
    if (!bundle || !today) return { stress: null, battery: null, hrv: null, spo2: null }
    const on = (metric: 'stress' | 'body_battery' | 'hrv' | 'spo2') => [...bundle.intraday].filter((s) => s.metric === metric && s.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
    return { stress: on('stress'), battery: on('body_battery'), hrv: on('hrv'), spo2: on('spo2') }
  }, [bundle, today])

  const relation = useMemo(() => {
    if (!today) return null
    const from = addDays(today, -180)
    const load = sliceSeries(seriesOf(records, 'trainingLoad'), { from, to: today })
    const hrv = sliceSeries(seriesOf(records, 'hrv'), { from, to: addDays(today, 1) })
    const result = lagCorrelation(load, hrv, 1)
    if (!result) return null
    const points: ScatterPoint[] = result.points.map((p) => ({ x: p.x, y: p.y, date: p.xDate }))
    return { result, points }
  }, [records, today])

  if (data.isLoading) return <PageSkeleton />
  if (data.isError) return <ErrorState error={data.error} />
  if (!today || !latest) return (
    <>
      <PageHeader title={t('recovery.title')} />
      <EmptyState title={t('dashboard.emptyTitle')} description={t('dashboard.emptyDescription')} />
    </>
  )

  const detail = latest.recoveryDetail
  const daily = bundle?.daily.find((d) => d.date === today) ?? null
  const hasVitals = records.some((r) => r.spo2Avg !== null || r.respirationAvg !== null)

  return (
    <div className="space-y-6">
      <PageHeader title={t('recovery.title')} subtitle={t('recovery.subtitle')} />

      <Segmented label={t('analytics.range')} value={effectiveRange} onChange={setRange} options={RANGES.map((r) => ({ value: r, label: t(`analytics.ranges.${r}`) }))} className="w-full" />

      <Section title={t('metrics.recovery.label')} action={<KindBadge kind="calculated" />}>
        <Panel className="space-y-5">
          <div className="flex items-center gap-5">
            <RingGauge value={latest.recovery} color="var(--m-recovery)" size={112} strokeWidth={10} label={t('metrics.recovery.label')}>
              <span className="text-3xl leading-none font-semibold tabular">{latest.recovery === null ? '–' : formatNumber(latest.recovery)}</span>
            </RingGauge>
            <p className="text-sm text-muted-foreground">{t('recovery.recoveryExplain')}</p>
          </div>
          {detail && (
            <ul className="space-y-3">
              {[...detail.components].sort((a, b) => b.weight - a.weight).map((component) => (
                <li key={component.key} className="space-y-1.5">
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{t(`recovery.components.${component.key}`)}</span>
                    <span className="tabular text-muted-foreground">
                      {formatNumber(component.score)} · {t('recovery.weight', { weight: formatNumber(RECOVERY_WEIGHTS[component.key] * 100) })}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-m-recovery transition-[width] duration-700" style={{ width: `${component.score}%` }} />
                  </div>
                </li>
              ))}
              {detail.completeness < 1 && <li className="text-xs text-muted-foreground">{t('recovery.incomplete', { percent: formatNumber(detail.completeness * 100) })}</li>}
            </ul>
          )}
          <Link to="/insights/methods" className="text-sm font-medium text-primary">{t('common.howCalculated')}</Link>
        </Panel>
      </Section>

      <IllnessPanel records={records} />

      <Section title={t('recovery.lastNight')} action={<KindBadge kind="measured" />}>
        <Panel className="space-y-4">
          {sleep ? (
            <>
              <div className="flex items-baseline justify-between">
                <div>
                  <p className="text-3xl font-semibold tabular">{formatDuration(sleep.durationS)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatClock(sleep.startTime)} – {formatClock(sleep.endTime)} · {formatDay(sleep.date, 'medium')}
                  </p>
                </div>
                {sleep.score !== null && (
                  <div className="text-right">
                    <p className="text-3xl font-semibold tabular">{formatNumber(sleep.score)}</p>
                    <p className="text-xs text-muted-foreground">{t('metrics.sleepScore.label')}</p>
                  </div>
                )}
              </div>
              <SleepStagesBar deepS={sleep.deepS} lightS={sleep.lightS} remS={sleep.remS} awakeS={sleep.awakeS} labels={{ deep: t('recovery.stages.deep'), light: t('recovery.stages.light'), rem: t('recovery.stages.rem'), awake: t('recovery.stages.awake') }} />
              <SleepDetail sleep={sleep} />
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('recovery.noSleep')}</p>
          )}
        </Panel>
      </Section>

      <MetricTrend metric="sleepHours" title={t('recovery.sleepTrend')} records={records} today={today} days={days} variant="bar" />
      <MetricTrend metric="hrv" title={t('recovery.hrvTrend')} records={records} today={today} days={days} />
      {daily && (
        <Section title={t('dayDetail.hrvTitle')}>
          <Panel>
            <HrvStatusCard daily={daily} />
          </Panel>
        </Section>
      )}
      <MetricTrend metric="restingHr" title={t('recovery.rhrTrend')} records={records} today={today} days={days} />
      <MetricTrend metric="avgStress" title={t('recovery.stressTrend')} records={records} today={today} days={days} variant="area" />
      {daily && (daily.stressRestS !== null || daily.stressHighS !== null) && (
        <Section title={t('dayDetail.stressTitle', { day: formatDay(daily.date, 'medium') })} action={<KindBadge kind="measured" />}>
          <Panel className="space-y-3">
            <StressBreakdown daily={daily} />
            <p className="text-xs text-muted-foreground">{t('dayDetail.stressNote')}</p>
          </Panel>
        </Section>
      )}
      {hasVitals && (
        <>
          <MetricTrend metric="spo2Avg" title={t('metrics.spo2Avg.label')} records={records} today={today} days={days} />
          <MetricTrend metric="respirationAvg" title={t('metrics.respirationAvg.label')} records={records} today={today} days={days} />
        </>
      )}

      {(intraday.stress || intraday.battery || intraday.hrv || intraday.spo2) && (
        <Section title={t('recovery.dayCurve')}>
          <Panel className="space-y-5">
            {intraday.battery && (
              <div>
                <p className="mb-1 text-sm font-medium">
                  {t('metrics.bodyBatteryHigh.label')} <span className="font-normal text-muted-foreground">· {formatDay(intraday.battery.date, 'medium')}</span>
                </p>
                <IntradayChart points={intraday.battery.points} color="var(--m-battery)" unit="" domain={[0, 100]} />
              </div>
            )}
            {daily && (
              <BatteryEvents daily={daily} />
            )}
            {intraday.hrv && (
              <div>
                <p className="mb-1 text-sm font-medium">
                  {t('metrics.hrv.label')} <span className="font-normal text-muted-foreground">· {formatDay(intraday.hrv.date, 'medium')}</span>
                </p>
                <IntradayChart points={intraday.hrv.points} color="var(--m-hrv)" unit="ms" />
              </div>
            )}
            {intraday.spo2 && (
              <div>
                <p className="mb-1 text-sm font-medium">
                  {t('metrics.spo2Avg.label')} <span className="font-normal text-muted-foreground">· {formatDay(intraday.spo2.date, 'medium')}</span>
                </p>
                <IntradayChart points={intraday.spo2.points} color="var(--m-hr)" unit="%" domain={[80, 100]} />
              </div>
            )}
            {intraday.stress && (
              <div>
                <p className="mb-1 text-sm font-medium">
                  {t('metrics.avgStress.label')} <span className="font-normal text-muted-foreground">· {formatDay(intraday.stress.date, 'medium')}</span>
                </p>
                <IntradayChart points={intraday.stress.points} color="var(--m-stress)" unit="" domain={[0, 100]} />
              </div>
            )}
          </Panel>
        </Section>
      )}

      <Section title={t('recovery.loadVsHrv')} action={<KindBadge kind="calculated" />}>
        <Panel className="space-y-3">
          {relation ? (
            <>
              <RelationChart
                points={relation.points}
                color="var(--m-load)"
                xLabel={t('metrics.trainingLoad.label')}
                yLabel={`${t('metrics.hrv.label')} (${t('insights.nextDay')})`}
                formatX={(v) => formatNumber(v)}
                formatY={(v) => formatMetricValue('hrv', v)}
              />
              <p className="text-sm">
                {t(isNoteworthy(relation.result) ? 'recovery.relationNoteworthy' : 'recovery.relationWeak', {
                  rho: formatNumber(relation.result.rho, 2),
                  pairs: relation.result.pairs,
                })}
              </p>
              <p className="text-xs text-muted-foreground">{t('insights.correlationCaution')}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{t('recovery.relationUnavailable')}</p>
          )}
        </Panel>
      </Section>
    </div>
  )
}
