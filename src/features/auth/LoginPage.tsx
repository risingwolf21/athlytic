import { useState } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Panel } from '@/components/page'
import { useAuthStore } from '@/stores/auth'

type Mode = 'signIn' | 'signUp'

export default function LoginPage() {
  const { t } = useTranslation()
  const status = useAuthStore((s) => s.status)
  const signIn = useAuthStore((s) => s.signIn)
  const signUp = useAuthStore((s) => s.signUp)
  const location = useLocation()
  const [mode, setMode] = useState<Mode>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  if (status === 'signedIn') return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await (mode === 'signIn' ? signIn(email, password) : signUp(email, password))
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      toast.error(message === 'CONFIRM_EMAIL' ? t('auth.confirmEmail') : message === 'Invalid login credentials' ? t('auth.invalidCredentials') : message || t('auth.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-5 py-10 pt-safe pb-safe">
      <div className="space-y-2 text-center">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="mx-auto size-16 rounded-2xl shadow-md" />
        <h1 className="text-3xl font-semibold">Athlytic</h1>
        <p className="text-sm text-muted-foreground">{t('auth.tagline')}</p>
      </div>
      <Panel>
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t('auth.email')}</Label>
            <Input id="email" type="email" autoComplete="email" required className="h-11" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t('auth.password')}</Label>
            <Input id="password" type="password" autoComplete={mode === 'signIn' ? 'current-password' : 'new-password'} required minLength={8} className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} />
            {mode === 'signUp' && <p className="text-xs text-muted-foreground">{t('auth.passwordHint')}</p>}
          </div>
          <Button type="submit" className="h-11 w-full" disabled={busy || status === 'loading'}>
            {mode === 'signIn' ? t('auth.signIn') : t('auth.signUp')}
          </Button>
        </form>
      </Panel>
      <button type="button" className="min-h-10 text-sm font-medium text-primary" onClick={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}>
        {mode === 'signIn' ? t('auth.toSignUp') : t('auth.toSignIn')}
      </button>
    </div>
  )
}
