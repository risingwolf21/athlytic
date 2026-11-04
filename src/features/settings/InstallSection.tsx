import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, Share, SquarePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && (navigator as Navigator & { standalone?: boolean }).standalone === true)
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** iOS has no install prompt API, so Safari users get step-by-step instructions; Chromium browsers get a real button. */
export function InstallSection() {
  const { t } = useTranslation()
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return <p className="text-sm text-muted-foreground">{t('install.installed')}</p>

  if (deferred) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('install.androidIntro')}</p>
        <Button className="h-11 w-full" onClick={() => void deferred.prompt().then(() => setDeferred(null))}>
          <Download className="size-4" aria-hidden />
          {t('install.button')}
        </Button>
      </div>
    )
  }

  if (isIos()) {
    return (
      <ol className="space-y-3 text-sm">
        <li className="flex items-center gap-3">
          <Share className="size-5 shrink-0 text-primary" aria-hidden />
          {t('install.iosStep1')}
        </li>
        <li className="flex items-center gap-3">
          <SquarePlus className="size-5 shrink-0 text-primary" aria-hidden />
          {t('install.iosStep2')}
        </li>
        <li className="text-muted-foreground">{t('install.iosNote')}</li>
      </ol>
    )
  }

  return <p className="text-sm text-muted-foreground">{t('install.generic')}</p>
}
