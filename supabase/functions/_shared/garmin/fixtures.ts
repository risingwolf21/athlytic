import { berlinMidnightEpoch, berlinOffsetSeconds, eachDay, isoWeekday, todayInBerlin, addDays } from '../dates.ts'
import type { ActivityExtra } from '../domain.ts'
import { clamp, createRng, gaussian, hashString, type Rng } from '../prng.ts'
import type {
  GarminActivity,
  GarminActivityDetails,
  GarminActivitySample,
  GarminClient,
  GarminDaily,
  GarminFitnessAge,
  GarminHrv,
  GarminHrZones,
  GarminIntradaySeries,
  GarminRangePayload,
  GarminSleep,
  GarminStressDetails,
  GarminUserMetrics,
  GarminWeight,
} from './types.ts'

/**
 * Deterministic Garmin-shaped fixtures. Simulates a hiking/cycling focused athlete with
 * training → recovery coupling (hard days lower next-morning HRV and raise resting HR),
 * an illness block, and a few missing days, so analytics have realistic structure to find.
 */

const SIM_EPOCH = '2025-06-01'
const SIM_MAX_HR = 190
const ILLNESS_STARTS = ['2025-11-17', '2026-09-21']
const WATCH_OFF_DAYS = new Set(['2025-12-27', '2025-12-28', '2026-03-14', '2026-08-02'])

type ActivityKind = 'hike_long' | 'hike_short' | 'ride_long' | 'ride_tempo' | 'ride_easy' | 'run' | 'strength'

interface SimActivity {
  summary: GarminActivity
  kind: ActivityKind
  startOffsetS: number
  durationS: number
  hrAt: (secondsFromStart: number) => number
}

interface SimDay {
  date: string
  daily: GarminDaily
  sleep: GarminSleep | null
  hrv: GarminHrv | null
  metrics: GarminUserMetrics
  stress: GarminStressDetails
  activities: SimActivity[]
  restingHr: number
  wakeBattery: number
  lowBattery: number
  bedtimeOffsetS: number
  sleepSeconds: number
  hrvValue: number
}

const TRAILHEADS = [
  { lat: 48.6046, lng: 8.2018, ele: 1000, name: 'Hornisgrinde' },
  { lat: 48.7455, lng: 8.4285, ele: 400, name: 'Bad Herrenalb' },
  { lat: 48.5522, lng: 8.2397, ele: 800, name: 'Schliffkopf' },
  { lat: 48.9371, lng: 8.4136, ele: 190, name: 'Albtal' },
  { lat: 48.7016, lng: 8.3361, ele: 600, name: 'Kaltenbronn' },
]
const KARLSRUHE = { lat: 49.0069, lng: 8.4037, ele: 115 }

function hrZoneIndex(hr: number): number {
  const pct = hr / SIM_MAX_HR
  if (pct < 0.6) return 0
  if (pct < 0.7) return 1
  if (pct < 0.8) return 2
  if (pct < 0.9) return 3
  return 4
}

function smoothNoise(rng: Rng, n: number, scale: number): number[] {
  const out: number[] = []
  let v = 0
  for (let i = 0; i < n; i++) {
    v = v * 0.96 + gaussian(rng) * scale
    out.push(v)
  }
  return out
}

interface RouteSpec {
  kind: ActivityKind
  distanceM: number
  gainM: number
  start: { lat: number; lng: number; ele: number }
  loop: boolean
}

function buildRoute(rng: Rng, spec: RouteSpec) {
  const ds = 20
  const n = Math.max(20, Math.round(spec.distanceM / ds))
  const lat: number[] = []
  const lng: number[] = []
  let la = spec.start.lat
  let lo = spec.start.lng
  let heading = rng() * Math.PI * 2
  const wander = smoothNoise(rng, n, 0.05)
  for (let i = 0; i < n; i++) {
    lat.push(la)
    lng.push(lo)
    const progress = i / n
    heading += (wander[i] ?? 0) * 0.5
    if (spec.loop && progress > 0.45) {
      const toStart = Math.atan2(spec.start.lng - lo, spec.start.lat - la)
      let diff = toStart - heading
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      heading += diff * clamp((progress - 0.45) * 0.5, 0, 0.35)
    }
    la += (ds * Math.cos(heading)) / 111_320
    lo += (ds * Math.sin(heading)) / (111_320 * Math.cos((la * Math.PI) / 180))
  }

  const waves = [1.5, 3.5, 7.5, 15].map((f) => ({ f, a: 1 / Math.sqrt(f), phi: rng() * Math.PI * 2 }))
  const raw = Array.from({ length: n }, (_, i) =>
    waves.reduce((s, w) => s + w.a * Math.sin((2 * Math.PI * w.f * i) / n + w.phi), 0),
  )
  let rawGain = 0
  for (let i = 1; i < n; i++) rawGain += Math.max(0, (raw[i] ?? 0) - (raw[i - 1] ?? 0))
  const scale = spec.gainM / Math.max(rawGain, 1e-6)
  const first = raw[0] ?? 0
  const last = raw[n - 1] ?? 0
  const ele = raw.map((v, i) => {
    const detrend = spec.loop ? ((last - first) * i) / n : 0
    return Math.round((spec.start.ele + (v - first - detrend) * scale) * 10) / 10
  })
  return { ds, n, lat, lng, ele }
}

interface Simulated {
  samples: GarminActivitySample[]
  laps: { startTimeInSeconds: number }[]
  hrBySecond: (s: number) => number
}

function simulateTrack(rng: Rng, spec: RouteSpec, startEpoch: number, restingHr: number): Simulated {
  const route = buildRoute(rng, spec)
  const isHike = spec.kind.startsWith('hike')
  const dt = isHike ? 15 : 10
  const flat = isHike ? 1.22 + rng() * 0.12 : 6.6 + rng() * 1.2
  const baseEffort =
    spec.kind === 'ride_tempo' ? 0.74 : spec.kind === 'ride_easy' ? 0.5 : spec.kind === 'ride_long' ? 0.6 : 0.5 + rng() * 0.06
  const effortNoise = smoothNoise(rng, 4000, 0.02)
  const stops = Array.from({ length: isHike ? 2 : 4 + Math.floor(rng() * 4) }, () => ({
    at: Math.floor(route.n * (0.15 + rng() * 0.7)),
    dur: isHike ? 300 + rng() * 600 : 20 + rng() * 40,
    done: false,
  }))
  const lapEveryM = isHike ? 1000 : 5000

  const samples: GarminActivitySample[] = []
  const laps: { startTimeInSeconds: number }[] = [{ startTimeInSeconds: startEpoch }]
  const hrSeries: number[] = []
  let idx = 0
  let t = 0
  let dist = 0
  let hr = restingHr + 25
  let stopLeft = 0
  let nextLap = lapEveryM
  while (idx < route.n - 1 && t < 12 * 3600) {
    const i = Math.floor(idx)
    const frac = idx - i
    const at = <T extends number>(a: T[]) => (a[i] ?? 0) * (1 - frac) + (a[Math.min(i + 1, route.n - 1)] ?? 0) * frac
    const slope = clamp(((route.ele[Math.min(i + 1, route.n - 1)] ?? 0) - (route.ele[i] ?? 0)) / route.ds, -0.25, 0.25)
    for (const s of stops) {
      if (!s.done && i >= s.at) {
        s.done = true
        stopLeft = s.dur
      }
    }
    const stopped = stopLeft > 0
    let v: number
    if (stopped) {
      v = 0
      stopLeft -= dt
    } else if (isHike) {
      v = flat * Math.exp(-3.2 * Math.max(0, slope)) * (1 + Math.min(0.25, Math.max(0, -slope) * 1.6)) * (1 - t / 400_000)
    } else {
      v = flat * Math.exp(-11 * Math.max(0, slope)) * (1 + Math.min(1.1, Math.max(0, -slope) * 7)) * (1 - t / 500_000)
    }
    v = clamp(v * (1 + (effortNoise[Math.floor(t / dt) % 4000] ?? 0) * 0.5), 0, isHike ? 2.2 : 14)

    let effort = baseEffort + 2.2 * Math.max(slope, -0.04) + (effortNoise[Math.floor(t / dt) % 4000] ?? 0) + t / 90_000
    if (spec.kind === 'ride_tempo' && Math.floor(t / 300) % 4 === 3) effort += 0.14
    if (stopped) effort = 0.22
    const target = restingHr + (SIM_MAX_HR - restingHr) * clamp(effort, 0.15, 0.98)
    hr += (target - hr) * clamp(dt / 35, 0, 1)
    hrSeries.push(hr)

    samples.push({
      startTimeInSeconds: Math.round(startEpoch + t),
      latitudeInDegree: Math.round(at(route.lat) * 1e6) / 1e6,
      longitudeInDegree: Math.round(at(route.lng) * 1e6) / 1e6,
      elevationInMeters: Math.round(at(route.ele) * 10) / 10,
      heartRateInBeatsPerMinute: Math.round(hr),
      speedMetersPerSecond: Math.round(v * 100) / 100,
      ...(isHike
        ? { stepsPerMinute: stopped ? 0 : Math.round(clamp(112 - slope * 60 + gaussian(rng) * 3, 70, 130)) }
        : { bikeCadenceInRPM: stopped || slope < -0.035 ? 0 : Math.round(clamp(86 - slope * 80 + gaussian(rng) * 4, 55, 110)) }),
      totalDistanceInMeters: Math.round(dist),
    })
    idx += (v * dt) / route.ds
    dist += v * dt
    t += dt
    if (dist >= nextLap) {
      laps.push({ startTimeInSeconds: Math.round(startEpoch + t) })
      nextLap += lapEveryM
    }
  }
  return {
    samples,
    laps,
    hrBySecond: (s) => hrSeries[clamp(Math.floor(s / dt), 0, hrSeries.length - 1)] ?? restingHr,
  }
}

function summarize(
  activityId: number,
  kind: ActivityKind,
  name: string,
  startEpoch: number,
  offset: number,
  sim: Simulated,
): GarminActivity {
  const { samples } = sim
  const dt = samples.length > 1 ? (samples[1]!.startTimeInSeconds - samples[0]!.startTimeInSeconds) : 10
  const durationS = (samples[samples.length - 1]?.startTimeInSeconds ?? startEpoch) - startEpoch + dt
  const moving = samples.filter((s) => (s.speedMetersPerSecond ?? 0) > 0.3).length * dt
  const distance = (samples[samples.length - 1]?.totalDistanceInMeters ?? 0)
  let gain = 0
  let loss = 0
  for (let i = 1; i < samples.length; i++) {
    const d = (samples[i]!.elevationInMeters ?? 0) - (samples[i - 1]!.elevationInMeters ?? 0)
    if (d > 0) gain += d
    else loss -= d
  }
  const hrs = samples.map((s) => s.heartRateInBeatsPerMinute ?? 0)
  const zones = [0, 0, 0, 0, 0]
  for (const h of hrs) zones[hrZoneIndex(h)]! += dt
  const trimp = zones.reduce((s, sec, z) => s + (sec / 60) * (z + 1), 0)
  const cadences = samples.map((s) => s.bikeCadenceInRPM ?? s.stepsPerMinute ?? 0).filter((c) => c > 0)
  const isHike = kind.startsWith('hike')
  const first = samples[0]
  return {
    summaryId: `fx-${activityId}`,
    activityId,
    activityName: name,
    activityType: isHike ? 'HIKING' : 'CYCLING',
    startTimeInSeconds: startEpoch,
    startTimeOffsetInSeconds: offset,
    durationInSeconds: durationS,
    movingDurationInSeconds: moving,
    distanceInMeters: Math.round(distance),
    averageSpeedInMetersPerSecond: Math.round((distance / Math.max(moving, 1)) * 100) / 100,
    maxSpeedInMetersPerSecond: Math.max(...samples.map((s) => s.speedMetersPerSecond ?? 0)),
    averageHeartRateInBeatsPerMinute: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length),
    maxHeartRateInBeatsPerMinute: Math.max(...hrs),
    ...(isHike
      ? { averageRunCadenceInStepsPerMinute: Math.round(cadences.reduce((a, b) => a + b, 0) / Math.max(cadences.length, 1)) }
      : { averageBikeCadenceInRoundsPerMinute: Math.round(cadences.reduce((a, b) => a + b, 0) / Math.max(cadences.length, 1)) }),
    totalElevationGainInMeters: Math.round(gain),
    totalElevationLossInMeters: Math.round(loss),
    activeKilocalories: Math.round((durationS / 3600) * (isHike ? 430 : 560)),
    aerobicTrainingEffect: Math.round(clamp(0.5 + 1.3 * Math.log(1 + trimp / 40), 0, 5) * 10) / 10,
    anaerobicTrainingEffect: Math.round(clamp(kind === 'ride_tempo' ? 0.4 + trimp / 300 : trimp / 600, 0, 3.5) * 10) / 10,
    activityTrainingLoad: Math.round(trimp * 0.5),
    timeInHeartRateZonesInSeconds: zones,
    startingLatitudeInDegree: first?.latitudeInDegree,
    startingLongitudeInDegree: first?.longitudeInDegree,
  }
}

function routeSpecFor(kind: ActivityKind, rng: Rng): RouteSpec {
  switch (kind) {
    case 'hike_long': {
      const th = TRAILHEADS[Math.floor(rng() * TRAILHEADS.length)]!
      return { kind, distanceM: 14_000 + rng() * 10_000, gainM: 550 + rng() * 550, start: th, loop: true }
    }
    case 'hike_short': {
      const th = TRAILHEADS[Math.floor(rng() * TRAILHEADS.length)]!
      return { kind, distanceM: 6000 + rng() * 5000, gainM: 200 + rng() * 250, start: th, loop: true }
    }
    case 'ride_long':
      return { kind, distanceM: 60_000 + rng() * 40_000, gainM: 350 + rng() * 650, start: KARLSRUHE, loop: true }
    case 'ride_tempo':
      return { kind, distanceM: 28_000 + rng() * 12_000, gainM: 120 + rng() * 200, start: KARLSRUHE, loop: true }
    default:
      return { kind, distanceM: 16_000 + rng() * 10_000, gainM: 60 + rng() * 120, start: KARLSRUHE, loop: true }
  }
}

const NAMES: Record<string, string[]> = {
  hike_long: ['Wanderung Hornisgrinde', 'Schwarzwald Rundweg', 'Gipfeltour Schliffkopf', 'Murgtal Höhenweg', 'Albtal Panoramaweg'],
  hike_short: ['Feierabend-Wanderung', 'Kurze Runde Herrenalb', 'Waldspaziergang'],
  ride_long: ['Lange Ausfahrt Pfalz', 'Rheinebene Langstrecke', 'Kraichgau Runde', 'Schwarzwald Rennrad'],
  ride_tempo: ['Tempo-Runde Rheinauen', 'Intervall-Ausfahrt', 'Schnelle Feierabendrunde'],
  ride_easy: ['Lockere Ausfahrt', 'Regenerationsfahrt', 'Pendeln Karlsruhe'],
}

const round1 = (v: number) => Math.round(v * 10) / 10

/** Extra summary fields a watch would record; generated from a dedicated RNG so existing fixture values stay stable. */
function fixtureActivityExtra(kind: ActivityKind, s: GarminActivity): ActivityExtra {
  const rng = createRng(hashString(`extra-${s.summaryId}`))
  const duration = s.durationInSeconds
  const distance = s.distanceInMeters ?? 0
  const extra: ActivityExtra = {
    elapsedS: Math.round(duration * (1.02 + rng() * 0.06)),
    avgStress: Math.round(18 + rng() * 14),
    stressDelta: Math.round(-4 + rng() * 14),
    bodyBatteryDelta: -Math.round((duration / 3600) * (kind === 'strength' ? 9 : 12) * (0.8 + rng() * 0.4)),
    avgRespiration: round1(kind === 'strength' ? 21 + rng() * 3 : 28 + rng() * 6),
    maxRespiration: round1(40 + rng() * 8),
    minRespiration: round1(14 + rng() * 3),
    minTempC: round1(8 + rng() * 6),
    maxTempC: round1(14 + rng() * 10),
    lapCount: Math.max(1, Math.round(distance / 1000)),
  }
  if (kind === 'run') {
    const paceSplit = distance && s.averageSpeedInMetersPerSecond ? 1000 / s.averageSpeedInMetersPerSecond : 390
    Object.assign(extra, {
      groundContactMs: Math.round(228 + rng() * 24),
      strideLengthCm: Math.round(108 + rng() * 14),
      verticalOscillationCm: round1(7.8 + rng() * 1.4),
      verticalRatioPct: round1(6.6 + rng() * 1.2),
      groundContactBalancePct: round1(49 + rng() * 2),
      steps: 6500,
      maxCadence: 188,
      fastestSplitsS: { 1000: Math.round(paceSplit * 0.93), ...(distance >= 5000 ? { 5000: Math.round(paceSplit * 5 * 0.97) } : {}) },
    })
  }
  if (kind.startsWith('ride')) {
    const intensity = kind === 'ride_tempo' ? 0.82 : kind === 'ride_long' ? 0.7 : 0.6
    const ftp = 235
    const normPower = Math.round(ftp * intensity * (0.97 + rng() * 0.06))
    const curve: Record<string, number> = {}
    for (const [seconds, factor] of [[5, 2.9], [60, 1.7], [300, 1.28], [1200, 1.02], [3600, 0.9]] as const) {
      if (duration >= seconds) curve[String(seconds)] = Math.round(normPower * factor * (0.92 + rng() * 0.08))
    }
    const zoneWeights = kind === 'ride_tempo' ? [0.1, 0.25, 0.35, 0.2, 0.07, 0.02, 0.01] : [0.25, 0.4, 0.25, 0.08, 0.02, 0, 0]
    Object.assign(extra, {
      normPowerW: normPower,
      maxPowerW: Math.round(normPower * (2.8 + rng())),
      max20MinPowerW: curve['1200'],
      ftpW: ftp,
      intensityFactor: round1((normPower / ftp) * 100) / 100,
      tss: Math.round((duration / 3600) * (normPower / ftp) ** 2 * 100),
      powerCurveW: curve,
      powerZoneS: zoneWeights.map((w) => Math.round(w * duration)),
    })
  }
  if (kind.startsWith('hike')) {
    Object.assign(extra, { steps: Math.round(distance / 0.72), floorsClimbed: Math.round((s.totalElevationGainInMeters ?? 0) / 3) })
  }
  return extra
}

function simulateActivity(date: string, kind: ActivityKind, restingHr: number, seq: number): { activity: SimActivity; details: GarminActivityDetails } {
  const activityId = hashString(`${date}-${kind}-${seq}`)
  const rng = createRng(activityId)
  const offset = berlinOffsetSeconds(date)
  const weekend = isoWeekday(date) >= 5
  const startHour = kind === 'strength' ? 18.5 : weekend || kind.endsWith('long') ? 8.5 + rng() * 1.5 : 17 + rng() * 1.5
  const startOffsetS = Math.round(startHour * 3600)
  const startEpoch = berlinMidnightEpoch(date) + startOffsetS
  const names = NAMES[kind] ?? ['Training']
  const name = names[Math.floor(rng() * names.length)]!

  if (kind === 'strength' || kind === 'run') {
    const dur = kind === 'strength' ? 2400 : 2100
    const samples: GarminActivitySample[] = []
    let hr = restingHr + 30
    for (let t = 0; t < dur; t += 10) {
      hr += ((restingHr + (kind === 'strength' ? 62 : 90) + Math.sin(t / 90) * 12) - hr) * 0.15
      samples.push({ startTimeInSeconds: startEpoch + t, heartRateInBeatsPerMinute: Math.round(hr) })
    }
    const zones = [0, 0, 0, 0, 0]
    samples.forEach((s) => (zones[hrZoneIndex(s.heartRateInBeatsPerMinute ?? 0)]! += 10))
    const trimp = zones.reduce((s, sec, z) => s + (sec / 60) * (z + 1), 0)
    const hrs = samples.map((s) => s.heartRateInBeatsPerMinute ?? 0)
    const summary: GarminActivity = {
      summaryId: `fx-${activityId}`,
      activityId,
      activityName: kind === 'strength' ? 'Krafttraining' : 'Lockerer Lauf',
      activityType: kind === 'strength' ? 'STRENGTH_TRAINING' : 'RUNNING',
      startTimeInSeconds: startEpoch,
      startTimeOffsetInSeconds: offset,
      durationInSeconds: dur,
      averageHeartRateInBeatsPerMinute: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length),
      maxHeartRateInBeatsPerMinute: Math.max(...hrs),
      activeKilocalories: Math.round((dur / 3600) * 380),
      aerobicTrainingEffect: Math.round(clamp(0.5 + 1.3 * Math.log(1 + trimp / 40), 0, 5) * 10) / 10,
      anaerobicTrainingEffect: kind === 'strength' ? 0.9 : 0.2,
      activityTrainingLoad: Math.round(trimp * 0.5),
      timeInHeartRateZonesInSeconds: zones,
      ...(kind === 'run' ? { distanceInMeters: 5400, averageSpeedInMetersPerSecond: 2.57, movingDurationInSeconds: dur } : {}),
    }
    summary.extra = fixtureActivityExtra(kind, summary)
    const lapsList = [{ startTimeInSeconds: startEpoch }]
    return {
      activity: { summary, kind, startOffsetS, durationS: dur, hrAt: (s) => samples[clamp(Math.floor(s / 10), 0, samples.length - 1)]?.heartRateInBeatsPerMinute ?? restingHr },
      details: { summaryId: summary.summaryId, samples, laps: lapsList },
    }
  }

  const spec = routeSpecFor(kind, rng)
  const sim = simulateTrack(rng, spec, startEpoch, restingHr)
  const summary = summarize(activityId, kind, name, startEpoch, offset, sim)
  summary.extra = fixtureActivityExtra(kind, summary)
  return {
    activity: { summary, kind, startOffsetS, durationS: summary.durationInSeconds, hrAt: sim.hrBySecond },
    details: { summaryId: summary.summaryId, samples: sim.samples, laps: sim.laps },
  }
}

function planKinds(date: string, rng: Rng, illness: boolean, ctl: number): ActivityKind[] {
  if (illness || WATCH_OFF_DAYS.has(date)) return []
  const dow = isoWeekday(date)
  const month = Number(date.slice(5, 7))
  const summer = month >= 4 && month <= 10
  const roll = rng()
  const fatigueSkip = ctl > 130 ? 0.25 : 0.1
  if (roll < fatigueSkip) return []
  switch (dow) {
    case 0:
      return roll < 0.4 ? ['ride_easy'] : []
    case 1:
      return ['ride_tempo']
    case 2:
      return roll < 0.45 ? ['ride_easy'] : roll < 0.6 ? ['run'] : []
    case 3:
      return roll < 0.6 ? ['ride_tempo'] : ['hike_short']
    case 4:
      return roll < 0.5 ? ['strength'] : []
    case 5:
      return summer ? (roll < 0.55 ? ['hike_long'] : ['ride_long']) : roll < 0.7 ? ['hike_long'] : ['hike_short']
    default:
      return summer ? (roll < 0.5 ? ['hike_long'] : ['ride_long']) : roll < 0.6 ? ['hike_short'] : ['ride_easy']
  }
}

interface SimState {
  days: Map<string, SimDay>
  last: string
}
let cache: SimState | null = null

function simulate(through: string): SimState {
  if (cache && cache.last >= through) return cache
  const days = new Map<string, SimDay>()
  const hrvHistory: number[] = []
  let atl = 20
  let ctl = 35
  let illnessLeft = 0
  let prevLoad = 0
  let prevLow = 40
  let hrvNoise = 0
  let rhrNoise = 0

  for (const date of eachDay(SIM_EPOCH, through)) {
    const rng = createRng(hashString(`day-${date}`))
    if (illnessLeft === 0 && ILLNESS_STARTS.includes(date)) illnessLeft = 6
    const ill = illnessLeft > 0
    const illFactor = ill ? clamp(illnessLeft / 6, 0.4, 1) : 0
    if (ill) illnessLeft--
    const dow = isoWeekday(date)
    const workday = dow < 5

    hrvNoise = hrvNoise * 0.6 + gaussian(rng) * 3.5
    rhrNoise = rhrNoise * 0.5 + gaussian(rng) * 0.9
    const fitnessBonus = clamp((ctl - 30) * 0.04, 0, 6)
    const restingHr = Math.round(clamp(56 - fitnessBonus + prevLoad * 0.017 + illFactor * 7 + rhrNoise, 40, 80))
    const hrvBase = 54 + clamp((ctl - 30) * 0.12, 0, 14)
    const hrvValue = Math.round(clamp(hrvBase - prevLoad * 0.045 - illFactor * 18 + hrvNoise, 18, 120))

    const kinds = planKinds(date, rng, ill, ctl)
    const acts = kinds.map((k, i) => simulateActivity(date, k, restingHr, i).activity)
    const dayLoad = acts.reduce((s, a) => s + (a.summary.activityTrainingLoad ?? 0), 0)

    const sleepH = clamp(7.1 + (dow === 4 || dow === 5 ? 0.45 : 0) + gaussian(rng) * 0.5 + prevLoad * 0.0016 + illFactor * 1.1, 4.8, 9.6)
    const asleepS = Math.round(sleepH * 3600)
    const deep = Math.round(asleepS * clamp(0.18 + gaussian(rng) * 0.02 - illFactor * 0.04, 0.08, 0.28))
    const rem = Math.round(asleepS * clamp(0.21 + gaussian(rng) * 0.025, 0.1, 0.3))
    const awake = Math.round(asleepS * clamp(0.05 + gaussian(rng) * 0.015 + illFactor * 0.03, 0.01, 0.15))
    const light = asleepS - deep - rem
    const sleepScore = Math.round(clamp(38 + (sleepH - 5) * 11 + (deep / asleepS - 0.15) * 160 - (awake / asleepS) * 80 + gaussian(rng) * 3 - illFactor * 10, 30, 98))
    const bedtimeH = 22.6 + rng() * 1.1 + (dow === 4 || dow === 5 ? 0.5 : 0)
    const bedtimeOffsetS = Math.round((bedtimeH - 24) * 3600)
    const midnight = berlinMidnightEpoch(date)
    const missing = WATCH_OFF_DAYS.has(date)
    const sleepMissing = missing || rng() < 0.03
    const hrvMissing = missing || sleepMissing || rng() < 0.04

    atl += (dayLoad - atl) * (1 - Math.exp(-1 / 7))
    ctl += (dayLoad - ctl) * (1 - Math.exp(-1 / 42))
    prevLoad = dayLoad

    const walkSteps = Math.round(Math.max(1500, (workday ? 7000 : 8800) + gaussian(rng) * 1800) * (1 - illFactor * 0.5))
    const actSteps = acts.reduce((s, a) => s + (a.kind.startsWith('hike') ? (a.summary.distanceInMeters ?? 0) / 0.72 : a.kind === 'run' ? 6500 : 800), 0)
    const steps = Math.round(walkSteps + actSteps)
    const gain = acts.reduce((s, a) => s + (a.summary.totalElevationGainInMeters ?? 0), 0)
    const actKcal = acts.reduce((s, a) => s + (a.summary.activeKilocalories ?? 0), 0)
    const modS = acts.reduce((s, a) => s + a.durationS * 0.55, 0) + 900
    const vigS = acts.reduce((s, a) => s + (a.summary.timeInHeartRateZonesInSeconds?.slice(3).reduce((x, y) => x + y, 0) ?? 0), 0)

    const stressAvg = Math.round(clamp(25 + (workday ? 5 : 0) + illFactor * 14 + prevLoad * 0.01 + gaussian(rng) * 5, 8, 75))
    const wake = Math.round(clamp(sleepScore * 0.75 + 20 + (hrvValue / hrvBase - 1) * 25 + gaussian(rng) * 3, 25, 100))
    const drained = Math.round(clamp(14 + stressAvg * 0.65 + dayLoad * 0.07 + gaussian(rng) * 4, 20, 85))
    const low = Math.round(clamp(wake - drained, 5, wake - 12))
    const charged = Math.round(clamp(wake - prevLow, 8, 92))
    const dayDailyHigh = wake
    const startOffset = berlinOffsetSeconds(date)

    const heartSamples: Record<string, number> = {}
    const stressValues: Record<string, number> = {}
    const batteryValues: Record<string, number> = {}
    const wakeT = Math.round((bedtimeH + sleepH + 0.4 - 24) * 3600) // seconds after midnight when awake
    for (let s = 0; s < 86_400; s += 180) {
      const awakeNow = s > wakeT
      const act = acts.find((a) => s >= a.startOffsetS && s < a.startOffsetS + a.durationS)
      let hrNow = awakeNow ? restingHr + 12 + Math.sin(s / 5400) * 5 : restingHr + 2 + Math.sin(s / 3000) * 2
      if (act) hrNow = act.hrAt(s - act.startOffsetS)
      if (s >= 86_400 - 4000 || s < 0) hrNow = restingHr + 5
      heartSamples[String(s)] = Math.round(hrNow + Math.sin(s * 7.3) * 1.5)
      stressValues[String(s)] = act ? -1 : awakeNow ? Math.round(clamp(stressAvg + 8 + Math.sin(s / 2300) * 14 + Math.sin(s * 3.1) * 4, 5, 95)) : Math.round(clamp(12 + Math.sin(s / 1900) * 5, 4, 30))
      const lowerBound = low
      batteryValues[String(s)] = awakeNow
        ? Math.round(wake - (wake - lowerBound) * Math.pow((s - wakeT) / (86_400 - wakeT), 0.9))
        : Math.round(prevLow + (wake - prevLow) * (0.3 + 0.7 * (s / Math.max(wakeT, 1))))
    }

    const extraRng = createRng(hashString(`wellness-${date}`))
    const stressSpan = Math.round(86_400 * 0.72)
    const highS = Math.round(stressSpan * clamp((stressAvg - 20) / 120, 0.02, 0.3))
    const mediumS = Math.round(stressSpan * clamp(0.18 + (stressAvg - 25) / 160, 0.1, 0.4))
    const lowS = Math.round(stressSpan * 0.3)
    const hydrationGoal = 2800
    const hydration = Math.round(clamp(2100 + gaussian(extraRng) * 450 + (acts.length ? 350 : 0), 600, 4200) / 50) * 50
    const batteryEvents = acts.map((a) => ({
      type: 'activity',
      startTime: new Date((midnight + a.startOffsetS) * 1000).toISOString(),
      durationS: a.durationS,
      impact: -Math.round((a.durationS / 3600) * 11 + extraRng() * 3),
    }))

    const daily: GarminDaily = {
      summaryId: `fx-daily-${date}`,
      calendarDate: date,
      startTimeInSeconds: midnight,
      startTimeOffsetInSeconds: startOffset,
      durationInSeconds: 86_400,
      steps,
      stepsGoal: 10_000,
      distanceInMeters: Math.round(steps * 0.74 + acts.filter((a) => a.kind.startsWith('ride')).reduce((s, a) => s + (a.summary.distanceInMeters ?? 0), 0)),
      floorsClimbed: Math.round(gain / 3 + 6 + rng() * 6),
      activeKilocalories: Math.round(300 + steps * 0.035 + actKcal),
      bmrKilocalories: 1780,
      moderateIntensityDurationInSeconds: Math.round(modS),
      vigorousIntensityDurationInSeconds: Math.round(vigS),
      minHeartRateInBeatsPerMinute: restingHr - 4,
      maxHeartRateInBeatsPerMinute: Math.max(110 + Math.round(rng() * 15), ...acts.map((a) => a.summary.maxHeartRateInBeatsPerMinute ?? 0)),
      restingHeartRateInBeatsPerMinute: restingHr,
      averageStressLevel: stressAvg,
      maxStressLevel: Math.min(99, stressAvg + 35 + Math.round(rng() * 15)),
      bodyBatteryChargedValue: charged,
      bodyBatteryDrainedValue: drained,
      bodyBatteryHighestValue: wake,
      bodyBatteryLowestValue: low,
      bodyBatteryEndOfDayValue: Math.max(5, low + Math.round(extraRng() * 6)),
      bodyBatteryEvents: [...batteryEvents, { type: 'sleep', startTime: new Date((midnight + bedtimeOffsetS) * 1000).toISOString(), durationS: asleepS, impact: Math.max(10, wake - prevLow) }],
      avgRespirationBreathsPerMinute: round1(15.5 + extraRng() * 1.6 + illFactor * 2),
      minRespirationBreathsPerMinute: round1(11 + extraRng() * 1.5),
      maxRespirationBreathsPerMinute: round1(24 + extraRng() * 6),
      avgSpo2Percent: Math.round(96 + gaussian(extraRng) * 0.7 - illFactor * 1.5),
      minSpo2Percent: Math.round(91 + gaussian(extraRng) * 1.2 - illFactor * 2),
      hydrationConsumedMl: hydration,
      hydrationGoalMl: hydrationGoal,
      sweatLossMl: acts.length ? Math.round(actKcal * 1.1) : 0,
      restStressDurationInSeconds: Math.round(86_400 * 0.28),
      lowStressDurationInSeconds: lowS,
      mediumStressDurationInSeconds: mediumS,
      highStressDurationInSeconds: highS,
      activityStressDurationInSeconds: Math.round(acts.reduce((t, a) => t + a.durationS, 0)),
      timeOffsetHeartRateSamples: heartSamples,
    }

    const hasNap = dow === 6 && extraRng() < 0.5
    const sleep: GarminSleep | null = sleepMissing
      ? null
      : {
          summaryId: `fx-sleep-${date}`,
          calendarDate: date,
          startTimeInSeconds: midnight + bedtimeOffsetS,
          startTimeOffsetInSeconds: startOffset,
          durationInSeconds: asleepS,
          deepSleepDurationInSeconds: deep,
          lightSleepDurationInSeconds: light,
          remSleepInSeconds: rem,
          awakeDurationInSeconds: awake,
          overallSleepScore: { value: sleepScore, qualifierKey: sleepScore >= 80 ? 'GOOD' : sleepScore >= 60 ? 'FAIR' : 'POOR' },
          avgRespirationBreathsPerMinute: Math.round((14.2 + gaussian(rng) * 0.6 + illFactor * 1.5) * 10) / 10,
          avgSpo2Percent: Math.round(95.5 + gaussian(rng) * 0.8 - illFactor * 1.5),
          napDurationInSeconds: hasNap ? 1500 : 0,
          awakeCount: Math.round(clamp(1 + (awake / asleepS) * 30 + extraRng() * 2, 0, 9)),
          avgSleepStress: round1(clamp(15 + stressAvg * 0.25 + gaussian(extraRng) * 3, 6, 50)),
          avgHeartRateInBeatsPerMinute: restingHr + 3,
          lowestSpo2Percent: Math.round(90 + gaussian(extraRng) * 1.2 - illFactor * 2),
          highestSpo2Percent: 99,
          spo2EventsBelowThreshold: Math.round(Math.max(0, gaussian(extraRng) * 2 + illFactor * 6)),
          lowestRespirationBreathsPerMinute: round1(11 + extraRng() * 1.5),
          highestRespirationBreathsPerMinute: round1(19 + extraRng() * 3),
          breathingDisruptionSeverity: illFactor > 0.5 ? 'MODERATE' : 'NONE',
          scoreFeedback: sleepScore >= 80 ? 'POSITIVE_LONG_AND_DEEP' : sleepScore >= 60 ? 'POSITIVE_LONG_BUT_NOT_ENOUGH_REM' : 'NEGATIVE_NOT_ENOUGH_TOTAL',
          scoreInsight: prevLoad > 120 ? 'POSITIVE_EXERCISE' : 'NONE',
          scoreFactors: {
            totalDuration: { value: Math.round(clamp(((sleepH - 4.5) / 4) * 100, 20, 100)), qualifier: sleepH >= 7 ? 'EXCELLENT' : sleepH >= 6 ? 'GOOD' : 'FAIR', optimalStart: 7, optimalEnd: 9 },
            stress: { value: Math.round(clamp(100 - stressAvg, 40, 100)), qualifier: stressAvg < 30 ? 'EXCELLENT' : 'GOOD', optimalStart: 0, optimalEnd: 15 },
            awakeCount: { value: Math.round(clamp(100 - (awake / asleepS) * 600, 30, 100)), qualifier: awake / asleepS < 0.05 ? 'EXCELLENT' : 'FAIR', optimalStart: 0, optimalEnd: 5 },
            remPercentage: { value: Math.round(clamp((rem / asleepS) * 400, 30, 100)), qualifier: rem / asleepS > 0.2 ? 'GOOD' : 'FAIR', optimalStart: 21, optimalEnd: 31 },
            restlessness: { value: Math.round(clamp(75 + gaussian(extraRng) * 10, 30, 100)), qualifier: 'GOOD', optimalStart: 0, optimalEnd: 5 },
            lightPercentage: { value: Math.round(clamp(100 - Math.abs(light / asleepS - 0.5) * 200, 30, 100)), qualifier: 'EXCELLENT', optimalStart: 30, optimalEnd: 64 },
            deepPercentage: { value: Math.round(clamp((deep / asleepS) * 450, 30, 100)), qualifier: deep / asleepS > 0.16 ? 'EXCELLENT' : 'FAIR', optimalStart: 16, optimalEnd: 33 },
          },
          need: { baselineMin: 480, actualMin: Math.round(480 + clamp(prevLoad * 0.15, 0, 40) + illFactor * 30), feedback: prevLoad > 120 ? 'INCREASED_BY_TRAINING' : 'NO_CHANGE', bedtimeStartMin: -90, bedtimeEndMin: -30, nextActualMin: 485 },
          alignment: { status: Math.abs(bedtimeH - 23.2) < 0.6 ? 'ALIGNED' : 'LATE', windowStartMin: -90, windowEndMin: 0, lastMidpointMin: Math.round((bedtimeH - 24 + sleepH / 2) * 60), windowMidpointMin: 195 },
          ...(hasNap ? { naps: [{ startTime: new Date((midnight + 14 * 3600) * 1000).toISOString(), endTime: new Date((midnight + 14 * 3600 + 1500) * 1000).toISOString(), durationS: 1500, feedback: 'IDEAL_TIME_IDEAL_DURATION' }] } : {}),
        }

    let hrv: GarminHrv | null = null
    if (!hrvMissing) {
      hrvHistory.push(hrvValue)
      const week = hrvHistory.slice(-7)
      const month = hrvHistory.slice(-28)
      const weekAvg = week.reduce((a, b) => a + b, 0) / week.length
      const monthAvg = month.reduce((a, b) => a + b, 0) / month.length
      const ratio = weekAvg / monthAvg
      hrv = {
        summaryId: `fx-hrv-${date}`,
        calendarDate: date,
        lastNightAvg: hrvValue,
        lastNight5MinHigh: Math.round(hrvValue * (1.2 + rng() * 0.15)),
        weeklyAvg: Math.round(weekAvg),
        status: ratio >= 0.9 ? 'BALANCED' : ratio >= 0.8 ? 'UNBALANCED' : ratio >= 0.7 ? 'LOW' : 'POOR',
        baselineBalancedLow: Math.round(monthAvg * 0.88),
        baselineBalancedUpper: Math.round(monthAvg * 1.12),
        feedbackPhrase: ratio >= 0.9 ? 'HRV_BALANCED_2' : ratio >= 0.8 ? 'HRV_UNBALANCED_2' : 'HRV_LOW_2',
      }
    }

    days.set(date, {
      date,
      daily,
      sleep,
      hrv,
      metrics: { summaryId: `fx-metrics-${date}`, calendarDate: date, vo2Max: Math.round((46 + clamp((ctl - 30) * 0.05, 0, 4) + gaussian(rng) * 0.1) * 10) / 10 },
      stress: {
        summaryId: `fx-stress-${date}`,
        calendarDate: date,
        startTimeInSeconds: midnight,
        durationInSeconds: 86_400,
        timeOffsetStressLevelValues: stressValues,
        timeOffsetBodyBatteryValues: batteryValues,
      },
      activities: acts,
      restingHr,
      wakeBattery: dayDailyHigh,
      lowBattery: low,
      bedtimeOffsetS,
      sleepSeconds: asleepS,
      hrvValue,
    })
    if (missing) {
      const d = days.get(date)!
      d.daily = { ...d.daily, steps: undefined, restingHeartRateInBeatsPerMinute: undefined, averageStressLevel: undefined, maxStressLevel: undefined, bodyBatteryChargedValue: undefined, bodyBatteryDrainedValue: undefined, bodyBatteryHighestValue: undefined, bodyBatteryLowestValue: undefined, timeOffsetHeartRateSamples: undefined, distanceInMeters: undefined, floorsClimbed: undefined, minHeartRateInBeatsPerMinute: undefined, maxHeartRateInBeatsPerMinute: undefined }
    }
    prevLow = low
  }
  cache = { days, last: through }
  return cache
}

const FIXTURE_HR_ZONES: GarminHrZones[] = [
  { sport: 'DEFAULT', trainingMethod: 'HR_RESERVE', restingHeartRate: 52, lactateThresholdHeartRate: 168, maxHeartRate: SIM_MAX_HR, zoneFloors: [114, 133, 152, 162, 171] },
  { sport: 'CYCLING', trainingMethod: 'HR_RESERVE', restingHeartRate: 52, lactateThresholdHeartRate: 164, maxHeartRate: 184, zoneFloors: [110, 128, 146, 156, 166] },
]

/** Weigh-ins on four of seven days with a slow downward trend. */
function fixtureWeight(date: string): GarminWeight | null {
  const rng = createRng(hashString(`weight-${date}`))
  if (isoWeekday(date) % 2 === 1 || rng() < 0.15) return null
  const days = Math.max(0, (new Date(date).getTime() - new Date(SIM_EPOCH).getTime()) / 86_400_000)
  const weightKg = round1(81.5 - days * 0.012 + gaussian(rng) * 0.35)
  return {
    calendarDate: date,
    measuredAtInSeconds: berlinMidnightEpoch(date) + 7 * 3600 + 20 * 60,
    weightKg,
    bmi: round1(weightKg / 1.82 ** 2),
    bodyFatPercent: round1(19.5 - days * 0.004 + gaussian(rng) * 0.3),
    bodyWaterPercent: round1(56 + gaussian(rng) * 0.5),
    muscleMassKg: round1(36.5 + gaussian(rng) * 0.2),
    boneMassKg: round1(3.4 + gaussian(rng) * 0.03),
    visceralFat: 6,
    metabolicAge: 34,
  }
}

function fixtureFitnessAge(date: string): GarminFitnessAge {
  const days = Math.max(0, (new Date(date).getTime() - new Date(SIM_EPOCH).getTime()) / 86_400_000)
  const age = round1(36 - days * 0.006)
  return {
    calendarDate: date,
    chronologicalAge: 39,
    fitnessAge: age,
    achievableFitnessAge: 31,
    previousFitnessAge: round1(age + 0.4),
    components: {
      vo2Max: { value: 48, targetValue: 52, improvementValue: 4, potentialAge: 33, priority: 1 },
      bmi: { value: 24.6, targetValue: 23.5, improvementValue: 1.1, potentialAge: 35, priority: 2 },
      rhr: { value: 52, targetValue: 48, improvementValue: 4, potentialAge: 35, priority: 3 },
      vigorousDaysAvg: { value: 2.1, targetValue: 3, improvementValue: 0.9, potentialAge: 34, priority: 4 },
    },
  }
}

/** Overnight HRV readings every five minutes and SpO2 readings every few minutes. */
function fixtureIntraday(date: string, day: SimDay): GarminIntradaySeries[] {
  const rng = createRng(hashString(`intraday-${date}`))
  const start = berlinMidnightEpoch(date) + day.bedtimeOffsetS
  const hrv: [number, number][] = []
  const spo2: [number, number][] = []
  for (let t = 0; t < day.sleepSeconds; t += 300) {
    hrv.push([start + t, Math.round(clamp(day.hrvValue + Math.sin(t / 2400) * 9 + gaussian(rng) * 5, 15, 160))])
  }
  for (let t = 0; t < day.sleepSeconds; t += 240) spo2.push([start + t, Math.round(clamp(95.5 + gaussian(rng) * 1.1, 88, 100))])
  return [
    { calendarDate: date, metric: 'hrv', points: hrv },
    { calendarDate: date, metric: 'spo2', points: spo2 },
  ]
}

export class FixtureGarminClient implements GarminClient {
  private readonly now: () => Date

  constructor(now: () => Date = () => new Date()) {
    this.now = now
  }

  ping() {
    return Promise.resolve({ userId: 'fixture-user' })
  }

  fetchRange(from: string, to: string): Promise<GarminRangePayload> {
    const today = todayInBerlin(this.now())
    const end = to > today ? today : to
    const start = from < SIM_EPOCH ? SIM_EPOCH : from
    const payload: GarminRangePayload = { dailies: [], stressDetails: [], sleeps: [], hrv: [], userMetrics: [], activities: [], weights: [], fitnessAge: [], hrZones: [], intradayExtra: [] }
    if (start > end) return Promise.resolve(payload)
    const sim = simulate(end)
    const intradayFrom = addDays(today, -13)
    for (const date of eachDay(start, end)) {
      const day = sim.days.get(date)
      if (!day) continue
      const recent = date >= intradayFrom
      payload.dailies.push(recent ? day.daily : { ...day.daily, timeOffsetHeartRateSamples: undefined })
      if (recent && !WATCH_OFF_DAYS.has(date)) payload.stressDetails.push(day.stress)
      if (day.sleep) payload.sleeps.push(day.sleep)
      if (day.hrv) payload.hrv.push(day.hrv)
      payload.userMetrics.push(day.metrics)
      for (const a of day.activities) payload.activities.push(a.summary)
      const weight = fixtureWeight(date)
      if (weight) payload.weights.push(weight)
      if (isoWeekday(date) === 0) payload.fitnessAge.push(fixtureFitnessAge(date))
      if (recent && day.sleep && !WATCH_OFF_DAYS.has(date)) payload.intradayExtra.push(...fixtureIntraday(date, day))
    }
    payload.hrZones.push(...FIXTURE_HR_ZONES)
    return Promise.resolve(payload)
  }

  fetchActivityDetails(summaryId: string): Promise<GarminActivityDetails | null> {
    const sim = simulate(todayInBerlin(this.now()))
    for (const day of sim.days.values()) {
      const hit = day.activities.findIndex((a) => a.summary.summaryId === summaryId)
      if (hit >= 0) {
        const act = day.activities[hit]!
        const { details } = simulateActivity(day.date, act.kind, day.restingHr, hit)
        return Promise.resolve(details)
      }
    }
    return Promise.resolve(null)
  }
}
