/** Calendar-day helpers operating on `YYYY-MM-DD` strings in UTC (no local-time surprises). */

const DAY_MS = 86_400_000

export function parseDate(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return Date.UTC(y, m - 1, d)
}

export function formatDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  return formatDate(parseDate(date) + days * DAY_MS)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to) - parseDate(from)) / DAY_MS)
}

/** Inclusive list of days from `from` to `to`. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = []
  for (let ms = parseDate(from); ms <= parseDate(to); ms += DAY_MS) out.push(formatDate(ms))
  return out
}

/** 0 = Monday … 6 = Sunday. */
export function isoWeekday(date: string): number {
  return (new Date(parseDate(date)).getUTCDay() + 6) % 7
}

export function todayInBerlin(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(now)
}

function lastSunday(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0))
  return lastDay.getUTCDate() - lastDay.getUTCDay()
}

/** UTC offset of Europe/Berlin for a calendar day (EU daylight-saving rule). */
export function berlinOffsetSeconds(date: string): number {
  const ms = parseDate(date)
  const year = new Date(ms).getUTCFullYear()
  const start = Date.UTC(year, 2, lastSunday(year, 2))
  const end = Date.UTC(year, 9, lastSunday(year, 9))
  return ms >= start && ms < end ? 7200 : 3600
}

/** Epoch seconds of local midnight of a Berlin calendar day. */
export function berlinMidnightEpoch(date: string): number {
  return Math.floor(parseDate(date) / 1000) - berlinOffsetSeconds(date)
}
