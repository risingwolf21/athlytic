import type { Activity, ActivityDetail, NormalizedBundle } from '../domain.ts'
import type { DataProvider, RawRecord } from '../provider.ts'
import { normalizeGarminActivityDetails, normalizeGarminRange } from './normalize.ts'
import type { GarminClient } from './types.ts'

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
    if (onRaw) {
      const records: RawRecord[] = []
      for (const [resourceType, items] of Object.entries(payload)) {
        for (const item of items as { summaryId: string; calendarDate?: string; startTimeInSeconds?: number }[]) {
          records.push({ resourceType, externalId: item.summaryId, calendarDate: item.calendarDate ?? null, payload: item })
        }
      }
      onRaw(records)
    }
    return normalizeGarminRange(payload, this.now().toISOString())
  }

  async fetchActivityDetail(activity: Activity): Promise<ActivityDetail | null> {
    const summaryId = activity.provenance.externalId
    if (!summaryId) return null
    const details = await this.client.fetchActivityDetails(summaryId)
    return details ? normalizeGarminActivityDetails(activity, details) : null
  }
}
