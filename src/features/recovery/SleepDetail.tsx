import { useTranslation } from 'react-i18next'
import type { SleepSession } from '@shared/domain.ts'
import { BarRow, StatGrid, SubHeading } from '@/components/StatGrid'
import { useGarminText } from '@/lib/garmin-text'
import { formatClock, formatDuration, formatNumber } from '@/lib/format'

/** Minutes since midnight (may be negative or above 1440) as a 24 h clock time. */
export function minutesToClock(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440
  return `${String(Math.floor(wrapped / 60)).padStart(2, '0')}:${String(wrapped % 60).padStart(2, '0')}`
}

const FACTOR_ORDER = ['totalDuration', 'deepPercentage', 'remPercentage', 'lightPercentage', 'awakeCount', 'restlessness', 'stress']

/** Everything beyond the stage bar for one night: feedback, sleep need, score factors, timing, vitals and naps. */
export function SleepDetail({ sleep }: { sleep: SleepSession }) {
  const { t } = useTranslation()
  const text = useGarminText()
  const feedback = text('sleepFeedback', sleep.scoreFeedback)
  const insight = text('sleepInsight', sleep.scoreInsight)
  const need = sleep.need
  const needed = need?.actualMin ?? need?.baselineMin ?? null
  const sleptMin = sleep.durationS / 60
  const factors = FACTOR_ORDER.map((key) => [key, sleep.scoreFactors?.[key]] as const).filter(([, f]) => f && f.value !== null)
  const alignment = sleep.alignment
  const alignmentLabel = text('alignment', alignment?.status)
  const breathing = text('breathing', sleep.breathingDisruption)
  const naps = sleep.naps ?? []

  return (
    <div className="space-y-5">
      {(feedback || insight) && (
        <div className="space-y-1 rounded-xl bg-muted/60 p-3">
          {feedback && <p className="text-sm font-medium">{feedback}</p>}
          {insight && <p className="text-sm text-muted-foreground">{insight}</p>}
        </div>
      )}

      {needed !== null && (
        <div className="space-y-2">
          <SubHeading>{t('sleepDetail.need')}</SubHeading>
          <BarRow
            label={t('sleepDetail.slept')}
            valueText={`${formatDuration(sleep.durationS)} / ${formatDuration(needed * 60)}`}
            percent={(sleptMin / needed) * 100}
            color="var(--m-sleep)"
            caption={sleptMin >= needed ? t('sleepDetail.needMet') : t('sleepDetail.needMissing', { duration: formatDuration((needed - sleptMin) * 60) })}
          />
          {need?.baselineMin != null && need.actualMin != null && need.actualMin !== need.baselineMin && (
            <p className="text-xs text-muted-foreground">{t('sleepDetail.needAdjusted', { baseline: formatDuration(need.baselineMin * 60), adjusted: formatDuration(need.actualMin * 60) })}</p>
          )}
          {text('needFeedback', need?.feedback) && <p className="text-xs text-muted-foreground">{text('needFeedback', need?.feedback)}</p>}
        </div>
      )}

      {factors.length > 0 && (
        <div className="space-y-3">
          <SubHeading>{t('sleepDetail.factors')}</SubHeading>
          {factors.map(([key, factor]) => (
            <BarRow key={key} label={text('scoreFactor', key) ?? key} valueText={`${formatNumber(factor?.value ?? 0)}${factor?.qualifier ? ` · ${text('qualifier', factor.qualifier)}` : ''}`} percent={factor?.value ?? 0} color="var(--m-sleep)" />
          ))}
          <p className="text-xs text-muted-foreground">{t('sleepDetail.factorsNote')}</p>
        </div>
      )}

      {alignment && alignment.windowStartMin !== null && alignment.windowEndMin !== null && (
        <div className="space-y-1.5">
          <SubHeading>{t('sleepDetail.timing')}</SubHeading>
          <p className="text-sm">
            {t('sleepDetail.bedtimeWindow', { from: minutesToClock(alignment.windowStartMin), to: minutesToClock(alignment.windowEndMin) })}
            {alignmentLabel && <span className="text-muted-foreground"> · {alignmentLabel}</span>}
          </p>
          <p className="text-xs text-muted-foreground">{t('sleepDetail.timingNote')}</p>
        </div>
      )}

      <div className="space-y-3">
        <SubHeading>{t('sleepDetail.vitals')}</SubHeading>
        <StatGrid
          items={[
            sleep.avgHr !== null && { label: t('sleepDetail.avgHr'), value: `${formatNumber(sleep.avgHr)} bpm` },
            sleep.avgSpo2 !== null && { label: t('recovery.spo2'), value: `${formatNumber(sleep.avgSpo2)} %`, ...(sleep.spo2Low !== null ? { hint: t('sleepDetail.lowest', { value: formatNumber(sleep.spo2Low) }) } : {}) },
            sleep.avgRespiration !== null && {
              label: t('recovery.respiration'),
              value: `${formatNumber(sleep.avgRespiration, 1)} ${t('recovery.perMinute')}`,
              ...(sleep.respirationLow !== null && sleep.respirationHigh !== null ? { hint: `${formatNumber(sleep.respirationLow, 0)}–${formatNumber(sleep.respirationHigh, 0)}` } : {}),
            },
            sleep.avgSleepStress !== null && { label: t('metrics.sleepStress.label'), value: formatNumber(sleep.avgSleepStress) },
            sleep.awakeCount !== null && { label: t('sleepDetail.awakenings'), value: formatNumber(sleep.awakeCount) },
            sleep.spo2Events !== null && sleep.spo2Events > 0 && { label: t('sleepDetail.spo2Events'), value: formatNumber(sleep.spo2Events) },
          ]}
        />
        {breathing && <p className="text-xs text-muted-foreground">{t('sleepDetail.breathing', { value: breathing })}</p>}
      </div>

      {naps.length > 0 && (
        <div className="space-y-2">
          <SubHeading>{t('sleepDetail.naps')}</SubHeading>
          <ul className="space-y-1.5 text-sm">
            {naps.map((nap) => (
              <li key={nap.startTime} className="flex justify-between gap-3">
                <span className="tabular">
                  {formatClock(nap.startTime)}{nap.endTime ? ` – ${formatClock(nap.endTime)}` : ''}
                </span>
                <span className="text-right text-muted-foreground">
                  {formatDuration(nap.durationS)}
                  {text('napFeedback', nap.feedback) && ` · ${text('napFeedback', nap.feedback)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
