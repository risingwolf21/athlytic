import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { METRICS, FORMULAS, type InsightEvidence } from '@/analytics'
import { RelationChart } from '@/components/charts/RelationChart'
import { TrendChart } from '@/components/charts/TrendChart'
import { ConfidenceBadge } from '@/features/insights/ConfidenceBadge'
import { KindBadge } from '@/components/KindBadge'
import { EmptyState, ErrorState, PageSkeleton, Panel, Section } from '@/components/page'
import { InsightIcon } from '@/features/insights/InsightCard'
import { useInsightText } from '@/features/insights/insight-text'
import { useMetricFormatter } from '@/features/analytics/use-metric-format'
import { useFitnessData } from '@/hooks/use-fitness-data'
import { formatDay, formatNumber } from '@/lib/format'
import { METRIC_STYLE } from '@/lib/metric-style'

function EvidenceBlock({ evidence }: { evidence: InsightEvidence }) {
  const { t } = useTranslation()
  const format = useMetricFormatter()
  const { color } = METRIC_STYLE[evidence.metric]
  const measured = evidence.points.filter((p) => p.value !== null).length
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium">
          {t(`metrics.${evidence.metric}.label`)} <span className="font-normal text-muted-foreground">· {t(`insights.evidenceRoles.${evidence.role}`)}</span>
        </p>
        <p className="text-xs text-muted-foreground tabular">
          {formatDay(evidence.from, 'short')} – {formatDay(evidence.to, 'short')} · {t('insights.measurements', { count: measured })}
        </p>
      </div>
      {evidence.points.length > 2 && (
        <TrendChart data={evidence.points.map((p) => ({ date: p.date, value: p.value }))} color={color} variant="line" format={(v) => format(evidence.metric, v).full} height={160} />
      )}
      {evidence.points.length <= 2 && (
        <p className="text-lg font-semibold tabular">{evidence.points.map((p) => format(evidence.metric, p.value).full).join(' · ')}</p>
      )}
    </div>
  )
}

export default function InsightDetailPage() {
  const { id } = useParams()
  const { t } = useTranslation()
  const data = useFitnessData()
  const describe = useInsightText()
  const format = useMetricFormatter()

  if (data.isLoading) return <PageSkeleton />
  if (data.isError) return <ErrorState error={data.error} />
  const insight = data.insights.find((i) => i.id === decodeURIComponent(id ?? ''))
  const back = (
    <Link to="/insights" className="-ml-1 mt-2 inline-flex min-h-9 items-center gap-0.5 text-sm font-medium text-primary">
      <ChevronLeft className="size-4" aria-hidden />
      {t('insights.title')}
    </Link>
  )
  if (!insight) {
    return (
      <>
        {back}
        <EmptyState title={t('insights.notFound')} description={t('insights.notFoundDescription')} />
      </>
    )
  }

  const text = describe(insight)
  const formula = FORMULAS[insight.formula]
  const x = insight.evidence.find((e) => e.role === 'x')
  const y = insight.evidence.find((e) => e.role === 'y')
  const scatter = x && y ? x.points.map((p, i) => ({ x: p.value ?? 0, y: y.points[i]?.value ?? 0, date: p.date })) : null
  const rest = insight.evidence.filter((e) => e.role !== 'x' && e.role !== 'y')

  return (
    <div className="space-y-6">
      <div>
        {back}
        <div className="mt-3 flex items-start gap-3">
          <InsightIcon insight={insight} className="size-11" />
          <div className="min-w-0">
            <h1 className="text-xl leading-snug font-semibold">{text.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{formatDay(insight.date, 'long')}</p>
          </div>
        </div>
      </div>

      <Panel className="space-y-3">
        <p>{text.body}</p>
        {text.caution && <p className="rounded-xl bg-muted px-3 py-2.5 text-sm text-muted-foreground">{text.caution}</p>}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <ConfidenceBadge confidence={insight.confidence} />
          <KindBadge kind={formula.kind} />
        </div>
        {insight.activityId && (
          <Link to={`/activities/${insight.activityId}`} className="inline-block text-sm font-medium text-primary">
            {t('insights.openActivity')}
          </Link>
        )}
      </Panel>

      {(rest.length > 0 || scatter) && (
        <Section title={t('insights.evidence')}>
          <Panel className="space-y-5">
            <p className="text-sm text-muted-foreground">{t('insights.evidenceIntro')}</p>
            {rest.map((e, i) => (
              <EvidenceBlock key={`${e.metric}-${e.role}-${i}`} evidence={e} />
            ))}
            {scatter && x && y && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('insights.pairs', { count: scatter.length })}</p>
                <RelationChart
                  points={scatter}
                  color="var(--m-load)"
                  xLabel={t(`metrics.${x.metric}.label`)}
                  yLabel={t(`metrics.${y.metric}.label`)}
                  formatX={(v) => format(x.metric, v).full}
                  formatY={(v) => format(y.metric, v).full}
                />
              </div>
            )}
          </Panel>
        </Section>
      )}

      <Section title={t('insights.method')}>
        <Panel className="space-y-3 text-sm">
          <p className="font-medium">{t(`methods.${formula.id}.name`)}</p>
          <p className="text-muted-foreground">{t(`methods.${formula.id}.description`)}</p>
          <code className="block overflow-x-auto rounded-xl bg-muted px-3 py-2.5 text-xs leading-relaxed whitespace-pre-wrap">{formula.formula}</code>
          {Object.keys(insight.params).length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs tabular">
              {Object.entries(insight.params).map(([key, value]) => (
                <div key={key} className="contents">
                  <dt className="text-muted-foreground">{key}</dt>
                  <dd>{typeof value === 'number' ? formatNumber(value, Number.isInteger(value) ? 0 : 2) : String(value)}</dd>
                </div>
              ))}
            </dl>
          )}
          <Link to="/insights/methods" className="inline-block font-medium text-primary">{t('insights.allMethods')}</Link>
        </Panel>
      </Section>
      {insight.metric && <p className="px-1 text-xs text-muted-foreground">{t('insights.metricKind', { metric: t(`metrics.${insight.metric}.label`), kind: t(`kind.${METRICS[insight.metric].kind}`) })}</p>}
    </div>
  )
}
