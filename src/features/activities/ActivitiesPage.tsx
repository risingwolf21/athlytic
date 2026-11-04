import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Sport } from '@shared/domain.ts'
import { localDate } from '@/analytics'
import { EmptyState, ErrorState, PageHeader, PageSkeleton, Panel } from '@/components/page'
import { ActivityRow } from '@/features/activities/ActivityRow'
import { useFitnessData } from '@/hooks/use-fitness-data'
import { formatDay, formatDistanceKm, formatDuration, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

type Filter = Sport | 'all'

export default function ActivitiesPage() {
  const { t } = useTranslation()
  const { activities, isLoading, isError, error } = useFitnessData()
  const [filter, setFilter] = useState<Filter>('all')

  const sports = useMemo(() => {
    const counts = new Map<Sport, number>()
    for (const a of activities) counts.set(a.sport, (counts.get(a.sport) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([sport]) => sport)
  }, [activities])

  const filtered = useMemo(() => (filter === 'all' ? activities : activities.filter((a) => a.sport === filter)), [activities, filter])

  const groups = useMemo(() => {
    const map = new Map<string, typeof filtered>()
    for (const a of filtered) {
      const key = localDate(a.startTime).slice(0, 7)
      map.set(key, [...(map.get(key) ?? []), a])
    }
    return [...map.entries()]
  }, [filtered])

  if (isLoading) return <PageSkeleton />
  if (isError) return <ErrorState error={error} />

  return (
    <div className="space-y-5">
      <PageHeader title={t('activities.title')} subtitle={t('activities.count', { count: filtered.length })} />

      {activities.length === 0 ? (
        <EmptyState title={t('activities.emptyTitle')} description={t('activities.emptyDescription')} />
      ) : (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label={t('activities.filter')}>
            {(['all', ...sports] as Filter[]).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={filter === value}
                onClick={() => setFilter(value)}
                className={cn('min-h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors', filter === value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}
              >
                {value === 'all' ? t('activities.all') : t(`sports.${value}`)}
              </button>
            ))}
          </div>

          {groups.map(([month, items]) => {
            const distance = items.reduce((s, a) => s + (a.distanceM ?? 0), 0)
            const duration = items.reduce((s, a) => s + a.durationS, 0)
            const elevation = items.reduce((s, a) => s + (a.elevationGainM ?? 0), 0)
            return (
              <section key={month} className="space-y-2">
                <div className="flex items-baseline justify-between px-1">
                  <h2 className="text-base font-semibold">{formatDay(`${month}-01`, 'month')}</h2>
                  <p className="text-xs text-muted-foreground tabular">
                    {formatDistanceKm(distance, 0)} km · {formatNumber(elevation)} {t('units.m')} · {formatDuration(duration)}
                  </p>
                </div>
                <div className="space-y-2">
                  {items.map((activity) => (
                    <ActivityRow key={activity.id} activity={activity} />
                  ))}
                </div>
              </section>
            )
          })}
          <Panel className="text-xs text-muted-foreground">{t('activities.note')}</Panel>
        </>
      )}
    </div>
  )
}
