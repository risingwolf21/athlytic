import type { ActivityDetail, NormalizedBundle, SyncKind, SyncStatus, UserProfile } from '@shared/domain.ts'

/**
 * Everything the UI needs from the backend. Two implementations exist: `demo` (fixtures + localStorage,
 * no network) and `supabase` (Postgres via RLS-protected queries and Edge Functions).
 * Components never talk to either directly; they use the hooks in `src/hooks`.
 */
export interface FitnessRepository {
  readonly mode: 'demo' | 'supabase'
  loadBundle(): Promise<NormalizedBundle>
  loadProfile(): Promise<UserProfile>
  saveProfile(profile: UserProfile): Promise<void>
  loadActivityDetail(activityId: string): Promise<ActivityDetail | null>
  saveActivityNotes(activityId: string, notes: string): Promise<void>
  loadSyncStatus(): Promise<SyncStatus>
  /** Connects Garmin with a personal API token. The token is sent to an Edge Function and never stored in the browser. */
  connectGarmin(token: string): Promise<void>
  disconnectGarmin(): Promise<void>
  /** Runs one resumable sync step; returns whether more work remains (historical import continues in slices). */
  sync(kind: SyncKind): Promise<{ done: boolean }>
}

export const queryKeys = {
  bundle: ['bundle'] as const,
  profile: ['profile'] as const,
  syncStatus: ['sync-status'] as const,
  activityDetail: (id: string) => ['activity-detail', id] as const,
}
