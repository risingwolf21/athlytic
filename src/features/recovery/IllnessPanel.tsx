import { useMemo } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Thermometer } from 'lucide-react'
import { assessIllnessPattern, METRICS, type DailyRecord, type IllnessDay, type IllnessState } from '@/analytics'
import { KindBadge } from '@/components/KindBadge'
import { Panel, Section } from '@/components/page'
import { BarRow, SubHeading } from '@/components/StatGrid'
import { formatDay, formatNumber, formatSigned } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATE_STYLE: Record<IllnessState, { dot: string; icon: string }> = {
  insufficient: { dot: 'bg-muted-foreground/40', icon: 'bg-muted text-muted-foreground' },
  normal: { dot: 'bg-positive', icon: 'bg-positive/12 text-positive' },
  watch: { dot: 'bg-attention/60', icon: 'bg-attention/14 text-attention' },
  pattern: { dot: 'bg-attention', icon: 'bg-attention/14 text-attention' },
}

function dayStatus(day: IllnessDay): 'flagged' | 'watch' | 'normal' | 'unknown' {
  if (day.signals.length < 2) return 'unknown'
  return day.flagged ? 'flagged' : day.flaggedCount > 0 ? 'watch' : 'normal'
}

const DAY_CLASS = { flagged: 'bg-attention', watch: 'bg-attention/35', normal: 'bg-positive/50', unknown: 'bg-muted' } as const

/** Early-warning panel: shows the multi-signal pattern, the evidence behind it and its limits. */
export function IllnessPanel({ records }: { records: readonly DailyRecord[] }) {
  const { t } = useTranslation()
  const assessment = useMemo(() => assessIllnessPattern(records), [records])
  const { state, day } = assessment
  const style = STATE_STYLE[state]
  const points = t('illness.evidence.points', { returnObjects: true }) as unknown as string[]
  const past = assessment.episodes.filter((e) => e.to !== assessment.date)
  const lastDates = past.slice(-3).map((e) => (e.from === e.to ? formatDay(e.from, 'short') : `${formatDay(e.from, 'short')}–${formatDay(e.to, 'short')}`)).join(', ')

  return (
    <Section title={t('illness.title')} action={<KindBadge kind="calculated" />}>
      <Panel className="space-y-5">
        <div className="flex items-start gap-3">
          <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', style.icon)}>
            <Thermometer className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="font-semibold">{t(`illness.states.${state}.title`)}</p>
            <p className="text-sm text-muted-foreground">{t(`illness.states.${state}.body`, { streak: assessment.streak })}</p>
          </div>
        </div>

        {day && day.signals.length > 0 && (
          <div className="space-y-3.5">
            <SubHeading>{t('illness.signals')}</SubHeading>
            {day.signals.map((signal) => {
              const unit = t(`units.${METRICS[signal.metric].unit}`)
              const decimals = METRICS[signal.metric].decimals
              return (
                <BarRow
                  key={signal.metric}
                  label={t(`metrics.${signal.metric}.label`)}
                  valueText={signal.flagged ? t('illness.signalFlagged') : t('illness.signalNormal')}
                  percent={Math.max(4, (Math.max(0, signal.unfavourableZ) / 3) * 100)}
                  color={signal.flagged ? 'var(--attention)' : 'var(--positive)'}
                  caption={`${t('illness.signalValue', { value: formatNumber(signal.value, decimals), unit, median: formatNumber(signal.median, decimals) })} · ${t('illness.zCaption', { z: formatSigned(signal.unfavourableZ, 1) })}`}
                />
              )
            })}
          </div>
        )}

        {assessment.recent.length > 0 && (
          <div className="space-y-2">
            <SubHeading>{t('illness.lastDays')}</SubHeading>
            <ul className="flex gap-1" aria-label={t('illness.lastDays')}>
              {assessment.recent.map((d) => {
                const status = dayStatus(d)
                return (
                  <li key={d.date} className="flex-1" title={`${formatDay(d.date, 'short')} · ${t(`illness.dayStatus.${status}`)}`}>
                    <span className={cn('block h-6 rounded-md', DAY_CLASS[status])} />
                  </li>
                )
              })}
            </ul>
            <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {(['flagged', 'watch', 'normal', 'unknown'] as const).map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className={cn('size-2 rounded-full', DAY_CLASS[s])} aria-hidden />
                  {t(`illness.dayStatus.${s}`)}
                </span>
              ))}
            </p>
          </div>
        )}

        {assessment.confounders.length > 0 && (
          <div className="space-y-1 rounded-xl bg-muted px-3 py-2.5 text-sm">
            <p className="font-medium">{t('illness.confoundersTitle')}</p>
            <p className="text-muted-foreground">{assessment.confounders.map((c) => t(`illness.confounders.${c}`)).join(', ')}</p>
          </div>
        )}

        {state !== 'insufficient' && (
          <div className="space-y-1">
            <SubHeading>{t('illness.historyTitle')}</SubHeading>
            <p className="text-sm text-muted-foreground">{past.length === 0 ? t('illness.historyNone') : t('illness.historyCount', { count: past.length, dates: lastDates })}</p>
            <p className="text-xs text-muted-foreground">{t('illness.historyCaveat')}</p>
          </div>
        )}

        <details className="group rounded-xl border border-border/60 px-3 py-2.5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">
            {t('illness.evidence.title')}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-3 space-y-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t('illness.evidence.verdict')}</p>
            <ul className="list-disc space-y-2 pl-4">
              {points.map((p) => <li key={p}>{p}</li>)}
            </ul>
            <p>{t('illness.evidence.conclusion')}</p>
          </div>
        </details>

        <p className="text-xs text-muted-foreground">{t('illness.disclaimer')}</p>
        <Link to="/insights/methods" className="text-sm font-medium text-primary">{t('illness.method')}</Link>
      </Panel>
    </Section>
  )
}
