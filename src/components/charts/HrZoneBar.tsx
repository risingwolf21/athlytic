import { motion } from 'motion/react'
import { formatDuration, formatNumber } from '@/lib/format'

interface HrZoneBarProps {
  /** Seconds in zones 1–5. */
  seconds: readonly number[]
  zoneLabel: (zone: number) => string
}

const ZONE_COLORS = ['var(--m-battery)', 'var(--m-hrv)', 'var(--m-stress)', 'color-mix(in oklch, var(--m-stress) 50%, var(--m-hr))', 'var(--m-hr)']

export function HrZoneBar({ seconds, zoneLabel }: HrZoneBarProps) {
  const total = seconds.reduce((a, b) => a + b, 0)
  if (total === 0) return null
  const max = Math.max(...seconds)

  return (
    <ul className="space-y-2.5">
      {seconds.map((value, i) => (
        <li key={i} className="grid grid-cols-[6.5rem_1fr_auto] items-center gap-3 text-xs">
          <span className="text-muted-foreground">{zoneLabel(i + 1)}</span>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <motion.div className="h-full rounded-full" style={{ background: ZONE_COLORS[i] }} initial={{ width: 0 }} animate={{ width: `${(value / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }} />
          </div>
          <span className="min-w-[6rem] whitespace-nowrap text-right tabular text-foreground">
            {formatDuration(value)} <span className="text-muted-foreground">· {formatNumber((value / total) * 100)} %</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
