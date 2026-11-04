import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { setFormatLocale } from '@/lib/format'
import { de } from './locales/de.ts'

export const DEFAULT_LOCALE = 'de'

/** German only for now; adding a language means adding `locales/<code>.ts` and registering it here. */
void i18n.use(initReactI18next).init({
  lng: DEFAULT_LOCALE,
  fallbackLng: DEFAULT_LOCALE,
  resources: { de: { translation: de } },
  interpolation: { escapeValue: false },
  returnNull: false,
})

setFormatLocale(DEFAULT_LOCALE)
document.documentElement.lang = DEFAULT_LOCALE

export default i18n
