import { Bike, Dumbbell, Footprints, Mountain, PersonStanding, Waves, Activity as ActivityIcon, type LucideIcon } from 'lucide-react'
import type { Sport } from '@shared/domain.ts'

export const SPORT_ICON: Record<Sport, LucideIcon> = {
  hiking: Mountain,
  cycling: Bike,
  running: PersonStanding,
  walking: Footprints,
  swimming: Waves,
  strength: Dumbbell,
  other: ActivityIcon,
}

export const SPORT_COLOR: Record<Sport, string> = {
  hiking: 'var(--m-elevation)',
  cycling: 'var(--m-steps)',
  running: 'var(--m-hr)',
  walking: 'var(--m-hrv)',
  swimming: 'var(--m-battery)',
  strength: 'var(--m-load)',
  other: 'var(--m-stress)',
}

export function SportIcon({ sport, className }: { sport: Sport; className?: string }) {
  const Icon = SPORT_ICON[sport]
  const color = SPORT_COLOR[sport]
  return (
    <span className={className ?? 'grid size-10 shrink-0 place-items-center rounded-xl'} style={{ background: `color-mix(in oklch, ${color} 15%, transparent)`, color }}>
      <Icon className="size-5" aria-hidden />
    </span>
  )
}
