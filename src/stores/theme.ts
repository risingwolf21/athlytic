import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeState {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      preference: 'system',
      setPreference: (preference) => set({ preference }),
    }),
    { name: 'athlytic.theme' },
  ),
)

export const systemTheme = (): ResolvedTheme =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'

export const resolveTheme = (preference: ThemePreference): ResolvedTheme => (preference === 'system' ? systemTheme() : preference)

const THEME_COLORS: Record<ResolvedTheme, string> = { light: '#f7f5f0', dark: '#0d0f0e' }

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(preference)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', THEME_COLORS[resolved]))
  return resolved
}
