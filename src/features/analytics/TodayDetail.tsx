import { useTranslation } from 'react-i18next'
import type { DailyMetrics, IntradayMetric, NormalizedBundle, SleepSession } from '@shared/domain.ts'
import { compareToAverage, DEFAULT_AVERAGE_WINDOW_DAYS, intradayStats, latestIntraday, windowAverage, type DailyRecord, type MetricKey, type WindowAverage } from '@/analytics'
import { IntradayChart } from '@/components/charts/IntradayChart'
import { SleepStagesBar } from '@/components/charts/SleepStagesBar'
import { Panel, Section } from '@/components/page'
import { StatGrid } from '@/components/StatGrid'
import { BatteryEvents, HrvStatusCard, StressBreakdown } from '@/features/recovery/DayDetail'
import { SleepDetail } from '@/features/recovery/SleepDetail'
import { useMetricFormatter } from '@/features/analytics/use-metric-format'
import { formatClock, formatDay, formatDuration, formatNumber } from '@/lib/format'

type Group = 'sleep' | 'battery' | 'stress' | 'hrv' | 'oxygen' | 'heartRate' | 'generic'

const GROUP: Partial<Record<MetricKey, Group>> = {
  sleepHours: 'sleep',
  sleepScore: 'sleep',
  deepSleepPct: 'sleep',
  sleepStress: 'sleep',
  bodyBatteryHigh: 'battery',
  bodyBatteryLow: 'battery',
  avgStress: 'stress',
  highStressMin: 'stress',
  hrv: 'hrv',
  spo2Avg: 'oxygen',
  respirationAvg: 'oxygen',
  restingHr: 'heartRate',
}

interface Row {
  label: string
  value: number | null | undefined
  avg: WindowAverage
  format: (value: number) => string
}

function signed(delta: number, format: (value: number) => string): string {
  return `${delta >= 0 ? '+' : '−'}${format(Math.abs(delta))}`
}

/** Today's value next to the average of the preceding days, with the difference. */
function CompareTable({ rows, today }: { rows: Row[]; today: string }) {
  const { t } = useTranslation()
  const visible = rows.flatMap((row) => {
    const cmp = compareToAverage(row.value, row.avg)
    return cmp ? [{ row, cmp }] : []
  })
  if (visible.length === 0) return null
  const samples = Math.max(...visible.map((v) => v.cmp.samples))
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1.3fr)_1fr_1fr_1fr] gap-x-2 pb-1.5 text-xs text-muted-foreground">
        <span />
        <span className="text-right">{t('todayDetail.value')}</span>
        <span className="text-right">{t('todayDetail.average')}</span>
        <span className="text-right">{t('todayDetail.difference')}</span>
      </div>
      <ul className="divide-y">
        {visible.map(({ row, cmp }) => (
          <li key={row.label} className="grid min-h-11 grid-cols-[minmax(0,1.3fr)_1fr_1fr_1fr] items-center gap-x-2 py-2 text-sm tabular">
            <span className="truncate">{row.label}</span>
            <span className="text-right font-semibold">{row.format(cmp.value)}</span>
            <span className="text-right text-muted-foreground">{cmp.average === null ? '–' : row.format(cmp.average)}</span>
            <span className="text-right text-muted-foreground">{cmp.delta === null ? '–' : signed(cmp.delta, row.format)}</span>
          </li>
        ))}
      </ul>
      <p className="pt-2 text-xs text-muted-foreground">{t('todayDetail.averageNote', { days: DEFAULT_AVERAGE_WINDOW_DAYS, samples, date: formatDay(today, 'medium') })}</p>
    </div>
  )
}

interface CurveProps {
  bundle: NormalizedBundle
  metric: IntradayMetric
  today: string
  color: string
  unit: string
  domain?: [number, number]
}

function Curve({ bundle, metric, today, color, unit, domain }: CurveProps) {
  const { t } = useTranslation()
  const series = latestIntraday(bundle.intraday, metric, today)
  if (!series) return <p className="text-sm text-muted-foreground">{t('todayDetail.noCurve')}</p>
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">
        {t('todayDetail.curve')} · {formatDay(series.date, 'medium')}
      </p>
      <IntradayChart points={series.points} color={color} unit={unit} {...(domain ? { domain } : {})} />
    </div>
  )
}

function intradayItems(bundle: NormalizedBundle, metric: IntradayMetric, today: string, labels: { now: string; max: string; min: string }, fmt: (v: number) => string) {
  const series = latestIntraday(bundle.intraday, metric, today)
  const stats = series ? intradayStats(series.points) : null
  if (!stats) return []
  return [
    { label: labels.now, value: fmt(stats.last.value), hint: formatClock(new Date(stats.last.at * 1000).toISOString()) },
    { label: labels.max, value: fmt(stats.max) },
    { label: labels.min, value: fmt(stats.min) },
  ]
}

function SleepComparison({ sleep, all }: { sleep: SleepSession; all: readonly SleepSession[] }) {
  const { t } = useTranslation()
  const avg = (pick: (s: SleepSession) => number | null | undefined) => windowAverage(all, sleep.date, pick)
  const dur = (v: number) => formatDuration(v)
  const num = (v: number) => formatNumber(v, 0)
  const rows: Row[] = [
    { label: t('todayDetail.sleep.total'), value: sleep.durationS, avg: avg((s) => s.durationS), format: dur },
    { label: t('recovery.stages.deep'), value: sleep.deepS, avg: avg((s) => s.deepS), format: dur },
    { label: t('recovery.stages.light'), value: sleep.lightS, avg: avg((s) => s.lightS), format: dur },
    { label: t('recovery.stages.rem'), value: sleep.remS, avg: avg((s) => s.remS), format: dur },
    { label: t('recovery.stages.awake'), value: sleep.awakeS, avg: avg((s) => s.awakeS), format: dur },
    { label: t('todayDetail.sleep.score'), value: sleep.score, avg: avg((s) => s.score), format: num },
    { label: t('todayDetail.sleep.respiration'), value: sleep.avgRespiration, avg: avg((s) => s.avgRespiration), format: (v) => formatNumber(v, 1) },
    { label: t('todayDetail.sleep.spo2'), value: sleep.avgSpo2, avg: avg((s) => s.avgSpo2), format: (v) => `${formatNumber(v, 0)} %` },
    { label: t('todayDetail.sleep.stress'), value: sleep.avgSleepStress, avg: avg((s) => s.avgSleepStress), format: num },
    { label: t('todayDetail.sleep.avgHr'), value: sleep.avgHr, avg: avg((s) => s.avgHr), format: num },
  ]
  return (
    <>
      <SleepStagesBar deepS={sleep.deepS} lightS={sleep.lightS} remS={sleep.remS} awakeS={sleep.awakeS} labels={{ deep: t('recovery.stages.deep'), light: t('recovery.stages.light'), rem: t('recovery.stages.rem'), awake: t('recovery.stages.awake') }} />
      <CompareTable rows={rows} today={sleep.date} />
      <SleepDetail sleep={sleep} />
    </>
  )
}

interface TodayDetailProps {
  metric: MetricKey
  bundle: NormalizedBundle
  records: readonly DailyRecord[]
  today: string
}

/** The actual data of the latest day behind a metric (curves, stages, events), compared with the preceding 28 days. */
export function TodayDetail({ metric, bundle, records, today }: TodayDetailProps) {
  const { t } = useTranslation()
  const format = useMetricFormatter()
  const group = GROUP[metric] ?? 'generic'
  const daily = bundle.daily.find((d) => d.date === today) ?? null
  const sleep = [...bundle.sleep].filter((s) => s.date <= today).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null
  const num = (v: number) => formatNumber(v, 0)
  const minutes = (v: number) => formatDuration(v)
  const dailyRows = (items: { label: string; pick: (d: DailyMetrics) => number | null | undefined; format: (v: number) => string }[]): Row[] =>
    items.map((i) => ({ label: i.label, value: daily ? i.pick(daily) : null, avg: windowAverage(bundle.daily, today, i.pick), format: i.format }))

  let content: React.ReactNode = null
  if (group === 'sleep') {
    content = sleep ? <SleepComparison sleep={sleep} all={bundle.sleep} /> : <p className="text-sm text-muted-foreground">{t('recovery.noSleep')}</p>
  } else if (group === 'battery') {
    const items = intradayItems(bundle, 'body_battery', today, { now: t('todayDetail.now'), max: t('todayDetail.max'), min: t('todayDetail.min') }, num)
    content = (
      <>
        <StatGrid items={items} columns={3} />
        <Curve bundle={bundle} metric="body_battery" today={today} color="var(--m-battery)" unit="" domain={[0, 100]} />
        {daily && <BatteryEvents daily={daily} />}
        <CompareTable
          today={today}
          rows={dailyRows([
            { label: t('todayDetail.max'), pick: (d) => d.bodyBatteryHigh, format: num },
            { label: t('todayDetail.min'), pick: (d) => d.bodyBatteryLow, format: num },
            { label: t('dayDetail.charged'), pick: (d) => d.bodyBatteryCharged, format: num },
            { label: t('dayDetail.drained'), pick: (d) => (d.bodyBatteryDrained === null ? null : Math.abs(d.bodyBatteryDrained)), format: num },
          ])}
        />
      </>
    )
  } else if (group === 'stress') {
    content = (
      <>
        <Curve bundle={bundle} metric="stress" today={today} color="var(--m-stress)" unit="" domain={[0, 100]} />
        {daily && <StressBreakdown daily={daily} />}
        <CompareTable
          today={today}
          rows={dailyRows([
            { label: t('metrics.avgStress.label'), pick: (d) => d.avgStress, format: num },
            { label: t('dayDetail.stress.rest'), pick: (d) => d.stressRestS, format: minutes },
            { label: t('dayDetail.stress.low'), pick: (d) => d.stressLowS, format: minutes },
            { label: t('dayDetail.stress.medium'), pick: (d) => d.stressMediumS, format: minutes },
            { label: t('dayDetail.stress.high'), pick: (d) => d.stressHighS, format: minutes },
          ])}
        />
      </>
    )
  } else if (group === 'hrv') {
    content = (
      <>
        {daily && <HrvStatusCard daily={daily} />}
        <Curve bundle={bundle} metric="hrv" today={today} color="var(--m-hrv)" unit="ms" />
        <CompareTable today={today} rows={dailyRows([{ label: t('dayDetail.hrvLastNight'), pick: (d) => d.hrvLastNightAvg, format: (v) => `${num(v)} ms` }])} />
      </>
    )
  } else if (group === 'oxygen') {
    content = (
      <>
        <Curve bundle={bundle} metric="spo2" today={today} color="var(--m-hr)" unit="%" domain={[80, 100]} />
        {sleep && <CompareTable today={sleep.date} rows={[
          { label: t('todayDetail.sleep.spo2'), value: sleep.avgSpo2, avg: windowAverage(bundle.sleep, sleep.date, (s) => s.avgSpo2), format: (v) => `${formatNumber(v, 0)} %` },
          { label: t('todayDetail.sleep.respiration'), value: sleep.avgRespiration, avg: windowAverage(bundle.sleep, sleep.date, (s) => s.avgRespiration), format: (v) => formatNumber(v, 1) },
        ]} />}
      </>
    )
  } else if (group === 'heartRate') {
    const items = intradayItems(bundle, 'heart_rate', today, { now: t('todayDetail.now'), max: t('todayDetail.max'), min: t('todayDetail.min') }, num)
    content = (
      <>
        <StatGrid items={items} columns={3} />
        <Curve bundle={bundle} metric="heart_rate" today={today} color="var(--m-hr)" unit="bpm" />
        <CompareTable
          today={today}
          rows={dailyRows([
            { label: t('metrics.restingHr.label'), pick: (d) => d.restingHr, format: (v) => `${num(v)} bpm` },
            { label: t('todayDetail.minHr'), pick: (d) => d.minHr, format: (v) => `${num(v)} bpm` },
            { label: t('todayDetail.maxHr'), pick: (d) => d.maxHr, format: (v) => `${num(v)} bpm` },
          ])}
        />
      </>
    )
  } else {
    const current = records.find((r) => r.date === today)?.[metric] ?? null
    content = <CompareTable today={today} rows={[{ label: t(`metrics.${metric}.label`), value: current, avg: windowAverage(records, today, (r) => r[metric]), format: (v) => format(metric, v).full }]} />
  }

  if (!content) return null
  return (
    <Section title={t('todayDetail.title')}>
      <Panel className="space-y-4">
        <p className="text-xs text-muted-foreground">{t('todayDetail.subtitle', { date: formatDay(today, 'full') })}</p>
        {content}
      </Panel>
    </Section>
  )
}
