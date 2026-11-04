import { useEffect } from 'react'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CloudOff, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { useConnectivityStore } from '@/stores/connectivity'
import { cn } from '@/lib/utils'

/** Thin status strip: offline notice (data shown comes from the local cache) or pending sync. */
export function ConnectionBanner() {
  const { t } = useTranslation()
  const online = useConnectivityStore((s) => s.online)
  const fetching = useIsFetching()
  const mutating = useIsMutating()
  const syncing = online && (fetching > 0 || mutating > 0)

  if (online && !syncing) return null
  return (
    <div role="status" aria-live="polite" className={cn('flex items-center justify-center gap-2 px-4 py-1.5 text-xs font-medium', online ? 'bg-primary/10 text-primary' : 'bg-attention/15 text-attention')}>
      {online ? <RefreshCw className="size-3.5 animate-spin" aria-hidden /> : <CloudOff className="size-3.5" aria-hidden />}
      {online ? t('offline.syncing') : t('offline.banner')}
    </div>
  )
}

/** Offers a waiting service worker without applying it on its own, so nothing the user is doing gets interrupted. */
export function UpdatePrompt() {
  const { t } = useTranslation()
  const updateReady = useConnectivityStore((s) => s.updateReady)
  const applyUpdate = useConnectivityStore((s) => s.applyUpdate)

  useEffect(() => {
    if (!updateReady || !applyUpdate) return
    const id = toast(t('update.title'), {
      description: t('update.description'),
      duration: Infinity,
      action: { label: t('update.action'), onClick: () => void applyUpdate() },
    })
    return () => {
      toast.dismiss(id)
    }
  }, [updateReady, applyUpdate, t])

  return null
}
