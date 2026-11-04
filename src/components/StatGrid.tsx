import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface StatItem {
  label: string
  value: string
  /** Secondary line such as a range or unit explanation. */
  hint?: string
}

/** Compact label/value pairs. Items with no value are dropped so cards never show rows of dashes. */
export function StatGrid({ items, className, columns = 2 }: { items: (StatItem | null | false)[]; className?: string; columns?: 2 | 3 }) {
  const visible = items.filter((i): i is StatItem => !!i)
  if (visible.length === 0) return null
  return (
    <dl className={cn('grid gap-x-4 gap-y-3', columns === 3 ? 'grid-cols-3' : 'grid-cols-2', className)}>
      {visible.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="truncate text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 text-base font-semibold tabular">{item.value}</dd>
          {item.hint && <dd className="text-xs text-muted-foreground tabular">{item.hint}</dd>}
        </div>
      ))}
    </dl>
  )
}

/** Horizontal bar with a label, the value as text (never colour alone) and an optional caption. */
export function BarRow({ label, valueText, percent, color = 'var(--primary)', caption, trailing }: { label: string; valueText: string; percent: number; color?: string; caption?: ReactNode; trailing?: ReactNode }) {
  const width = Math.max(0, Math.min(100, percent))
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0 truncate">{label}</span>
        <span className="flex shrink-0 items-center gap-2 tabular text-muted-foreground">
          {valueText}
          {trailing}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="presentation">
        <div className="h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${width}%`, background: color }} />
      </div>
      {caption && <p className="text-xs text-muted-foreground">{caption}</p>}
    </div>
  )
}

/** Small uppercase-free subsection heading inside a panel. */
export function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold">{children}</h3>
}
