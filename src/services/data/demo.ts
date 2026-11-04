import { FixtureGarminClient } from '@shared/garmin/fixtures.ts'
import { GarminProvider } from '@shared/garmin/provider.ts'
import { todayInBerlin } from '@shared/dates.ts'
import { DEFAULT_PROFILE, type ActivityDetail, type NormalizedBundle, type SyncKind, type SyncStatus, type UserProfile } from '@shared/domain.ts'
import type { FitnessRepository } from './repository.ts'

const PROFILE_KEY = 'athlytic.demo.profile'
const NOTES_KEY = 'athlytic.demo.notes'
const GARMIN_KEY = 'athlytic.demo.garmin'

const HISTORY_START = '2025-06-01'
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/**
 * Runs the real provider pipeline (fixture Garmin payloads → normalizers) in the browser,
 * so the demo exercises exactly the code the Edge Functions run.
 */
export function createDemoRepository(): FitnessRepository {
  const provider = new GarminProvider(new FixtureGarminClient())
  let bundle: Promise<NormalizedBundle> | null = null

  const loadFixtures = () => {
    bundle ??= provider.fetchRange(HISTORY_START, todayInBerlin())
    return bundle
  }

  const garminState = () => readJson<{ connected: boolean; lastSyncedAt: string | null }>(GARMIN_KEY, { connected: true, lastSyncedAt: new Date().toISOString() })

  return {
    mode: 'demo',

    loadBundle: loadFixtures,

    loadProfile: () => Promise.resolve({ ...DEFAULT_PROFILE, displayName: 'Demo', birthYear: 1990, ...readJson<Partial<UserProfile>>(PROFILE_KEY, {}) }),

    saveProfile(profile) {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
      return Promise.resolve()
    },

    async loadActivityDetail(activityId): Promise<ActivityDetail | null> {
      const { activities } = await loadFixtures()
      const activity = activities.find((a) => a.id === activityId)
      if (!activity) return null
      const detail = await provider.fetchActivityDetail(activity)
      const notes = readJson<Record<string, string>>(NOTES_KEY, {})[activityId]
      return detail ? { ...detail, activity: { ...detail.activity, notes: notes ?? null } } : null
    },

    saveActivityNotes(activityId, notes) {
      const all = readJson<Record<string, string>>(NOTES_KEY, {})
      localStorage.setItem(NOTES_KEY, JSON.stringify({ ...all, [activityId]: notes }))
      return Promise.resolve()
    },

    loadSyncStatus(): Promise<SyncStatus> {
      const state = garminState()
      return Promise.resolve({ provider: 'garmin', connected: state.connected, lastSyncedAt: state.lastSyncedAt, historyStart: state.connected ? HISTORY_START : null, state: 'idle', error: null })
    },

    async connectGarmin() {
      await delay(500)
      localStorage.setItem(GARMIN_KEY, JSON.stringify({ connected: true, lastSyncedAt: new Date().toISOString() }))
    },

    disconnectGarmin() {
      localStorage.setItem(GARMIN_KEY, JSON.stringify({ connected: false, lastSyncedAt: null }))
      return Promise.resolve()
    },

    async sync(_kind: SyncKind) {
      await delay(900)
      localStorage.setItem(GARMIN_KEY, JSON.stringify({ connected: true, lastSyncedAt: new Date().toISOString() }))
      return { done: true }
    },
  }
}
