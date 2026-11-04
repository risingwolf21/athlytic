import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronRight, LogOut } from 'lucide-react'
import { PageHeader, Panel, Section } from '@/components/page'
import { Segmented } from '@/components/Segmented'
import { Button } from '@/components/ui/button'
import { GarminSection } from '@/features/settings/GarminSection'
import { InstallSection } from '@/features/settings/InstallSection'
import { ProfileForm } from '@/features/settings/ProfileForm'
import { dataMode } from '@/lib/env'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore, type ThemePreference } from '@/stores/theme'

const THEMES: ThemePreference[] = ['light', 'system', 'dark']

export default function SettingsPage() {
  const { t } = useTranslation()
  const email = useAuthStore((s) => s.email)
  const signOut = useAuthStore((s) => s.signOut)
  const preference = useThemeStore((s) => s.preference)
  const setPreference = useThemeStore((s) => s.setPreference)

  return (
    <div className="space-y-6">
      <PageHeader title={t('settings.title')} subtitle={email ?? undefined} />

      <Section title={t('settings.appearance')}>
        <Panel>
          <Segmented label={t('settings.appearance')} value={preference} onChange={setPreference} options={THEMES.map((value) => ({ value, label: t(`settings.themes.${value}`) }))} className="w-full" />
        </Panel>
      </Section>

      <Section title={t('settings.garmin')}>
        <Panel>
          <GarminSection />
        </Panel>
      </Section>

      <Section title={t('settings.profile')}>
        <Panel>
          <ProfileForm />
        </Panel>
      </Section>

      <Section title={t('settings.install')}>
        <Panel>
          <InstallSection />
        </Panel>
      </Section>

      <Section title={t('settings.sources')}>
        <Panel className="space-y-2 text-sm text-muted-foreground">
          <p>{t('settings.sourcesBody')}</p>
        </Panel>
      </Section>

      <div className="surface overflow-hidden rounded-2xl">
        <Link to="/insights/methods" className="flex min-h-12 items-center justify-between px-4 py-3 text-sm font-medium active:bg-muted">
          {t('settings.methods')}
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      </div>

      {dataMode === 'supabase' && (
        <Button variant="outline" className="h-11 w-full" onClick={() => void signOut()}>
          <LogOut className="size-4" aria-hidden />
          {t('settings.signOut')}
        </Button>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Athlytic · {dataMode === 'demo' ? t('settings.demoMode') : t('settings.liveMode')}
      </p>
    </div>
  )
}
