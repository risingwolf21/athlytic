import { useTranslation } from 'react-i18next'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { METRICS, type MetricKey } from '@/analytics'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

interface DeltaProps {
  metric: MetricKey
  /** Relative change, e.g. 0.08 for +8 %. */
  ratio: number | null
  className?: string
}

/** Change indicator coloured by whether the direction is good for this metric (lower resting HR is good, higher stress is not). */
export function Delta({ metric, ratio, className }: DeltaProps) {
  const { t } = useTranslation()
  if (ratio === null || !Number.isFinite(ratio)) return null
  const flat = Math.abs(ratio) < 0.005
  const polarity = METRICS[metric].polarity
  const good = polarity === 'neutral' ? null : (polarity === 'higher-better') === ratio > 0
  const Icon = flat ? Minus : ratio > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn('inline-flex items-center gap-0.5 text-xs font-medium tabular', flat || good === null ? 'text-muted-foreground' : good ? 'text-positive' : 'text-attention', className)}
      aria-label={t('common.changeVsPrevious', { value: formatPercent(flat ? 0 : ratio) })}
    >
      <Icon className="size-3.5" aria-hidden />
      {formatPercent(flat ? 0 : ratio)}
    </span>
  )
}
