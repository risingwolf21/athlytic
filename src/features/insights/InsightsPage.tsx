import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Info } from 'lucide-react'
import type { InsightKind } from '@/analytics'
import { EmptyState, ErrorState, PageHeader, PageSkeleton, Panel } from '@/components/page'
import { InsightCard } from '@/features/insights/InsightCard'
import { useFitnessData } from '@/hooks/use-fitness-data'
import { cn } from '@/lib/utils'

type Filter = InsightKind | 'all'
const KINDS: InsightKind[] = ['deviation', 'trend', 'correlation', 'load', 'recovery', 'sleep', 'record']

export default function InsightsPage() {
  const { t } = useTranslation()
  const { insights, isLoading, isError, error } = useFitnessData()
  const [filter, setFilter] = useState<Filter>('all')

  if (isLoading) return <PageSkeleton />
  if (isError) return <ErrorState error={error} />

  const present = KINDS.filter((kind) => insights.some((i) => i.kind === kind))
  const visible = filter === 'all' ? insights : insights.filter((i) => i.kind === filter)

  return (
    <div className="space-y-5">
      <PageHeader title={t('insights.title')} subtitle={t('insights.subtitle')} />

      {insights.length === 0 ? (
        <EmptyState title={t('insights.emptyTitle')} description={t('insights.emptyDescription')} />
      ) : (
        <>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="radiogroup" aria-label={t('insights.filter')}>
            {(['all', ...present] as Filter[]).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={filter === value}
                onClick={() => setFilter(value)}
                className={cn('min-h-9 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors', filter === value ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}
              >
                {value === 'all' ? t('activities.all') : t(`insights.kinds.${value}`)}
              </button>
            ))}
          </div>
          <div className="space-y-3">
            {visible.map((insight, index) => (
              <InsightCard key={insight.id} insight={insight} index={index} />
            ))}
          </div>
        </>
      )}

      <Panel className="flex gap-3 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          {t('insights.disclaimer')}{' '}
          <Link to="/insights/methods" className="font-medium text-primary">
            {t('common.howCalculated')}
          </Link>
        </p>
      </Panel>
    </div>
  )
}
