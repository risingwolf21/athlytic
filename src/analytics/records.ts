import type { Activity, Sport } from '@shared/domain.ts'
import { addDays } from '@shared/dates.ts'
import type { DailyRecord } from './daily.ts'
import { localDate } from './load.ts'
import type { DateString } from './types.ts'
import { isNum } from './stats.ts'

export type RecordKind =
  | 'longestDistance'
  | 'longestDuration'
  | 'mostElevation'
  | 'fastestAvgSpeed'
  | 'highestTrainingLoad'
  | 'mostSteps'
  | 'bestSleepScore'
  | 'highestHrv'
  | 'lowestRestingHr'

export interface PersonalRecord {
  id: string
  kind: RecordKind
  sport: Sport | null
  value: number
  unit: 'm' | 's' | 'm/s' | 'load' | 'steps' | 'score' | 'ms' | 'bpm'
  date: DateString
  activityId: string | null
  /** Value of the record it replaced, if there was one. */
  previousValue: number | null
}

interface Candidate {
  kind: RecordKind
  sport: Sport | null
  unit: PersonalRecord['unit']
  better: 'higher' | 'lower'
  pick: (a: Activity) => number | null
  eligible?: (a: Activity) => boolean
}

const ACTIVITY_RECORDS: Candidate[] = [
  { kind: 'longestDistance', sport: 'cycling', unit: 'm', better: 'higher', pick: (a) => a.distanceM },
  { kind: 'longestDistance', sport: 'hiking', unit: 'm', better: 'higher', pick: (a) => a.distanceM },
  { kind: 'longestDuration', sport: 'cycling', unit: 's', better: 'higher', pick: (a) => a.durationS },
  { kind: 'longestDuration', sport: 'hiking', unit: 's', better: 'higher', pick: (a) => a.durationS },
  { kind: 'mostElevation', sport: 'cycling', unit: 'm', better: 'higher', pick: (a) => a.elevationGainM },
  { kind: 'mostElevation', sport: 'hiking', unit: 'm', better: 'higher', pick: (a) => a.elevationGainM },
  // Short rides would otherwise dominate; require at least 20 km.
  { kind: 'fastestAvgSpeed', sport: 'cycling', unit: 'm/s', better: 'higher', pick: (a) => a.avgSpeedMs, eligible: (a) => (a.distanceM ?? 0) >= 20_000 },
  { kind: 'highestTrainingLoad', sport: null, unit: 'load', better: 'higher', pick: (a) => a.trainingLoad },
]

const beats = (candidate: Candidate, value: number, current: number) => (candidate.better === 'higher' ? value > current : value < current)

/** Best value ever per category, plus the value it replaced (to show how much a new record improved). */
export function personalRecords(activities: readonly Activity[], records: readonly DailyRecord[]): PersonalRecord[] {
  const sorted = [...activities].sort((a, b) => a.startTime.localeCompare(b.startTime))
  const out: PersonalRecord[] = []

  for (const c of ACTIVITY_RECORDS) {
    let best = null as PersonalRecord | null
    for (const a of sorted) {
      if (c.sport && a.sport !== c.sport) continue
      if (c.eligible && !c.eligible(a)) continue
      const v = c.pick(a)
      if (!isNum(v)) continue
      if (!best || beats(c, v, best.value)) {
        best = { id: `${c.kind}:${c.sport ?? 'all'}`, kind: c.kind, sport: c.sport, value: v, unit: c.unit, date: localDate(a.startTime), activityId: a.id, previousValue: best?.value ?? null }
      }
    }
    if (best) out.push(best)
  }

  const daily: { kind: RecordKind; unit: PersonalRecord['unit']; better: 'higher' | 'lower'; pick: (r: DailyRecord) => number | null }[] = [
    { kind: 'mostSteps', unit: 'steps', better: 'higher', pick: (r) => r.steps },
    { kind: 'bestSleepScore', unit: 'score', better: 'higher', pick: (r) => r.sleepScore },
    { kind: 'highestHrv', unit: 'ms', better: 'higher', pick: (r) => r.hrv },
    { kind: 'lowestRestingHr', unit: 'bpm', better: 'lower', pick: (r) => r.restingHr },
  ]
  for (const c of daily) {
    let best = null as PersonalRecord | null
    for (const r of records) {
      const v = c.pick(r)
      if (!isNum(v)) continue
      if (!best || (c.better === 'higher' ? v > best.value : v < best.value)) {
        best = { id: `${c.kind}:all`, kind: c.kind, sport: null, value: v, unit: c.unit, date: r.date, activityId: null, previousValue: best?.value ?? null }
      }
    }
    if (best) out.push(best)
  }
  return out
}

export const isRecent = (record: PersonalRecord, today: DateString, days = 14) => record.date >= addDays(today, -days)
