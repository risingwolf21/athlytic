import { useTranslation } from 'react-i18next'
import type { Confidence } from '@/analytics'
import { cn } from '@/lib/utils'

const LEVELS: Record<Confidence, number> = { low: 1, medium: 2, high: 3 }

/** Three dots plus a word: how much data stands behind an insight. */
export function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground" title={t('insights.confidenceHint')}>
      <span className="flex gap-0.5" aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn('size-1.5 rounded-full', n <= LEVELS[confidence] ? 'bg-primary' : 'bg-border')} />
        ))}
      </span>
      {t(`insights.confidence.${confidence}`)}
    </span>
  )
}
