import type { Activity, ActivityDetail, NormalizedBundle, ProviderId } from './domain.ts'

/** Original provider response item, stored untouched so normalization can be re-run later. */
export interface RawRecord {
  resourceType: string
  externalId: string
  calendarDate: string | null
  payload: unknown
}

/**
 * Contract every data source implements (Garmin today; Apple Health export, Health Connect export,
 * FIT/CSV import later). Providers only fetch + normalize; storage, merging and business logic live elsewhere.
 */
export interface DataProvider {
  readonly id: ProviderId
  /** Checks credentials and returns the provider-side user id. */
  verify(): Promise<{ externalUserId: string }>
  /** Normalized records for all calendar days in [from, to] (inclusive). `onRaw` receives the untouched provider records. */
  fetchRange(from: string, to: string, onRaw?: (records: RawRecord[]) => void): Promise<NormalizedBundle>
  fetchActivityDetail(activity: Activity): Promise<ActivityDetail | null>
}

/** Higher number wins when two providers report the same thing. */
export const PROVIDER_PRIORITY: Record<ProviderId, number> = {
  garmin: 100,
  fit_import: 80,
  apple_health: 60,
  health_connect: 60,
  csv_import: 40,
}
