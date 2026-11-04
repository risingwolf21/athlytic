/// <reference lib="deno.ns" />
import assert from 'node:assert/strict'
import { HttpGarminClient } from './client.ts'
import { FixtureGarminClient } from './fixtures.ts'
import { mapActivity, mapFitnessAge, mapHeartRateZones, mapHrvReadings, mapSleep, mapSpo2Readings, mapWeight } from './map.ts'
import { normalizeGarminRange } from './normalize.ts'
import { GarminProvider } from './provider.ts'
import { GarminApiError } from './types.ts'

const NOW = new Date('2026-11-04T10:00:00Z')

Deno.test('converts body composition and guards against gram values', () => {
  const kg = mapWeight({ calendarDate: '2026-11-03', weight: 81.4, bodyFat: 18.2, muscleMass: 36.1, boneMass: 3.4, timestampGMT: 1_793_660_400_000 })
  assert.equal(kg?.weightKg, 81.4)
  assert.equal(kg?.measuredAtInSeconds, 1_793_660_400)
  const grams = mapWeight({ calendarDate: '2026-11-03', weight: 81_400, muscleMass: 36_100, boneMass: 3_400 })
  assert.equal(grams?.weightKg, 81.4)
  assert.equal(grams?.muscleMassKg, 36.1)
  assert.equal(grams?.boneMassKg, 3.4)
  assert.equal(mapWeight({ calendarDate: '2026-11-03' }), null)
})

Deno.test('maps heart rate zone settings and rejects incomplete ones', () => {
  const zones = mapHeartRateZones({ sport: 'running', trainingMethod: 'HR_RESERVE', zone1Floor: 110, zone2Floor: 130, zone3Floor: 150, zone4Floor: 160, zone5Floor: 170, maxHeartRateUsed: 188 })
  assert.deepEqual(zones?.zoneFloors, [110, 130, 150, 160, 170])
  assert.equal(zones?.sport, 'RUNNING')
  assert.equal(mapHeartRateZones({ sport: 'DEFAULT', zone1Floor: 110 }), null)
})

Deno.test('maps fitness age using the last update date', () => {
  const age = mapFitnessAge({ chronologicalAge: 39, fitnessAge: 33.5, achievableFitnessAge: 30, lastUpdated: '2026-11-01T05:00:00.0' }, '2026-11-04')
  assert.equal(age?.calendarDate, '2026-11-01')
  assert.equal(age?.fitnessAge, 33.5)
  assert.equal(mapFitnessAge({ chronologicalAge: 39 }, '2026-11-04'), null)
})

Deno.test('maps HRV and SpO2 readings sorted by time', () => {
  const hrv = mapHrvReadings('2026-11-03', { hrvReadings: [{ hrvValue: 60, readingTimeGMT: '2026-11-03T01:05:00.0' }, { hrvValue: 55, readingTimeGMT: '2026-11-03T01:00:00.0' }] })
  assert.deepEqual(hrv?.points.map(([, v]) => v), [55, 60])
  const spo2 = mapSpo2Readings('2026-11-03', {
    spO2SingleValuesDescriptorList: [
      { spo2ValueDescriptorIndex: 0, spo2ValueDescriptorKey: 'timestamp' },
      { spo2ValueDescriptorIndex: 1, spo2ValueDescriptorKey: 'spo2Reading' },
    ],
    spO2SingleValues: [
      [1_793_660_400_000, 96],
      [1_793_660_100_000, 94],
    ],
  })
  assert.deepEqual(spo2?.points.map(([, v]) => v), [94, 96])
})

Deno.test('maps detailed sleep: need, factors and naps', () => {
  const sleep = mapSleep({
    calendarDate: '2026-11-03',
    sleepTimeSeconds: 27_000,
    sleepStartTimestampGMT: 1_793_660_400_000,
    sleepScores: { overall: { value: 82 }, deepPercentage: { value: 90, qualifierKey: 'EXCELLENT', optimalStart: 16, optimalEnd: 33 } },
    sleepNeed: { baseline: 480, actual: 510, feedback: 'INCREASED_BY_TRAINING' },
    dailyNapDTOS: [{ napStartTimestampGMT: 1_793_685_600_000, napEndTimestampGMT: 1_793_687_100_000, napTimeSec: 1_500 }],
    awakeCount: 2,
    lowestSpO2Value: 91,
  })
  assert.equal(sleep?.need?.actualMin, 510)
  assert.deepEqual(Object.keys(sleep?.scoreFactors ?? {}), ['deepPercentage'])
  assert.equal(sleep?.naps?.[0]?.durationS, 1_500)
  assert.equal(sleep?.awakeCount, 2)
  assert.equal(sleep?.lowestSpo2Percent, 91)
})

Deno.test('collects activity extras: dynamics, power curve and fastest splits', () => {
  const activity = mapActivity({
    activityId: 1,
    activityName: 'Ride',
    startTimeGMT: '2026-11-03 06:00:00',
    activityType: { typeKey: 'cycling' },
    duration: 3_600,
    normPower: 210,
    trainingStressScore: 72.5,
    avgGroundContactTime: 240,
    fastestSplit_1000: 290,
    maxAvgPower_300: 280,
    maxAvgPower_60: 0,
    startStress: 20,
    endStress: 35,
    isPR: true,
  } as never)
  const extra = activity?.extra
  assert.equal(extra?.normPowerW, 210)
  assert.equal(extra?.tss, 72.5)
  assert.equal(extra?.groundContactMs, 240)
  assert.deepEqual(extra?.fastestSplitsS, { 1000: 290 })
  assert.deepEqual(extra?.powerCurveW, { 300: 280 })
  assert.equal(extra?.stressDelta, 15)
  assert.equal(extra?.isPr, true)
})

Deno.test('optional endpoints fail soft but authentication errors still surface', async () => {
  const fetchOk = ((input: URL | string) => {
    const path = new URL(String(input)).pathname
    if (path.endsWith('personal-api-key/token')) return Promise.resolve(Response.json({ access_token: 't' }))
    if (path.includes('usersummary-service/v2/dailysummaries')) return Promise.resolve(Response.json({ data: [] }))
    if (path.includes('weight-service')) return Promise.resolve(new Response('boom', { status: 500 }))
    if (path.includes('hrv-service/hrv/daily')) return Promise.resolve(Response.json({ hrvSummaries: [] }))
    if (path.includes('fitnessage') || path.includes('heartRateZones')) return Promise.resolve(new Response(null, { status: 404 }))
    return Promise.resolve(Response.json([]))
  }) as typeof fetch
  const client = new HttpGarminClient({ baseUrl: 'https://example.test', apiKey: 'k', fetchImpl: fetchOk, now: () => NOW })
  const payload = await client.fetchRange('2026-11-01', '2026-11-03')
  assert.equal(payload.weights.length, 0)

  const fetchDenied = ((input: URL | string) => {
    const path = new URL(String(input)).pathname
    if (path.endsWith('personal-api-key/token')) return Promise.resolve(Response.json({ access_token: 't' }))
    if (path.includes('biometric-service')) return Promise.resolve(new Response(null, { status: 429 }))
    if (path.includes('hrv-service/hrv/daily')) return Promise.resolve(Response.json({ hrvSummaries: [] }))
    if (path.includes('dailysummaries')) return Promise.resolve(Response.json({ data: [] }))
    return Promise.resolve(Response.json([]))
  }) as typeof fetch
  const limited = new HttpGarminClient({ baseUrl: 'https://example.test', apiKey: 'k', fetchImpl: fetchDenied, now: () => NOW })
  await assert.rejects(limited.fetchRange('2026-11-01', '2026-11-03'), (e: unknown) => e instanceof GarminApiError && e.status === 429)
})

Deno.test('fixture data covers the extended model end to end', async () => {
  const bundle = await new GarminProvider(new FixtureGarminClient(() => NOW), () => NOW).fetchRange('2026-10-01', '2026-11-03')
  const day = bundle.daily.find((d) => d.date === '2026-10-20')!
  assert.ok(day.spo2Avg != null && day.respirationAvg != null && day.hydrationMl != null)
  assert.ok(day.stressHighS != null && day.hrvBaselineLow != null)
  const sleep = bundle.sleep.find((s) => s.scoreFactors)!
  assert.ok(sleep.need?.actualMin)
  assert.ok(bundle.body.length > 10 && bundle.body.every((b) => b.weightKg != null))
  assert.ok(bundle.fitnessAge.length > 0 && bundle.hrZones.some((z) => z.sport === 'DEFAULT'))
  assert.ok(bundle.activities.every((a) => a.extra?.elapsedS != null))
  const metrics = new Set(bundle.intraday.map((s) => s.metric))
  assert.ok(metrics.has('hrv') && metrics.has('spo2'))
})

Deno.test('implausible measurements are dropped during normalization', () => {
  const payload = {
    dailies: [{ summaryId: 'd', calendarDate: '2026-11-03', startTimeInSeconds: 1_793_660_400, startTimeOffsetInSeconds: 3600, durationInSeconds: 86_400, avgSpo2Percent: 140, avgRespirationBreathsPerMinute: 900, hydrationConsumedMl: 1_800 }],
    stressDetails: [],
    sleeps: [],
    hrv: [],
    userMetrics: [],
    activities: [],
    weights: [{ calendarDate: '2026-11-03', weightKg: 5, bodyFatPercent: 20 }],
    fitnessAge: [],
    hrZones: [{ sport: 'DEFAULT', zoneFloors: [130, 120, 150, 160, 170] }],
    intradayExtra: [],
  }
  const bundle = normalizeGarminRange(payload, NOW.toISOString())
  assert.equal(bundle.daily[0]!.spo2Avg, null)
  assert.equal(bundle.daily[0]!.respirationAvg, null)
  assert.equal(bundle.daily[0]!.hydrationMl, 1_800)
  assert.equal(bundle.body[0]!.weightKg, null)
  assert.equal(bundle.body[0]!.bodyFatPct, 20)
  assert.equal(bundle.hrZones.length, 0)
})
