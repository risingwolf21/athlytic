/// <reference lib="deno.ns" />
import assert from 'node:assert/strict'
import { HttpGarminClient, parseTokenResponse } from './client.ts'
import { mapSleep, toEpochSeconds } from './map.ts'
import { GarminProvider } from './provider.ts'
import { normalizeGarminActivityDetails } from './normalize.ts'
import { GarminApiError } from './types.ts'

const BASE = 'https://personal.connectapi.garmin.com'
const NOW = new Date('2026-11-04T10:00:00Z')

const dailySummary = {
  calendarDate: '2026-11-03',
  source: 'garmin',
  wellnessChronology: { startTimestampGmt: '2026-11-02T23:00:00.0', startTimestampLocal: '2026-11-03T00:00:00.0', totalDurationInMillis: 86_400_000 },
  movement: { steps: { goal: 10_000, value: 8_421, distanceInMeters: 6_300.5 }, floorsAscended: { value: 12 } },
  calories: { burnedResting: 1_800, burnedActive: 650 },
  heartRate: { minValue: 44, maxValue: 161, restingValue: 49 },
  intensityMinutes: { moderate: 30, vigorous: 10 },
  stress: { avgLevel: 31, maxLevel: 88 },
  bodyBattery: { minValue: 12, maxValue: 95, chargedValue: 70, drainedValue: 83 },
}

const responses: Record<string, (url: URL) => unknown> = {
  'usersummary-service/v2/dailysummaries': () => ({ data: [dailySummary, { ...dailySummary, source: 'fitbit', movement: { steps: { value: 1 } } }] }),
  'sleep-service/sleep/dailySleepSummariesByDate': () => [
    {
      calendarDate: '2026-11-03',
      sleepTimeSeconds: 27_000,
      sleepStartTimestampGMT: 1_793_660_400_000,
      sleepStartTimestampLocal: 1_793_664_000_000,
      deepSleepSeconds: 5_400,
      lightSleepSeconds: 14_400,
      remSleepSeconds: 7_200,
      awakeSleepSeconds: 1_200,
      sleepScores: { overall: { value: 82, qualifierKey: 'GOOD' } },
      averageRespirationValue: 14.5,
    },
    { calendarDate: '2026-11-02', sleepTimeSeconds: 0 },
  ],
  'hrv-service/hrv/daily/2026-11-01/2026-11-03': () => ({
    hrvSummaries: [{ calendarDate: '2026-11-03', weeklyAvg: 58, lastNightAvg: 61, lastNight5MinHigh: 90, status: 'BALANCED' }],
  }),
  'wellness-service/wellness/bodyBattery/reports/daily': () => [
    {
      date: '2026-11-03',
      bodyBatteryValuesArray: [
        [1_793_660_400_000, 'MEASURED', 40, 2.0],
        [1_793_661_300_000, 'MEASURED', 55, 2.0],
      ],
      bodyBatteryValueDescriptorDTOList: [
        { bodyBatteryValueDescriptorIndex: 0, bodyBatteryValueDescriptorKey: 'timestamp' },
        { bodyBatteryValueDescriptorIndex: 1, bodyBatteryValueDescriptorKey: 'bodyBatteryStatus' },
        { bodyBatteryValueDescriptorIndex: 2, bodyBatteryValueDescriptorKey: 'bodyBatteryLevel' },
      ],
    },
  ],
  'wellness-service/wellness/dailyHeartRate': () => ({
    heartRateValues: [
      [1_793_660_400_000, 52],
      [1_793_660_520_000, null],
      [1_793_660_640_000, 55],
    ],
  }),
  'activitylist-service/activities/search/activities': () => [
    {
      activityId: 98765,
      activityName: 'Morning run',
      startTimeGMT: '2026-11-03 06:00:00',
      startTimeLocal: '2026-11-03 07:00:00',
      activityType: { typeId: 1, typeKey: 'running', parentTypeId: 17 },
      distance: 10_050.2,
      duration: 3_000,
      movingDuration: 2_950,
      averageSpeed: 3.35,
      averageHR: 152,
      maxHR: 178,
      calories: 800,
      bmrCalories: 100,
      aerobicTrainingEffect: 3.4,
      activityTrainingLoad: 142,
      vO2MaxValue: 52,
      hrTimeInZone_1: 100,
      hrTimeInZone_2: 600,
      hrTimeInZone_3: 1_500,
      hrTimeInZone_4: 700,
      hrTimeInZone_5: 100,
    },
  ],
  'activity-service/activity/98765': () => ({
    activityId: 98765,
    splitSummaries: [
      { splitType: 'ASCENT_SPLIT', noOfSplits: 1, startTimeGMT: '2026-11-03T06:10:00.0', duration: 60, distance: 100 },
      { splitType: 'MARKER_KILOMETER', noOfSplits: 1, startTimeGMT: '2026-11-03T06:00:00.0', duration: 300, distance: 1_000, averageSpeed: 3.33, averageHR: 140 },
      { splitType: 'MARKER_KILOMETER', noOfSplits: 1, startTimeGMT: '2026-11-03T06:05:00.0', duration: 295, distance: 1_000, averageSpeed: 3.39, averageHR: 150 },
    ],
  }),
}

function mockFetch(calls: string[], options: { rejectFirstToken?: boolean } = {}): typeof fetch {
  let tokens = 0
  return ((input: URL | string, init?: RequestInit) => {
    const url = new URL(String(input))
    const path = url.pathname.slice(1)
    calls.push(`${init?.method ?? 'GET'} ${path}`)
    if (path.endsWith('personal-api-key/token')) {
      assert.equal((init?.headers as Record<string, string>).Authorization, 'ApiKey test-key')
      tokens++
      return Promise.resolve(new Response(JSON.stringify({ access_token: `token-${tokens}` }), { status: 200 }))
    }
    const bearer = (init?.headers as Record<string, string>).Authorization
    if (options.rejectFirstToken && bearer === 'Bearer token-1') return Promise.resolve(new Response(null, { status: 401 }))
    assert.match(bearer, /^Bearer token-\d+$/)
    if (path === 'userprofile-service/userprofile/settings') return Promise.resolve(Response.json({ displayName: 'Alex' }))
    const handler = responses[path]
    if (!handler) return Promise.resolve(new Response(null, { status: 404 }))
    return Promise.resolve(Response.json(handler(url)))
  }) as typeof fetch
}

const client = (calls: string[] = [], options = {}) => new HttpGarminClient({ baseUrl: BASE, apiKey: 'test-key', fetchImpl: mockFetch(calls, options), now: () => NOW })

Deno.test('parses token responses', () => {
  assert.deepEqual(parseTokenResponse('{"access_token":"abc","expires_in":3600}'), { token: 'abc', expiresInSeconds: 3600 })
  assert.deepEqual(parseTokenResponse('"abc"'), { token: 'abc', expiresInSeconds: null })
  assert.deepEqual(parseTokenResponse('abc\n'), { token: 'abc', expiresInSeconds: null })
})

Deno.test('converts the timestamp encodings Garmin uses', () => {
  assert.equal(toEpochSeconds('2026-11-03 06:00:00'), 1_793_685_600)
  assert.equal(toEpochSeconds('2026-11-03T06:00:00.0'), 1_793_685_600)
  assert.equal(toEpochSeconds('2026-11-03T07:00:00+01:00'), 1_793_685_600)
  assert.equal(toEpochSeconds(1_793_685_600_000), 1_793_685_600)
  assert.equal(toEpochSeconds(1_793_685_600), 1_793_685_600)
  assert.equal(toEpochSeconds({ date: '2026-11-03T06:00:00Z' }), 1_793_685_600)
  assert.equal(toEpochSeconds(null), null)
  assert.equal(toEpochSeconds('garbage'), null)
})

Deno.test('ignores empty sleep days', () => {
  assert.equal(mapSleep({ calendarDate: '2026-11-02', sleepTimeSeconds: 0 }), null)
})

Deno.test('ping verifies the key through the profile settings', async () => {
  const calls: string[] = []
  assert.deepEqual(await client(calls).ping(), { userId: 'Alex' })
  assert.deepEqual(calls.map((c) => c.split(' ')[0]), ['POST', 'GET'])
})

Deno.test('refreshes the access token once when Garmin answers 401', async () => {
  const calls: string[] = []
  await client(calls, { rejectFirstToken: true }).ping()
  assert.equal(calls.filter((c) => c.startsWith('POST')).length, 2)
})

Deno.test('surfaces API errors with their status', async () => {
  const failing = new HttpGarminClient({ baseUrl: BASE, apiKey: 'test-key', fetchImpl: (() => Promise.resolve(new Response(null, { status: 403 }))) as typeof fetch })
  await assert.rejects(failing.ping(), (e: unknown) => e instanceof GarminApiError && e.status === 403)
})

Deno.test('imports a range into the normalized bundle', async () => {
  const raw: { resourceType: string; externalId: string }[] = []
  const provider = new GarminProvider(client(), () => NOW)
  const bundle = await provider.fetchRange('2026-11-01', '2026-11-03', (records) => raw.push(...records))

  assert.equal(bundle.daily.length, 1)
  const day = bundle.daily[0]!
  assert.equal(day.date, '2026-11-03')
  assert.equal(day.steps, 8_421)
  assert.equal(day.stepGoal, 10_000)
  assert.equal(day.totalKcal, 2_450)
  assert.equal(day.intensityMinutes, 50)
  assert.equal(day.restingHr, 49)
  assert.equal(day.avgStress, 31)
  assert.equal(day.bodyBatteryHigh, 95)
  assert.equal(day.bodyBatteryCharged, 70)
  assert.equal(day.hrvLastNightAvg, 61)
  assert.equal(day.hrvStatus, 'balanced')
  assert.equal(day.vo2Max, 52)

  assert.equal(bundle.sleep.length, 1)
  const sleep = bundle.sleep[0]!
  assert.equal(sleep.durationS, 27_000)
  assert.equal(sleep.score, 82)
  assert.equal(sleep.startTime, '2026-11-02T23:00:00.000Z')

  const metrics = bundle.intraday.map((s) => s.metric).sort()
  assert.deepEqual(metrics, ['body_battery', 'heart_rate'])
  const hr = bundle.intraday.find((s) => s.metric === 'heart_rate')!
  assert.equal(hr.points.length, 2)

  assert.equal(bundle.activities.length, 1)
  const run = bundle.activities[0]!
  assert.equal(run.id, 'garmin:98765')
  assert.equal(run.sport, 'running')
  assert.equal(run.startTime, '2026-11-03T06:00:00.000Z')
  assert.equal(run.calories, 700)
  assert.deepEqual(run.hrZoneSeconds, [100, 600, 1_500, 700, 100])
  assert.equal(run.provenance.externalId, '98765')

  assert.deepEqual([...new Set(raw.map((r) => r.resourceType))].sort(), ['activity', 'body_battery', 'daily_summary', 'heart_rate', 'hrv', 'sleep'])
  assert.equal(raw.find((r) => r.resourceType === 'daily_summary')!.externalId, 'daily:2026-11-03')
})

Deno.test('builds laps from kilometer splits when no samples exist', async () => {
  const provider = new GarminProvider(client(), () => NOW)
  const bundle = await provider.fetchRange('2026-11-01', '2026-11-03')
  const detail = await provider.fetchActivityDetail(bundle.activities[0]!)
  assert.ok(detail)
  assert.equal(detail!.samples.t.length, 0)
  assert.equal(detail!.laps.length, 2)
  assert.equal(detail!.laps[0]!.startOffsetS, 0)
  assert.equal(detail!.laps[1]!.startOffsetS, 300)
  assert.equal(detail!.laps[1]!.avgHr, 150)
  assert.equal(normalizeGarminActivityDetails(bundle.activities[0]!, { summaryId: '1', samples: [], laps: [] }).laps.length, 0)
})

Deno.test('returns null details for unknown activities', async () => {
  assert.equal(await client().fetchActivityDetails('1'), null)
})

Deno.test('pages through long activity lists', async () => {
  const seen: string[] = []
  const pagedFetch = ((input: URL | string) => {
    const url = new URL(String(input))
    if (url.pathname.endsWith('personal-api-key/token')) return Promise.resolve(new Response('{"access_token":"t"}'))
    if (url.pathname.includes('activities/search')) {
      seen.push(url.searchParams.get('start')!)
      const start = Number(url.searchParams.get('start'))
      const count = start === 0 ? 50 : 3
      return Promise.resolve(Response.json(Array.from({ length: count }, (_, i) => ({ activityId: start + i, startTimeGMT: '2026-11-03 06:00:00', duration: 60, activityType: { typeKey: 'walking' } }))))
    }
    if (url.pathname.includes('dailysummaries')) return Promise.resolve(Response.json({ data: [] }))
    if (url.pathname.includes('hrv')) return Promise.resolve(Response.json({ hrvSummaries: [] }))
    return Promise.resolve(Response.json([]))
  }) as typeof fetch
  const payload = await new HttpGarminClient({ baseUrl: BASE, apiKey: 'k', fetchImpl: pagedFetch, now: () => NOW }).fetchRange('2026-11-01', '2026-11-03')
  assert.deepEqual(seen, ['0', '50'])
  assert.equal(payload.activities.length, 53)
})
