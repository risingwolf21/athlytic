import { useTranslation } from 'react-i18next'
import { Calculator, Radio } from 'lucide-react'
import type { ValueKind } from '@/analytics'
import { cn } from '@/lib/utils'

/** Marks a number as reported by the device or derived by Athlytic. */
export function KindBadge({ kind, className, compact = false }: { kind: ValueKind; className?: string; compact?: boolean }) {
  const { t } = useTranslation()
  const Icon = kind === 'measured' ? Radio : Calculator
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] font-medium text-muted-foreground', className)} title={t(`kind.${kind}Hint`)}>
      <Icon className="size-3" aria-hidden />
      {!compact && t(`kind.${kind}`)}
      {compact && <span className="sr-only">{t(`kind.${kind}`)}</span>}
    </span>
  )
}
