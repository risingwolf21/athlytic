import { formatDate, parseDate } from '@shared/dates.ts'
import { METRICS, type MetricKey } from '@/analytics'

/** All formatting goes through Intl with this locale and metric units; swap it when more languages are added. */
let locale = 'de-DE'
export const setFormatLocale = (value: string) => {
  locale = value
}

const numberFormats = new Map<number, Intl.NumberFormat>()
export function formatNumber(value: number, decimals = 0): string {
  let nf = numberFormats.get(decimals)
  if (!nf) {
    nf = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    numberFormats.set(decimals, nf)
  }
  return nf.format(value)
}

export const MISSING = '–'

export function formatMetricValue(key: MetricKey, value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return MISSING
  return formatNumber(value, METRICS[key].decimals)
}

/** 5 025 s → "1:24 h"; below an hour "42 min". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return MISSING
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')} h` : `${minutes} min`
}

export function formatHours(hours: number | null | undefined): string {
  return hours === null || hours === undefined ? MISSING : formatDuration(hours * 3600)
}

export function formatDistanceKm(meters: number | null | undefined, decimals = 1): string {
  return meters === null || meters === undefined ? MISSING : formatNumber(meters / 1000, decimals)
}

export const msToKmh = (ms: number) => ms * 3.6

export function formatSpeedKmh(ms: number | null | undefined): string {
  return ms === null || ms === undefined ? MISSING : formatNumber(msToKmh(ms), 1)
}

/** Pace in min/km, e.g. 1.2 m/s → "13:53". */
export function formatPace(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return MISSING
  const secondsPerKm = 1000 / ms
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const dateFormats = {
  short: { day: 'numeric', month: 'short' },
  medium: { weekday: 'short', day: 'numeric', month: 'short' },
  long: { weekday: 'long', day: 'numeric', month: 'long' },
  month: { month: 'long', year: 'numeric' },
  monthShort: { month: 'short' },
  year: { year: 'numeric' },
  weekdayShort: { weekday: 'short' },
  full: { day: 'numeric', month: 'long', year: 'numeric' },
} as const satisfies Record<string, Intl.DateTimeFormatOptions>

export type DateStyle = keyof typeof dateFormats

/** Formats a calendar day (YYYY-MM-DD) without time zone shifts. */
export function formatDay(date: string, style: DateStyle = 'short'): string {
  return new Intl.DateTimeFormat(locale, { ...dateFormats[style], timeZone: 'UTC' }).format(parseDate(date))
}

export function formatClock(iso: string): string {
  return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(iso))
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).format(new Date(iso))
}

export function formatRelativeDays(date: string, today: string): 'today' | 'yesterday' | null {
  if (date === today) return 'today'
  if (formatDate(parseDate(today) - 86_400_000) === date) return 'yesterday'
  return null
}

export const formatSigned = (value: number, decimals = 0): string => `${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumber(Math.abs(value), decimals)}`
export const formatPercent = (ratio: number, decimals = 0): string => `${formatSigned(ratio * 100, decimals)} %`
