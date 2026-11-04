import { useTranslation } from 'react-i18next'
import type { Activity, ActivityExtra, HrZoneConfig } from '@shared/domain.ts'
import { BarRow, StatGrid, SubHeading, type StatItem } from '@/components/StatGrid'
import { Panel, Section } from '@/components/page'
import { formatDuration, formatNumber } from '@/lib/format'
import { useGarminText } from '@/lib/garmin-text'

type Item = StatItem | false

function num(value: number | undefined, unit: string, decimals = 0): Item {
  return value !== undefined && value !== null && { label: '', value: `${formatNumber(value, decimals)} ${unit}`.trim() }
}

function labelled(label: string, item: Item): Item {
  return item && { ...item, label }
}

function Group({ title, items, columns }: { title: string; items: Item[]; columns?: 2 | 3 }) {
  if (!items.some(Boolean)) return null
  return (
    <div className="space-y-2.5">
      <SubHeading>{title}</SubHeading>
      <StatGrid items={items} columns={columns ?? 2} />
    </div>
  )
}

/** Picks the user's heart rate zone settings for a sport, falling back to the default configuration. */
export function zoneConfigFor(configs: readonly HrZoneConfig[], sport: Activity['sport']): HrZoneConfig | null {
  const wanted = sport.toUpperCase()
  return configs.find((c) => c.sport.toUpperCase() === wanted) ?? configs.find((c) => c.sport === 'DEFAULT') ?? null
}

/** Label for a heart rate zone including its bpm range when the user's zone settings are known. */
export function zoneRangeLabel(config: HrZoneConfig | null, zone: number): string | null {
  if (!config) return null
  const floor = config.zoneFloors[zone - 1]
  if (floor === undefined) return null
  const next = config.zoneFloors[zone]
  const upper = next !== undefined ? next - 1 : config.maxHr
  return upper !== null ? `${formatNumber(floor)}–${formatNumber(upper)}` : `${formatNumber(floor)}+`
}

export function ExtraStats({ extra, activity }: { extra: ActivityExtra; activity: Activity }) {
  const { t } = useTranslation()
  const e = (key: string, params?: Record<string, string>) => String(t(`activityExtra.${key}` as never, params as never))
  const balance = extra.groundContactBalancePct
  const groups = [
    <Group
      key="dynamics"
      title={e('dynamics')}
      items={[
        labelled(e('groundContact'), num(extra.groundContactMs, 'ms')),
        labelled(e('stride'), num(extra.strideLengthCm, 'cm')),
        labelled(e('vertical'), num(extra.verticalOscillationCm, 'cm', 1)),
        labelled(e('verticalRatio'), num(extra.verticalRatioPct, '%', 1)),
        balance !== undefined && { label: e('balance'), value: `${formatNumber(balance, 1)} / ${formatNumber(100 - balance, 1)} %`, hint: e('balanceHint') },
      ]}
    />,
    <Group
      key="power"
      title={e('power')}
      items={[
        labelled(e('normPower'), num(extra.normPowerW, 'W')),
        labelled(e('maxPower'), num(extra.maxPowerW, 'W')),
        labelled(e('power20'), num(extra.max20MinPowerW, 'W')),
        labelled(e('ftp'), num(extra.ftpW, 'W')),
        labelled(e('tss'), num(extra.tss, '', 0)),
        labelled(e('intensityFactor'), num(extra.intensityFactor, '', 2)),
      ]}
    />,
    <Group
      key="body"
      title={e('bodyResponse')}
      items={[
        extra.avgStress !== undefined && { label: e('avgStress'), value: formatNumber(extra.avgStress), ...(extra.stressDelta !== undefined ? { hint: e('stressDelta', { value: `${extra.stressDelta > 0 ? '+' : extra.stressDelta < 0 ? '−' : ''}${formatNumber(Math.abs(extra.stressDelta))}` }) } : {}) },
        extra.bodyBatteryDelta !== undefined && { label: e('batteryDelta'), value: `${extra.bodyBatteryDelta > 0 ? '+' : extra.bodyBatteryDelta < 0 ? '−' : ''}${formatNumber(Math.abs(extra.bodyBatteryDelta))}` },
        labelled(e('lactateThreshold'), num(extra.lactateThresholdBpm, 'bpm')),
        extra.avgRespiration !== undefined && { label: e('respiration'), value: `${formatNumber(extra.avgRespiration, 0)} /min`, ...(extra.minRespiration !== undefined && extra.maxRespiration !== undefined ? { hint: `${formatNumber(extra.minRespiration, 0)}–${formatNumber(extra.maxRespiration, 0)}` } : {}) },
        extra.moderateMin !== undefined || extra.vigorousMin !== undefined
          ? { label: e('intensityMinutes'), value: formatNumber((extra.moderateMin ?? 0) + (extra.vigorousMin ?? 0) * 2), hint: e('intensityMinutesHint', { moderate: formatNumber(extra.moderateMin ?? 0), vigorous: formatNumber(extra.vigorousMin ?? 0) }) }
          : false,
      ]}
    />,
    <Group
      key="conditions"
      title={e('conditions')}
      items={[
        extra.minTempC !== undefined && extra.maxTempC !== undefined && { label: e('temperature'), value: extra.minTempC === extra.maxTempC ? `${formatNumber(extra.minTempC, 0)} °C` : `${formatNumber(extra.minTempC, 0)}–${formatNumber(extra.maxTempC, 0)} °C` },
        extra.minElevationM !== undefined && extra.maxElevationM !== undefined && { label: e('elevationRange'), value: `${formatNumber(extra.minElevationM)}–${formatNumber(extra.maxElevationM)} m` },
        labelled(e('steps'), num(extra.steps, '')),
        labelled(e('floors'), num(extra.floorsClimbed, '')),
        labelled(e('maxCadence'), num(extra.maxCadence, activity.sport === 'cycling' ? 'rpm' : 'spm')),
        labelled(e('laps'), num(extra.lapCount, '')),
        extra.elapsedS !== undefined && extra.elapsedS > activity.durationS + 30 && { label: e('elapsed'), value: formatDuration(extra.elapsedS), hint: e('elapsedHint') },
        labelled(e('strokes'), num(extra.strokes, '')),
        labelled(e('swolf'), num(extra.swolf, '')),
        extra.location !== undefined && extra.location !== '' && { label: e('location'), value: extra.location },
      ]}
    />,
  ]
  if (!groups.some((g) => g.type === Group && (g.props as { items: Item[] }).items.some(Boolean))) return null
  return (
    <Section title={e('title')}>
      <Panel className="space-y-5">{groups}</Panel>
    </Section>
  )
}

function splitLabel(metres: number): string {
  if (metres === 1609) return '1 mi'
  if (metres === 21097) return '21,1 km'
  if (metres === 42195) return '42,2 km'
  return metres < 1000 ? `${metres} m` : `${formatNumber(metres / 1000, metres % 1000 === 0 ? 0 : 1)} km`
}

export function FastestSplits({ splits }: { splits: Record<string, number> }) {
  const { t } = useTranslation()
  const rows = Object.entries(splits)
    .map(([metres, seconds]) => ({ metres: Number(metres), seconds }))
    .filter((r) => Number.isFinite(r.metres) && r.seconds > 0)
    .sort((a, b) => a.metres - b.metres)
  if (rows.length === 0) return null
  return (
    <Section title={t('activityExtra.fastestSplits')}>
      <Panel className="space-y-2">
        <ul className="divide-y text-sm tabular">
          {rows.map((r) => (
            <li key={r.metres} className="flex min-h-10 items-center justify-between">
              <span>{splitLabel(r.metres)}</span>
              <span className="text-right">
                <span className="font-medium">{formatDuration(r.seconds)}</span>
                <span className="ml-2 text-muted-foreground">{formatPaceFromSplit(r.metres, r.seconds)}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">{t('activityExtra.fastestSplitsNote')}</p>
      </Panel>
    </Section>
  )
}

function formatPaceFromSplit(metres: number, seconds: number): string {
  const perKm = seconds / (metres / 1000)
  const min = Math.floor(perKm / 60)
  const sec = Math.round(perKm % 60)
  return `${min}:${String(sec === 60 ? 59 : sec).padStart(2, '0')} /km`
}

function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  if (seconds < 3600) return `${formatNumber(seconds / 60, seconds % 60 === 0 ? 0 : 1)} min`
  return `${formatNumber(seconds / 3600, 1)} h`
}

export function PowerSection({ curve, zones }: { curve: Record<string, number> | undefined; zones: number[] | undefined }) {
  const { t } = useTranslation()
  const points = Object.entries(curve ?? {})
    .map(([seconds, watts]) => ({ seconds: Number(seconds), watts }))
    .filter((p) => Number.isFinite(p.seconds) && p.watts > 0)
    .sort((a, b) => a.seconds - b.seconds)
  const zoneTotal = (zones ?? []).reduce((a, b) => a + b, 0)
  if (points.length === 0 && zoneTotal === 0) return null
  const maxWatts = Math.max(0, ...points.map((p) => p.watts))
  return (
    <Section title={t('activityExtra.powerTitle')}>
      <Panel className="space-y-5">
        {points.length > 0 && (
          <div className="space-y-3">
            <SubHeading>{t('activityExtra.powerCurve')}</SubHeading>
            {points.map((p) => (
              <BarRow key={p.seconds} label={durationLabel(p.seconds)} valueText={`${formatNumber(p.watts)} W`} percent={(p.watts / maxWatts) * 100} color="var(--m-load)" />
            ))}
            <p className="text-xs text-muted-foreground">{t('activityExtra.powerCurveNote')}</p>
          </div>
        )}
        {zoneTotal > 0 && zones && (
          <div className="space-y-3">
            <SubHeading>{t('activityExtra.powerZones')}</SubHeading>
            {zones.map((s, i) => (
              <BarRow key={i} label={t('activities.zone', { zone: i + 1 })} valueText={`${formatDuration(s)} · ${formatNumber((s / zoneTotal) * 100)} %`} percent={(s / zoneTotal) * 100} color="var(--m-load)" />
            ))}
          </div>
        )}
      </Panel>
    </Section>
  )
}

/** Garmin's own wording about the training effect, translated. */
export function EffectMessages({ extra }: { extra: ActivityExtra | null }) {
  const text = useGarminText()
  const { t } = useTranslation()
  if (!extra) return null
  const label = text('trainingEffect', extra.trainingEffectLabel)
  const aerobic = text('trainingEffect', extra.aerobicMessage)
  const anaerobic = text('trainingEffect', extra.anaerobicMessage)
  if (!label && !aerobic && !anaerobic) return null
  return (
    <div className="space-y-1.5 border-t pt-3 text-sm">
      {label && (
        <p>
          <span className="text-muted-foreground">{t('activityExtra.primaryBenefit')}: </span>
          <span className="font-medium">{label}</span>
        </p>
      )}
      {aerobic && (
        <p>
          <span className="text-muted-foreground">{t('activities.aerobic')}: </span>
          {aerobic}
        </p>
      )}
      {anaerobic && (
        <p>
          <span className="text-muted-foreground">{t('activities.anaerobic')}: </span>
          {anaerobic}
        </p>
      )}
    </div>
  )
}
