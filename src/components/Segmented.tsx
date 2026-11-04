import { useId } from 'react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

interface SegmentedOption<T extends string> {
  value: T
  label: string
}

interface SegmentedProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  className?: string
}

/** Compact pill switcher with a sliding highlight; large touch targets for one-handed use. */
export function Segmented<T extends string>({ options, value, onChange, label, className }: SegmentedProps<T>) {
  const id = useId()
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-full bg-muted p-1', className)}>
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn('relative min-h-9 flex-1 rounded-full px-3.5 text-sm font-medium whitespace-nowrap transition-colors', active ? 'text-foreground' : 'text-muted-foreground')}
          >
            {active && <motion.span layoutId={`segmented-${id}`} className="absolute inset-0 rounded-full bg-card shadow-sm ring-1 ring-border" transition={{ type: 'spring', stiffness: 520, damping: 38 }} />}
            <span className="relative">{option.label}</span>
          </button>
        )
      })}
    </div>
  )
}
