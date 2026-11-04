import type { Activity, DailyMetrics } from './domain.ts'
import { PROVIDER_PRIORITY } from './provider.ts'

/** Field-wise merge: an incoming `null` never erases a known value; newer fetches win otherwise. */
export function mergeDaily(existing: DailyMetrics | undefined, incoming: DailyMetrics): DailyMetrics {
  if (!existing) return incoming
  const winner = PROVIDER_PRIORITY[incoming.provenance.source] >= PROVIDER_PRIORITY[existing.provenance.source] ? incoming : existing
  const loser = winner === incoming ? existing : incoming
  const merged: Record<string, unknown> = { ...winner }
  for (const [key, value] of Object.entries(loser)) {
    if (merged[key] === null || merged[key] === undefined) merged[key] = value
  }
  return merged as unknown as DailyMetrics
}

const POPULATED = (a: Activity) => Object.values(a).filter((v) => v !== null && v !== undefined).length

/**
 * Two activities are the same workout when they start within two minutes of each other and have the same
 * sport, or overlap for most of their duration (e.g. one device recorded, another one imported it).
 */
export function isDuplicateActivity(a: Activity, b: Activity): boolean {
  if (a.sport !== b.sport) return false
  const aStart = Date.parse(a.startTime)
  const bStart = Date.parse(b.startTime)
  if (Math.abs(aStart - bStart) <= 120_000) return true
  const overlap = Math.min(aStart + a.durationS * 1000, bStart + b.durationS * 1000) - Math.max(aStart, bStart)
  return overlap > 0.8 * Math.min(a.durationS, b.durationS) * 1000
}

/** Keeps one record per real-world workout; prefers higher-priority sources, then the more complete record. */
export function dedupeActivities(activities: Activity[]): Activity[] {
  const kept: Activity[] = []
  const sorted = [...activities].sort((a, b) => a.startTime.localeCompare(b.startTime))
  for (const candidate of sorted) {
    const idx = kept.findIndex((k) => k.id === candidate.id || isDuplicateActivity(k, candidate))
    const existing = kept[idx]
    if (!existing) {
      kept.push(candidate)
      continue
    }
    const better =
      PROVIDER_PRIORITY[candidate.provenance.source] - PROVIDER_PRIORITY[existing.provenance.source] ||
      POPULATED(candidate) - POPULATED(existing)
    if (better > 0) kept[idx] = candidate
  }
  return kept
}
