import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp } from 'lucide-react'
import type { DailyMetrics } from '@shared/domain.ts'
import { StatGrid, SubHeading } from '@/components/StatGrid'
import { formatClock, formatDuration, formatNumber } from '@/lib/format'
import { useGarminText } from '@/lib/garmin-text'

const BANDS = [
  { key: 'stressRestS', label: 'rest', color: 'color-mix(in oklch, var(--m-battery) 80%, transparent)' },
  { key: 'stressLowS', label: 'low', color: 'color-mix(in oklch, var(--m-stress) 35%, transparent)' },
  { key: 'stressMediumS', label: 'medium', color: 'color-mix(in oklch, var(--m-stress) 70%, transparent)' },
  { key: 'stressHighS', label: 'high', color: 'var(--m-stress)' },
] as const

/** Where the day's time went across the device's stress bands. Activity time is excluded because stress is not rated during workouts. */
export function StressBreakdown({ daily }: { daily: DailyMetrics }) {
  const { t } = useTranslation()
  const seconds = BANDS.map((b) => daily[b.key] ?? 0)
  const total = seconds.reduce((a, b) => a + b, 0)
  if (total === 0) return null
  const summary = BANDS.map((b, i) => `${t(`dayDetail.stress.${b.label}`)} ${formatDuration(seconds[i] ?? 0)}`).join(', ')
  return (
    <div className="space-y-3">
      <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={summary}>
        {BANDS.map((band, i) => {
          const value = seconds[i] ?? 0
          if (!value) return null
          return <motion.div key={band.key} style={{ background: band.color }} initial={{ width: 0 }} animate={{ width: `${(value / total) * 100}%` }} transition={{ duration: 0.8, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }} />
        })}
      </div>
      <dl className="grid grid-cols-4 gap-2 text-xs">
        {BANDS.map((band, i) => (
          <div key={band.key} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 shrink-0 rounded-full" style={{ background: band.color }} />
              <span className="truncate">{t(`dayDetail.stress.${band.label}`)}</span>
            </dt>
            <dd className="mt-0.5 font-medium tabular">{formatDuration(seconds[i] ?? 0)}</dd>
            <dd className="text-muted-foreground tabular">{formatNumber(((seconds[i] ?? 0) / total) * 100)} %</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** Charge and drain events of the day with their effect on Body Battery. */
export function BatteryEvents({ daily }: { daily: DailyMetrics }) {
  const { t } = useTranslation()
  const text = useGarminText()
  const events = (daily.bodyBatteryEvents ?? []).filter((e) => e.startTime)
  const items = [
    daily.bodyBatteryCharged !== null && { label: t('dayDetail.charged'), value: `+${formatNumber(daily.bodyBatteryCharged)}` },
    daily.bodyBatteryDrained !== null && { label: t('dayDetail.drained'), value: `−${formatNumber(Math.abs(daily.bodyBatteryDrained))}` },
    daily.bodyBatteryEndOfDay !== null && { label: t('dayDetail.endOfDay'), value: formatNumber(daily.bodyBatteryEndOfDay) },
  ]
  if (events.length === 0 && items.every((i) => !i)) return null
  return (
    <div className="space-y-3">
      <StatGrid items={items} columns={3} />
      {events.length > 0 && (
        <>
          <SubHeading>{t('dayDetail.events')}</SubHeading>
          <ul className="divide-y">
            {events.map((event) => {
              const positive = (event.impact ?? 0) >= 0
              const Arrow = positive ? ArrowUp : ArrowDown
              return (
                <li key={`${event.type}-${event.startTime}`} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{text('batteryEvent', event.type)}</p>
                    <p className="text-xs text-muted-foreground tabular">
                      {formatClock(event.startTime as string)}
                      {event.durationS ? ` · ${formatDuration(event.durationS)}` : ''}
                    </p>
                  </div>
                  {event.impact !== null && (
                    <span className="flex shrink-0 items-center gap-1 font-semibold tabular">
                      <Arrow className="size-3.5" aria-hidden />
                      {positive ? '+' : '−'}
                      {formatNumber(Math.abs(event.impact))}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

/** HRV status with the provider's own balanced range, next to last night's value. */
export function HrvStatusCard({ daily }: { daily: DailyMetrics }) {
  const { t } = useTranslation()
  if (daily.hrvLastNightAvg === null && daily.hrvStatus === null) return null
  const low = daily.hrvBaselineLow
  const high = daily.hrvBaselineHigh
  const value = daily.hrvLastNightAvg
  const position = value !== null && low !== null && high !== null ? (value < low ? 'below' : value > high ? 'above' : 'within') : null
  return (
    <div className="space-y-2">
      <StatGrid
        items={[
          value !== null && { label: t('dayDetail.hrvLastNight'), value: `${formatNumber(value)} ms` },
          daily.hrvWeeklyAvg !== null && { label: t('dayDetail.hrvWeekly'), value: `${formatNumber(daily.hrvWeeklyAvg)} ms` },
          low !== null && high !== null && { label: t('dayDetail.hrvRange'), value: `${formatNumber(low)}–${formatNumber(high)} ms`, hint: position ? t(`dayDetail.hrvPosition.${position}`) : '' },
          daily.hrvStatus !== null && { label: t('dayDetail.hrvStatus'), value: t(`recovery.hrvStatuses.${daily.hrvStatus}` as never) as string },
        ]}
      />
      <p className="text-xs text-muted-foreground">{t('dayDetail.hrvNote')}</p>
    </div>
  )
}
