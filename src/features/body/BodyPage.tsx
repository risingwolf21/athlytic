import { useMemo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import type { BodyComposition, FitnessAge, HrZoneConfig } from '@shared/domain.ts'
import { addDays } from '@shared/dates.ts'
import { TrendChart, type TrendPoint } from '@/components/charts/TrendChart'
import { KindBadge } from '@/components/KindBadge'
import { EmptyState, ErrorState, PageSkeleton, Panel, Section } from '@/components/page'
import { Segmented } from '@/components/Segmented'
import { StatGrid } from '@/components/StatGrid'
import { useFitnessData } from '@/hooks/use-fitness-data'
import { formatDay, formatNumber } from '@/lib/format'
import { humanizeCode } from '@/lib/garmin-text'
import { METRIC_STYLE } from '@/lib/metric-style'
import { RANGE_DAYS, useUiStore, type RangePreset } from '@/stores/ui'

const RANGES: RangePreset[] = ['30d', '90d', '1y']

type BodyKey = 'weightKg' | 'bodyFatPct' | 'muscleMassKg'

function seriesFor(body: readonly BodyComposition[], key: BodyKey, from: string): TrendPoint[] {
  return body.filter((b) => b.date >= from && b[key] !== null).map((b) => ({ date: b.date, value: b[key] }))
}

function BodyTrend({ title, body, metric, field, from, unit }: { title: string; body: readonly BodyComposition[]; metric: 'weightKg' | 'bodyFatPct'; field: BodyKey; from: string; unit: string }) {
  const { t } = useTranslation()
  const data = seriesFor(body, field, from)
  const first = data[0]?.value ?? null
  const last = data[data.length - 1]?.value ?? null
  const delta = first !== null && last !== null && data.length > 1 ? last - first : null
  const format = (v: number) => `${formatNumber(v, 1)} ${unit}`
  return (
    <Section title={title} action={<KindBadge kind="measured" />}>
      <Panel className="space-y-3">
        {data.length >= 2 ? (
          <>
            <div className="flex items-baseline justify-between">
              <p className="text-3xl font-semibold tabular">{last !== null ? format(last) : '–'}</p>
              {delta !== null && (
                <p className="text-sm text-muted-foreground tabular">{t('body.changeInRange', { value: `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${formatNumber(Math.abs(delta), 1)} ${unit}` })}</p>
              )}
            </div>
            <TrendChart data={data} color={METRIC_STYLE[metric].color} variant="line" format={format} formatTick={(v) => formatNumber(v, 1)} lowCoverageLabel={t('common.lowCoverage')} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t('body.notEnough')}</p>
        )}
      </Panel>
    </Section>
  )
}

function Composition({ latest }: { latest: BodyComposition }) {
  const { t } = useTranslation()
  const pct = (v: number | null) => (v === null ? null : `${formatNumber(v, 1)} %`)
  const kg = (v: number | null) => (v === null ? null : `${formatNumber(v, 1)} kg`)
  const items = [
    ['bmi', latest.bmi === null ? null : formatNumber(latest.bmi, 1)],
    ['bodyWater', pct(latest.bodyWaterPct)],
    ['muscle', kg(latest.muscleMassKg)],
    ['bone', kg(latest.boneMassKg)],
    ['visceral', latest.visceralFat === null ? null : formatNumber(latest.visceralFat, 0)],
    ['metabolicAge', latest.metabolicAge === null ? null : `${formatNumber(latest.metabolicAge, 0)} ${t('body.years')}`],
  ] as const
  return (
    <Section title={t('body.composition')} action={<KindBadge kind="measured" />}>
      <Panel className="space-y-3">
        <StatGrid items={items.map(([key, value]) => value !== null && { label: t(`body.fields.${key}`), value })} />
        <p className="text-xs text-muted-foreground">{t('body.compositionNote', { day: formatDay(latest.date, 'medium') })}</p>
      </Panel>
    </Section>
  )
}

function FitnessAgeSection({ age }: { age: FitnessAge }) {
  const { t, i18n } = useTranslation()
  const diff = age.fitnessAge !== null && age.chronologicalAge !== null ? age.chronologicalAge - age.fitnessAge : null
  const components = Object.entries(age.components ?? {}).sort(([, a], [, b]) => (a.priority ?? 99) - (b.priority ?? 99))
  const label = (key: string) => (i18n.exists(`body.ageComponents.${key}`) ? t(`body.ageComponents.${key}` as never) : humanizeCode(key.replace(/([A-Z])/g, '_$1')))
  return (
    <Section title={t('body.fitnessAge')} action={<KindBadge kind="calculated" />}>
      <Panel className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-4xl leading-none font-semibold tabular">{age.fitnessAge !== null ? formatNumber(age.fitnessAge, 0) : '–'}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t('body.yearsOld')}</p>
          </div>
          {diff !== null && (
            <p className="text-right text-sm">
              {diff === 0 ? t('body.sameAsAge') : t(diff > 0 ? 'body.youngerThanAge' : 'body.olderThanAge', { years: formatNumber(Math.abs(diff), 0), age: formatNumber(age.chronologicalAge ?? 0, 0) })}
            </p>
          )}
        </div>
        <StatGrid
          items={[
            age.achievableFitnessAge !== null && { label: t('body.achievable'), value: formatNumber(age.achievableFitnessAge, 0) },
            age.previousFitnessAge !== null && { label: t('body.previous'), value: formatNumber(age.previousFitnessAge, 0) },
          ]}
        />
        {components.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{t('body.ageFactors')}</h3>
            <ul className="divide-y">
              {components.map(([key, c]) => {
                const caption = [c.targetValue !== null && t('body.target', { value: formatNumber(c.targetValue, 1) }), c.potentialAge !== null && t('body.potential', { age: formatNumber(c.potentialAge, 0) })].filter(Boolean).join(' · ')
                return (
                  <li key={key} className="py-2.5">
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span>{label(key)}</span>
                      <span className="font-semibold tabular">{c.value !== null ? formatNumber(c.value, 1) : '–'}</span>
                    </div>
                    {caption && <p className="mt-0.5 text-xs text-muted-foreground tabular">{caption}</p>}
                  </li>
                )
              })}
            </ul>
            <p className="text-xs text-muted-foreground">{t('body.ageNote')}</p>
          </div>
        )}
      </Panel>
    </Section>
  )
}

function ZoneConfigs({ configs }: { configs: HrZoneConfig[] }) {
  const { t, i18n } = useTranslation()
  return (
    <Section title={t('body.hrZones')}>
      <div className="space-y-3">
        {configs.map((config) => {
          const max = config.maxHr
          const floors = config.zoneFloors
          return (
            <Panel key={config.sport} className="space-y-3">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold">{i18n.exists(`body.zoneSports.${config.sport}`) ? t(`body.zoneSports.${config.sport}` as never) : humanizeCode(config.sport)}</h3>
                {config.trainingMethod && <span className="text-xs text-muted-foreground">{i18n.exists(`body.zoneMethods.${config.trainingMethod}`) ? t(`body.zoneMethods.${config.trainingMethod}` as never) : humanizeCode(config.trainingMethod)}</span>}
              </div>
              <ul className="divide-y text-sm tabular">
                {floors.map((floor, i) => {
                  const upper = i < 4 ? (floors[i + 1] as number) - 1 : max
                  return (
                    <li key={floor} className="flex min-h-9 items-center justify-between">
                      <span>{t('activities.zone', { zone: i + 1 })}</span>
                      <span className="text-muted-foreground">
                        {formatNumber(floor)}–{upper !== null ? formatNumber(upper) : '…'} bpm
                      </span>
                    </li>
                  )
                })}
              </ul>
              <StatGrid
                columns={3}
                items={[
                  config.restingHr !== null && { label: t('body.restingHr'), value: `${formatNumber(config.restingHr)} bpm` },
                  config.lactateThresholdHr !== null && { label: t('body.lactateThreshold'), value: `${formatNumber(config.lactateThresholdHr)} bpm` },
                  config.maxHr !== null && { label: t('body.maxHr'), value: `${formatNumber(config.maxHr)} bpm` },
                ]}
              />
            </Panel>
          )
        })}
      </div>
    </Section>
  )
}

export default function BodyPage() {
  const { t } = useTranslation()
  const data = useFitnessData()
  const range = useUiStore((s) => s.range)
  const setRange = useUiStore((s) => s.setRange)
  const effective: RangePreset = RANGES.includes(range) ? range : '90d'

  const body = useMemo(() => [...(data.bundle?.body ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [data.bundle])
  const fitnessAge = useMemo(() => [...(data.bundle?.fitnessAge ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0] ?? null, [data.bundle])
  const zones = data.bundle?.hrZones ?? []

  if (data.isLoading) return <PageSkeleton />
  if (data.isError) return <ErrorState error={data.error} />

  const anchor = body[body.length - 1]?.date ?? data.today ?? '1970-01-01'
  const from = addDays(anchor, -(RANGE_DAYS[effective] - 1))
  const latest = [...body].reverse().find((b) => b.weightKg !== null || b.bodyFatPct !== null) ?? null

  return (
    <div className="space-y-6">
      <div className="pt-2">
        <Link to="/" className="-ml-1 inline-flex min-h-9 items-center gap-0.5 text-sm font-medium text-primary">
          <ChevronLeft className="size-4" aria-hidden />
          {t('nav.dashboard')}
        </Link>
        <h1 className="mt-1 text-[1.75rem] leading-tight font-semibold">{t('body.title')}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t('body.subtitle')}</p>
      </div>

      {body.length === 0 && !fitnessAge && zones.length === 0 ? (
        <EmptyState title={t('body.emptyTitle')} description={t('body.emptyDescription')} />
      ) : (
        <>
          {body.length > 0 && (
            <>
              <Segmented label={t('analytics.range')} value={effective} onChange={setRange} options={RANGES.map((r) => ({ value: r, label: t(`analytics.ranges.${r}`) }))} className="w-full" />
              <BodyTrend title={t('metrics.weightKg.label')} body={body} metric="weightKg" field="weightKg" from={from} unit="kg" />
              {body.some((b) => b.bodyFatPct !== null) && <BodyTrend title={t('metrics.bodyFatPct.label')} body={body} metric="bodyFatPct" field="bodyFatPct" from={from} unit="%" />}
              {latest && <Composition latest={latest} />}
            </>
          )}
          {fitnessAge && <FitnessAgeSection age={fitnessAge} />}
          {zones.length > 0 && <ZoneConfigs configs={zones} />}
        </>
      )}
    </div>
  )
}
