import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { Sparkline } from '@/components/charts/Sparkline'
import { Delta } from '@/components/Delta'
import { KindBadge } from '@/components/KindBadge'
import { METRICS, type MetricKey } from '@/analytics'
import { formatMetricValue } from '@/lib/format'
import { METRIC_STYLE } from '@/lib/metric-style'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  metric: MetricKey
  value: number | null
  /** Pre-formatted value for metrics that need special formatting (e.g. sleep as 7:24 h). */
  displayValue?: string
  unit?: string
  /** Replaces the metric's default label, e.g. "Body Battery aktuell". */
  label?: string
  sparkline?: (number | null)[]
  deltaRatio?: number | null
  /** Small line below the value, e.g. "Baseline 52 ms". */
  hint?: ReactNode
  to?: string
  className?: string
  index?: number
}

/** Dashboard tile: label, big number, change versus the previous period and a trend line. */
export function MetricCard({ metric, value, displayValue, unit, label, sparkline, deltaRatio = null, hint, to, className, index = 0 }: MetricCardProps) {
  const { t } = useTranslation()
  const { color, icon: Icon } = METRIC_STYLE[metric]
  const def = METRICS[metric]
  const text = displayValue ?? formatMetricValue(metric, value)
  const unitLabel = unit ?? t(`units.${def.unit}`)

  const body = (
    <>
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg" style={{ background: `color-mix(in oklch, ${color} 14%, transparent)`, color }}>
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="min-w-0 text-[0.8125rem] leading-tight font-medium text-muted-foreground">{label ?? t(`metrics.${metric}.label`)}</span>
        </div>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="text-[1.75rem] leading-none font-semibold tracking-tight tabular">{text}</span>
        {value !== null && unitLabel && <span className="text-sm text-muted-foreground">{unitLabel}</span>}
      </div>
      <div className="mt-1.5 flex min-h-5 items-center justify-between gap-2">
        {deltaRatio !== null ? <Delta metric={metric} ratio={deltaRatio} /> : <span />}
        <KindBadge kind={def.kind} compact className="shrink-0" />
      </div>
      {hint && <div className="mt-1.5 min-h-4 text-xs text-muted-foreground">{hint}</div>}
      {sparkline && <Sparkline values={sparkline} color={color} className="mt-2" />}
    </>
  )

  const classes = cn('surface block rounded-2xl p-4 transition-transform active:scale-[0.985]', className)
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: Math.min(index, 8) * 0.045, ease: [0.22, 1, 0.36, 1] }}>
      {to ? (
        <Link to={to} className={classes}>
          {body}
        </Link>
      ) : (
        <div className={classes}>{body}</div>
      )}
    </motion.div>
  )
}
