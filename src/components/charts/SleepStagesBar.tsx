import { motion } from 'motion/react'
import { formatDuration, formatNumber } from '@/lib/format'

interface SleepStagesBarProps {
  deepS: number | null
  lightS: number | null
  remS: number | null
  awakeS: number | null
  labels: { deep: string; light: string; rem: string; awake: string }
}

const STAGES = [
  { key: 'deep', color: 'color-mix(in oklch, var(--m-sleep) 100%, black 22%)' },
  { key: 'rem', color: 'var(--m-sleep)' },
  { key: 'light', color: 'color-mix(in oklch, var(--m-sleep) 45%, transparent)' },
  { key: 'awake', color: 'color-mix(in oklch, var(--m-stress) 70%, transparent)' },
] as const

/** Sleep composition as one stacked bar with a legend of durations and shares. */
export function SleepStagesBar({ deepS, lightS, remS, awakeS, labels }: SleepStagesBarProps) {
  const seconds = { deep: deepS, rem: remS, light: lightS, awake: awakeS }
  const total = Object.values(seconds).reduce<number>((sum, v) => sum + (v ?? 0), 0)
  if (total === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={STAGES.map((s) => `${labels[s.key]} ${formatDuration(seconds[s.key])}`).join(', ')}>
        {STAGES.map((stage, i) => {
          const value = seconds[stage.key]
          if (!value) return null
          return <motion.div key={stage.key} style={{ background: stage.color }} initial={{ width: 0 }} animate={{ width: `${(value / total) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }} />
        })}
      </div>
      <dl className="grid grid-cols-4 gap-2 text-xs">
        {STAGES.map((stage) => {
          const value = seconds[stage.key]
          return (
            <div key={stage.key} className="min-w-0">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2 shrink-0 rounded-full" style={{ background: stage.color }} />
                <span className="truncate">{labels[stage.key]}</span>
              </dt>
              <dd className="mt-0.5 font-medium tabular">{formatDuration(value)}</dd>
              <dd className="text-muted-foreground tabular">{value ? `${formatNumber((value / total) * 100)} %` : ''}</dd>
            </div>
          )
        })}
      </dl>
    </div>
  )
}
