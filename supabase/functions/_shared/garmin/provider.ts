import type { Activity, ActivityDetail, NormalizedBundle } from '../domain.ts'
import type { DataProvider, RawRecord } from '../provider.ts'
import { normalizeGarminActivityDetails, normalizeGarminRange } from './normalize.ts'
import type { GarminClient, GarminRangePayload } from './types.ts'

const MAPPED_RESOURCES = ['dailies', 'stressDetails', 'sleeps', 'hrv', 'userMetrics', 'activities'] as const

/** Fallback for clients that do not keep the original responses (e.g. the fixture client). */
function rawFromMapped(payload: GarminRangePayload): RawRecord[] {
  return MAPPED_RESOURCES.flatMap((resourceType) =>
    (payload[resourceType] as { summaryId: string; calendarDate?: string }[]).map((item) => ({
      resourceType,
      externalId: item.summaryId,
      calendarDate: item.calendarDate ?? null,
      payload: item,
    })),
  )
}

export class GarminProvider implements DataProvider {
  readonly id = 'garmin' as const

  private readonly client: GarminClient
  private readonly now: () => Date

  constructor(client: GarminClient, now: () => Date = () => new Date()) {
    this.client = client
    this.now = now
  }

  async verify() {
    const { userId } = await this.client.ping()
    return { externalUserId: userId }
  }

  async fetchRange(from: string, to: string, onRaw?: (records: RawRecord[]) => void): Promise<NormalizedBundle> {
    const payload = await this.client.fetchRange(from, to)
    if (onRaw) onRaw(payload.raw ?? rawFromMapped(payload))
    return normalizeGarminRange(payload, this.now().toISOString())
  }

  async fetchActivityDetail(activity: Activity): Promise<ActivityDetail | null> {
    const summaryId = activity.provenance.externalId
    if (!summaryId) return null
    const details = await this.client.fetchActivityDetails(summaryId)
    return details ? normalizeGarminActivityDetails(activity, details) : null
  }
}
