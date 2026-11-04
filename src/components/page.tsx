import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Inbox, RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function PageHeader({ title, subtitle, action, className }: { title: string; subtitle?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <header className={cn('flex items-end justify-between gap-3 pt-2 pb-4', className)}>
      <div className="min-w-0">
        <h1 className="truncate text-[1.75rem] leading-tight font-semibold">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

export function Section({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-3', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 px-1">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('surface rounded-2xl p-4', className)}>{children}</div>
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed px-6 py-10 text-center">
      <Inbox className="size-7 text-muted-foreground" aria-hidden />
      <p className="font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error?: Error | null; onRetry?: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <AlertTriangle className="size-7 text-destructive" aria-hidden />
      <p className="font-medium">{t('common.loadError')}</p>
      {error?.message && <p className="max-w-sm text-sm text-muted-foreground">{error.message}</p>}
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RotateCw className="size-4" aria-hidden />
          {t('common.retry')}
        </Button>
      )}
    </div>
  )
}

/** Skeleton shaped like the dashboard so layout does not jump when the data arrives. */
export function PageSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <Skeleton className="h-40 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-36 rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
