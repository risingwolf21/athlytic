import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'
import type { ActivityDetail } from '@shared/domain.ts'
import { ActivitySeriesChart, type ActivitySeriesKey } from '@/components/charts/ActivitySeriesChart'
import { HrZoneBar } from '@/components/charts/HrZoneBar'
import { Segmented } from '@/components/Segmented'
import { EmptyState, ErrorState, PageSkeleton, Panel, Section } from '@/components/page'
import { SportIcon } from '@/components/SportIcon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { localDate } from '@/analytics'
import { useActivityDetail, useFitnessData, useSaveNotes } from '@/hooks/use-fitness-data'
import { EffectMessages, ExtraStats, FastestSplits, PowerSection, zoneConfigFor, zoneRangeLabel } from './ActivityExtras'
import { formatClock, formatDay, formatDistanceKm, formatDuration, formatNumber, formatPace, formatSpeedKmh } from '@/lib/format'

const RouteMap = lazy(() => import('@/components/charts/RouteMap'))

const SERIES_COLOR: Record<ActivitySeriesKey, string> = {
  elevation: 'var(--m-elevation)',
  hr: 'var(--m-hr)',
  speed: 'var(--m-steps)',
  cadence: 'var(--m-load)',
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="rounded-xl bg-muted/60 px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  )
}

function TrainingEffect({ label, value }: { label: string; value: number | null }) {
  const { t } = useTranslation()
  if (value === null) return null
  const level = value < 1 ? 'none' : value < 2 ? 'minor' : value < 3 ? 'maintaining' : value < 4 ? 'improving' : value < 5 ? 'highly' : 'overreaching'
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-sm">
        <span>{label}</span>
        <span className="tabular">
          <span className="font-semibold">{formatNumber(value, 1)}</span> <span className="text-muted-foreground">· {t(`activities.effect.${level}`)}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-m-load transition-[width] duration-700" style={{ width: `${Math.min(100, (value / 5) * 100)}%` }} />
      </div>
    </div>
  )
}

function Notes({ detail }: { detail: ActivityDetail }) {
  const { t } = useTranslation()
  const save = useSaveNotes()
  const [value, setValue] = useState(detail.activity.notes ?? '')
  useEffect(() => setValue(detail.activity.notes ?? ''), [detail.activity.notes])
  const dirty = value !== (detail.activity.notes ?? '')

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        placeholder={t('activities.notesPlaceholder')}
        aria-label={t('activities.notes')}
        className="w-full rounded-xl border bg-background px-3 py-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Button
        size="sm"
        disabled={!dirty || save.isPending}
        onClick={() => save.mutate({ activityId: detail.activity.id, notes: value }, { onSuccess: () => toast.success(t('activities.notesSaved')) })}
      >
        {t('common.save')}
      </Button>
      {save.isPaused && <p className="text-xs text-muted-foreground">{t('offline.queued')}</p>}
    </div>
  )
}

export default function ActivityDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const query = useActivityDetail(id)
  const fitness = useFitnessData()
  const [series, setSeries] = useState<ActivitySeriesKey>('elevation')
  const detail = query.data

  const available = useMemo(() => {
    if (!detail) return [] as ActivitySeriesKey[]
    const has = (values: (number | null)[]) => values.some((v) => v !== null)
    const { samples } = detail
    return ([
      has(samples.elevation) && 'elevation',
      has(samples.hr) && 'hr',
      has(samples.speed) && 'speed',
      has(samples.cadence) && 'cadence',
    ].filter(Boolean) as ActivitySeriesKey[])
  }, [detail])
  const activeSeries = available.includes(series) ? series : (available[0] ?? 'elevation')

  if (query.isPending) return <PageSkeleton />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />
  if (!detail) return <EmptyState title={t('activities.notFound')} />

  const { activity, laps, samples } = detail
  const hasRoute = samples.lat.some((v) => v !== null)
  const isCycling = activity.sport === 'cycling'
  const zoneConfig = zoneConfigFor(fitness.bundle?.hrZones ?? [], activity.sport)
  const seriesUnit: Record<ActivitySeriesKey, string> = { elevation: 'm', hr: 'bpm', speed: 'km/h', cadence: isCycling ? 'rpm' : 'spm' }

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <Link to="/activities" className="-ml-1 inline-flex min-h-9 items-center gap-0.5 text-sm font-medium text-primary">
          <ChevronLeft className="size-4" aria-hidden />
          {t('activities.title')}
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <SportIcon sport={activity.sport} className="grid size-12 shrink-0 place-items-center rounded-2xl" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold">{activity.name}</h1>
            <p className="text-sm text-muted-foreground">
              {formatDay(localDate(activity.startTime), 'long')} · {formatClock(activity.startTime)}
            </p>
          </div>
        </div>
      </div>

      {hasRoute && (
        <div className="surface h-64 overflow-hidden rounded-2xl lg:h-80">
          <Suspense fallback={<Skeleton className="h-full w-full" />}>
            <RouteMap samples={samples} />
          </Suspense>
        </div>
      )}

      <Panel>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Stat label={t('activities.duration')} value={formatDuration(activity.durationS)} />
          {activity.distanceM !== null && <Stat label={t('activities.distance')} value={formatDistanceKm(activity.distanceM, 2)} unit="km" />}
          {activity.elevationGainM !== null && <Stat label={t('activities.ascent')} value={formatNumber(activity.elevationGainM)} unit="m" />}
          {activity.avgSpeedMs !== null && <Stat label={t('activities.avgSpeed')} value={formatSpeedKmh(activity.avgSpeedMs)} unit="km/h" />}
          {activity.avgSpeedMs !== null && !isCycling && <Stat label={t('activities.avgPace')} value={formatPace(activity.avgSpeedMs)} unit="min/km" />}
          {activity.avgHr !== null && <Stat label={t('activities.avgHr')} value={formatNumber(activity.avgHr)} unit="bpm" />}
          {activity.maxHr !== null && <Stat label={t('activities.maxHr')} value={formatNumber(activity.maxHr)} unit="bpm" />}
          {activity.avgCadence !== null && <Stat label={t('activities.avgCadence')} value={formatNumber(activity.avgCadence)} unit={seriesUnit.cadence} />}
          {activity.avgPowerW !== null && <Stat label={t('activities.avgPower')} value={formatNumber(activity.avgPowerW)} unit="W" />}
          {activity.calories !== null && <Stat label={t('activities.calories')} value={formatNumber(activity.calories)} unit="kcal" />}
          {activity.trainingLoad !== null && <Stat label={t('metrics.trainingLoad.label')} value={formatNumber(activity.trainingLoad)} />}
        </div>
      </Panel>

      {available.length > 0 && (
        <Section title={t('activities.profile')}>
          <Panel className="space-y-3">
            <Segmented label={t('activities.profile')} value={activeSeries} onChange={setSeries} options={available.map((key) => ({ value: key, label: t(`activities.series.${key}`) }))} className="w-full" />
            <ActivitySeriesChart samples={samples} series={activeSeries} color={SERIES_COLOR[activeSeries]} unit={seriesUnit[activeSeries]} />
          </Panel>
        </Section>
      )}

      {activity.extra && <ExtraStats extra={activity.extra} activity={activity} />}

      {activity.extra && <PowerSection curve={activity.extra.powerCurveW} zones={activity.extra.powerZoneS} />}

      {activity.hrZoneSeconds && (
        <Section title={t('activities.hrZones')}>
          <Panel>
            <HrZoneBar seconds={activity.hrZoneSeconds} zoneLabel={(zone) => { const range = zoneRangeLabel(zoneConfig, zone); return range ? `Z${zone} · ${range}` : t('activities.zone', { zone }) }} />
            {zoneConfig && <p className="mt-3 text-xs text-muted-foreground">{t('activityExtra.zoneNote', { sport: zoneConfig.sport === 'DEFAULT' ? t('body.zoneSports.DEFAULT') : t(`sports.${activity.sport}`) })}</p>}
          </Panel>
        </Section>
      )}

      {(activity.aerobicTe !== null || activity.anaerobicTe !== null) && (
        <Section title={t('activities.trainingEffect')}>
          <Panel className="space-y-4">
            <TrainingEffect label={t('activities.aerobic')} value={activity.aerobicTe} />
            <TrainingEffect label={t('activities.anaerobic')} value={activity.anaerobicTe} />
            <EffectMessages extra={activity.extra} />
          </Panel>
        </Section>
      )}

      {laps.length > 0 && (
        <Section title={t('activities.laps')}>
          <Panel className="overflow-x-auto p-0">
            <table className="w-full min-w-[28rem] text-sm tabular">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">#</th>
                  <th className="px-2 py-2.5 font-medium">{t('activities.distance')}</th>
                  <th className="px-2 py-2.5 font-medium">{t('activities.duration')}</th>
                  <th className="px-2 py-2.5 font-medium">{isCycling ? t('activities.avgSpeed') : t('activities.avgPace')}</th>
                  <th className="px-2 py-2.5 font-medium">{t('activities.avgHr')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t('activities.ascent')}</th>
                </tr>
              </thead>
              <tbody>
                {laps.map((lap) => (
                  <tr key={lap.index} className="border-b last:border-0">
                    <td className="px-4 py-2.5 text-muted-foreground">{lap.index + 1}</td>
                    <td className="px-2 py-2.5">{lap.distanceM !== null ? `${formatDistanceKm(lap.distanceM, 2)} km` : '–'}</td>
                    <td className="px-2 py-2.5">{formatDuration(lap.durationS)}</td>
                    <td className="px-2 py-2.5">{isCycling ? `${formatSpeedKmh(lap.avgSpeedMs)} km/h` : formatPace(lap.avgSpeedMs)}</td>
                    <td className="px-2 py-2.5">{lap.avgHr !== null ? formatNumber(lap.avgHr) : '–'}</td>
                    <td className="px-4 py-2.5 text-right">{lap.elevationGainM !== null ? `${formatNumber(lap.elevationGainM)} m` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </Section>
      )}

      {activity.extra?.fastestSplitsS && <FastestSplits splits={activity.extra.fastestSplitsS} />}

      {activity.extra?.description && (
        <Section title={t('activities.description')}>
          <Panel>
            <p className="text-sm whitespace-pre-line">{activity.extra.description}</p>
          </Panel>
        </Section>
      )}

      <Section title={t('activities.notes')}>
        <Panel>
          <Notes detail={detail} />
        </Panel>
      </Section>

      <p className="px-1 text-xs text-muted-foreground">{t('activities.source', { source: t(`providers.${activity.provenance.source}`) })}</p>
    </div>
  )
}
