import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useConnectGarmin, useDisconnectGarmin, useSync, useSyncStatus } from '@/hooks/use-fitness-data'
import { dataMode } from '@/lib/env'
import { formatDateTime, formatDay } from '@/lib/format'
import { useConnectivityStore } from '@/stores/connectivity'

export function GarminSection() {
  const { t } = useTranslation()
  const status = useSyncStatus()
  const connect = useConnectGarmin()
  const disconnect = useDisconnectGarmin()
  const sync = useSync()
  const online = useConnectivityStore((s) => s.online)
  const [token, setToken] = useState('')
  const s = status.data
  const running = sync.isPending || s?.state === 'running'

  const onConnect = (e: React.FormEvent) => {
    e.preventDefault()
    if (!token.trim()) return
    connect.mutate(token.trim(), {
      onSuccess: () => {
        setToken('')
        toast.success(t('garmin.connected'))
        sync.mutate('historical')
      },
      onError: (error) => toast.error(error.message),
    })
  }

  const runSync = (kind: 'incremental' | 'historical') =>
    sync.mutate(kind, { onSuccess: () => toast.success(t('garmin.synced')), onError: (error) => toast.error(error.message) })

  return (
    <div className="space-y-4">
      {dataMode === 'demo' && <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">{t('garmin.demoNote')}</p>}

      {s?.connected ? (
        <>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-positive" aria-hidden />
            <div className="text-sm">
              <p className="font-medium">{t('garmin.connectedTitle')}</p>
              <p className="text-muted-foreground">
                {s.lastSyncedAt ? t('garmin.lastSync', { when: formatDateTime(s.lastSyncedAt) }) : t('garmin.neverSynced')}
                {s.historyStart && ` · ${t('garmin.historyFrom', { date: formatDay(s.historyStart, 'full') })}`}
              </p>
              {s.state === 'error' && s.error && <p className="mt-1 text-destructive">{s.error}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row [&>*]:flex-1">
            <Button className="h-11" disabled={!online || running} onClick={() => runSync('incremental')}>
              <RefreshCw className={`size-4 ${running ? 'animate-spin' : ''}`} aria-hidden />
              {t('garmin.syncNow')}
            </Button>
            <Button className="h-11" variant="outline" disabled={!online || running} onClick={() => runSync('historical')}>
              {t('garmin.importHistory')}
            </Button>
          </div>
          <Button variant="ghost" className="w-full text-destructive" disabled={!online || disconnect.isPending} onClick={() => disconnect.mutate(undefined, { onSuccess: () => toast.success(t('garmin.disconnected')) })}>
            {t('garmin.disconnect')}
          </Button>
        </>
      ) : (
        <form onSubmit={onConnect} className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('garmin.connectIntro')}</p>
          <div className="space-y-1.5">
            <Label htmlFor="garmin-token">{t('garmin.token')}</Label>
            <Input id="garmin-token" type="password" autoComplete="off" className="h-11" value={token} onChange={(e) => setToken(e.target.value)} />
            <p className="text-xs text-muted-foreground">{t('garmin.tokenHint')}</p>
          </div>
          <Button type="submit" className="h-11 w-full" disabled={!online || !token.trim() || connect.isPending}>
            {t('garmin.connect')}
          </Button>
        </form>
      )}
    </div>
  )
}
