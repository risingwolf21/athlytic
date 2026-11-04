import { NavLink } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Activity, ChartLine, HeartPulse, LayoutDashboard, Settings, Sparkles, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  key: 'dashboard' | 'activities' | 'recovery' | 'analytics' | 'insights' | 'settings'
  icon: LucideIcon
}

/** Order matters: the primary daily destinations sit within thumb reach at the bottom. */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/', key: 'dashboard', icon: LayoutDashboard },
  { to: '/activities', key: 'activities', icon: Activity },
  { to: '/recovery', key: 'recovery', icon: HeartPulse },
  { to: '/analytics', key: 'analytics', icon: ChartLine },
  { to: '/insights', key: 'insights', icon: Sparkles },
]

const SETTINGS_NAV: NavItem = { to: '/settings', key: 'settings', icon: Settings }

export function BottomNav() {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('nav.label')} className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/85 pb-safe backdrop-blur-xl lg:hidden">
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {PRIMARY_NAV.map(({ to, key, icon: Icon }) => (
          <li key={to}>
            <NavLink to={to} end={to === '/'} className={({ isActive }) => cn('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-medium transition-colors', isActive ? 'text-primary' : 'text-muted-foreground')}>
              {({ isActive }) => (
                <>
                  <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', isActive && 'bg-primary/12')}>
                    <Icon className="size-[1.375rem]" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden />
                  </span>
                  {t(`nav.${key}`)}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function SideNav() {
  const { t } = useTranslation()
  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r bg-sidebar px-3 py-6 lg:flex">
      <div className="mb-8 flex items-center gap-2.5 px-3">
        <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" className="size-8 rounded-lg" />
        <span className="text-lg font-semibold tracking-tight">Athlytic</span>
      </div>
      <nav aria-label={t('nav.label')} className="flex flex-1 flex-col gap-1">
        {[...PRIMARY_NAV, SETTINGS_NAV].map(({ to, key, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground', key === 'settings' && 'mt-auto')}
          >
            <Icon className="size-[1.125rem]" aria-hidden />
            {t(`nav.${key}`)}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
