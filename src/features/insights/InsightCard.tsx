import { Link } from 'react-router'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { AlertCircle, ChevronRight, Link2, Sparkles, Trophy, TrendingDown, TrendingUp, Zap, HeartPulse, type LucideIcon } from 'lucide-react'
import type { Insight, InsightKind } from '@/analytics'
import { useInsightText } from '@/features/insights/insight-text'
import { cn } from '@/lib/utils'

const KIND_ICON: Record<InsightKind, LucideIcon> = {
  deviation: AlertCircle,
  trend: TrendingUp,
  correlation: Link2,
  record: Trophy,
  load: Zap,
  recovery: HeartPulse,
}

const TONE_CLASS = {
  positive: 'bg-positive/12 text-positive',
  attention: 'bg-attention/14 text-attention',
  neutral: 'bg-primary/10 text-primary',
} as const

export function InsightIcon({ insight, className }: { insight: Insight; className?: string }) {
  const Icon = insight.kind === 'trend' && insight.messageKey.endsWith('down') ? TrendingDown : (KIND_ICON[insight.kind] ?? Sparkles)
  return (
    <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', TONE_CLASS[insight.tone], className)}>
      <Icon className="size-[1.125rem]" aria-hidden />
    </span>
  )
}

/** Summary of one insight. Tapping opens the detail page with the underlying data and the formula. */
export function InsightCard({ insight, index = 0, compact = false }: { insight: Insight; index?: number; compact?: boolean }) {
  const { t } = useTranslation()
  const text = useInsightText()(insight)

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: [0.22, 1, 0.36, 1] }}>
      <Link to={`/insights/${encodeURIComponent(insight.id)}`} className="surface flex items-start gap-3 rounded-2xl p-4 transition-transform active:scale-[0.985]">
        <InsightIcon insight={insight} />
        <div className="min-w-0 flex-1">
          <p className="leading-snug font-medium">{text.title}</p>
          {!compact && <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">{text.body}</p>}
          <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{t(`insights.kinds.${insight.kind}`)}</span>
            <span aria-hidden>·</span>
            <span>{t(`insights.confidence.${insight.confidence}`)}</span>
          </p>
        </div>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </motion.div>
  )
}
