import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Scale } from 'lucide-react'
import { addDays } from '@shared/dates.ts'
import { LoadChart } from '@/components/charts/LoadChart'
import { RingGauge } from '@/components/charts/RingGauge'
import { KindBadge } from '@/components/KindBadge'
import { MetricCard } from '@/components/MetricCard'
import { EmptyState, ErrorState, PageHeader, PageSkeleton, Panel, Section } from '@/components/page'
import { InsightCard } from '@/features/insights/InsightCard'
import { summarizeMetric } from '@/features/dashboard/summary'
import { useFitnessData } from '@/hooks/use-fitness-data'
import { formatDay, formatHours, formatNumber, formatRelativeDays } from '@/lib/format'
import { localDate, type MetricKey } from '@/analytics'
import { ActivityRow } from '@/features/activities/ActivityRow'
import { useAuthStore } from '@/stores/auth'

const TILES: MetricKey[] = ['steps', 'restingHr', 'hrv', 'sleepHours', 'avgStress', 'bodyBatteryHigh']
const EXTRA_TILES: MetricKey[] = ['spo2Avg', 'respirationAvg', 'hydrationMl', 'highStressMin', 'weightKg', 'bodyFatPct']

function greetingKey(hour: number) {
  if (hour < 11) return 'morning'
  if (hour < 17) return 'day'
  return 'evening'
}

export default function DashboardPage() {
  const { t } = useTranslation()
  const data = useFitnessData()
  const email = useAuthStore((s) => s.email)

  if (data.isLoading) return <PageSkeleton />
  if (data.isError) return <ErrorState error={data.error} />
  if (!data.today || !data.latest) {
    return (
      <>
        <PageHeader title={t('dashboard.title')} />
        <EmptyState title={t('dashboard.emptyTitle')} description={t('dashboard.emptyDescription')} action={<Link to="/settings" className="text-sm font-medium text-primary">{t('dashboard.goToSettings')}</Link>} />
      </>
    )
  }

  const { today, latest, records, insights, activities } = data
  const name = data.profile.displayName || email?.split('@')[0] || ''
  const relative = formatRelativeDays(today, new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }))
  const dateLabel = relative ? t(`common.${relative}`) : formatDay(today, 'long')
  const detail = latest.recoveryDetail
  const weakest = detail ? [...detail.components].sort((a, b) => a.score - b.score)[0] : null
  const loadWindow = records.filter((r) => r.date >= addDays(today, -41))
  const recentActivities = activities.filter((a) => localDate(a.startTime) >= addDays(today, -6)).slice(0, 3)
  const topInsight = insights[0]
  const extraTiles = EXTRA_TILES.map((metric) => summarizeMetric(records, metric, today)).filter((s) => s.value !== null || s.spark.some((v) => v !== null))
  const hasBody = (data.bundle?.body.length ?? 0) > 0 || (data.bundle?.fitnessAge.length ?? 0) > 0

  return (
    <div className="space-y-6">
      <PageHeader title={t(`dashboard.greeting.${greetingKey(new Date().getHours())}`, { name })} subtitle={dateLabel} />

      <Panel className="flex items-center gap-5">
        <RingGauge value={latest.recovery} color="var(--m-recovery)" label={t('metrics.recovery.label')}>
          <span className="text-4xl leading-none font-semibold tabular">{latest.recovery === null ? '–' : formatNumber(latest.recovery)}</span>
          <span className="mt-1 text-xs text-muted-foreground">/ 100</span>
        </RingGauge>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{t('metrics.recovery.label')}</h2>
            <KindBadge kind="calculated" compact />
          </div>
          <p className="text-sm text-muted-foreground">
            {latest.recovery === null
              ? t('dashboard.recoveryUnknown')
              : t(latest.recovery >= 70 ? 'dashboard.recoveryHigh' : latest.recovery >= 45 ? 'dashboard.recoveryMedium' : 'dashboard.recoveryLow')}
          </p>
          {weakest && latest.recovery !== null && latest.recovery < 70 && (
            <p className="text-xs text-muted-foreground">{t('dashboard.weakest', { component: t(`recovery.components.${weakest.key}`) })}</p>
          )}
          <Link to="/recovery" className="inline-flex items-center gap-0.5 text-sm font-medium text-primary">
            {t('dashboard.recoveryDetails')}
            <ChevronRight className="size-4" aria-hidden />
          </Link>
        </div>
      </Panel>

      {topInsight && (
        <Section title={t('dashboard.insightOfTheDay')} action={<Link to="/insights" className="text-sm font-medium text-primary">{t('common.showAll')}</Link>}>
          <InsightCard insight={topInsight} />
        </Section>
      )}

      <Section title={t('dashboard.today')}>
        <div className="grid grid-cols-2 gap-3">
          {TILES.map((metric, index) => {
            const s = summarizeMetric(records, metric, today)
            const range = s.baseline ? `${formatNumber(s.baseline.low, metric === 'sleepHours' ? 1 : 0)}–${formatNumber(s.baseline.high, metric === 'sleepHours' ? 1 : 0)}` : null
            return (
              <MetricCard
                key={metric}
                index={index}
                metric={metric}
                value={s.value}
                {...(metric === 'sleepHours' ? { displayValue: formatHours(s.value), unit: '' } : {})}
                sparkline={s.spark}
                deltaRatio={s.deltaRatio}
                hint={range ? t('dashboard.normalRange', { range }) : t('dashboard.noBaseline')}
                to={`/analytics/${metric}`}
              />
            )
          })}
        </div>
        <p className="px-1 text-xs text-muted-foreground">{t('dashboard.deltaNote')}</p>
      </Section>

      {extraTiles.length > 0 && (
        <Section title={t('dashboard.moreVitals')}>
          <div className="grid grid-cols-2 gap-3">
            {extraTiles.map((s, index) => (
              <MetricCard key={s.metric} index={index} metric={s.metric} value={s.value} sparkline={s.spark} deltaRatio={s.deltaRatio} hint={s.value === null ? t('dashboard.noValueToday') : ''} to={`/analytics/${s.metric}`} />
            ))}
          </div>
        </Section>
      )}

      {hasBody && (
        <Link to="/body" className="surface flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3 transition-transform active:scale-[0.985]">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Scale className="size-[1.125rem]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{t('body.title')}</p>
            <p className="text-xs text-muted-foreground">{t('body.linkHint')}</p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      )}

      <Section title={t('dashboard.loadTitle')} action={<KindBadge kind="calculated" />}>
        <Panel>
          <p className="mb-3 text-sm text-muted-foreground">
            {t('dashboard.loadSummary', { acute: formatNumber(latest.acuteLoad), chronic: formatNumber(latest.chronicLoad) })}
          </p>
          <LoadChart
            data={loadWindow.map((r) => ({ date: r.date, load: r.trainingLoad, acute: r.acuteLoad, chronic: r.chronicLoad }))}
            labels={{ load: t('metrics.trainingLoad.label'), acute: t('metrics.acuteLoad.label'), chronic: t('metrics.chronicLoad.label') }}
          />
        </Panel>
      </Section>

      <Section title={t('dashboard.recentActivities')} action={<Link to="/activities" className="text-sm font-medium text-primary">{t('common.showAll')}</Link>}>
        {recentActivities.length === 0 ? (
          <EmptyState title={t('dashboard.noRecentActivities')} />
        ) : (
          <div className="space-y-2">
            {recentActivities.map((activity) => (
              <ActivityRow key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
