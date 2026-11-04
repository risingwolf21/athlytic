import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { Activity } from '@shared/domain.ts'
import { localDate } from '@/analytics'
import { SportIcon } from '@/components/SportIcon'
import { formatDay, formatDistanceKm, formatDuration } from '@/lib/format'

export function ActivityRow({ activity }: { activity: Activity }) {
  const { t } = useTranslation()
  return (
    <Link to={`/activities/${activity.id}`} className="surface flex items-center gap-3 rounded-2xl p-3.5 transition-transform active:scale-[0.985]">
      <SportIcon sport={activity.sport} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{activity.name}</p>
        <p className="text-xs text-muted-foreground">
          {formatDay(localDate(activity.startTime), 'medium')} · {t(`sports.${activity.sport}`)}
        </p>
      </div>
      <div className="text-right text-sm tabular">
        {activity.distanceM ? <p className="font-medium">{formatDistanceKm(activity.distanceM)} km</p> : null}
        <p className="text-xs text-muted-foreground">{formatDuration(activity.durationS)}</p>
      </div>
    </Link>
  )
}
