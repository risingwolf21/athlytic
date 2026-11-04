import { useTranslation } from 'react-i18next'

type Group = 'sleepFeedback' | 'sleepInsight' | 'qualifier' | 'scoreFactor' | 'needFeedback' | 'breathing' | 'alignment' | 'napFeedback' | 'batteryEvent' | 'trainingEffect'

/** "POSITIVE_LONG_AND_DEEP" → "Long and deep": readable stand-in for codes without a translation. */
export function humanizeCode(code: string): string {
  const words = code.replace(/^(POSITIVE|NEGATIVE)_/, '').replace(/_\d+$/, '').replace(/_/g, ' ').trim().toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Translates Garmin's coded feedback values; unknown codes degrade to readable text instead of raw enum names. */
export function useGarminText() {
  const { t, i18n } = useTranslation()
  return (group: Group, code: string | null | undefined): string | null => {
    if (!code || code === 'NONE' || code === 'INVALID' || code === 'NOT_AVAILABLE') return null
    const key = group === 'trainingEffect' ? code.replace(/_\d+$/, '') : code
    const path = `garminCodes.${group}.${key}`
    return i18n.exists(path) ? String(t(path as never)) : humanizeCode(code)
  }
}
