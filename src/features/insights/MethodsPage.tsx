import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { FORMULAS, METRICS } from '@/analytics'
import { KindBadge } from '@/components/KindBadge'
import { PageHeader, Panel } from '@/components/page'

/** Every calculated number in the app is documented here; the text comes from the same registry the analytics module uses. */
export default function MethodsPage() {
  const { t } = useTranslation()
  return (
    <div className="space-y-5">
      <Link to="/insights" className="-ml-1 mt-2 inline-flex min-h-9 items-center gap-0.5 text-sm font-medium text-primary">
        <ChevronLeft className="size-4" aria-hidden />
        {t('insights.title')}
      </Link>
      <PageHeader title={t('methods.title')} subtitle={t('methods.subtitle')} className="pt-0" />
      {Object.values(FORMULAS).map((formula) => (
        <Panel key={formula.id} className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">{t(`methods.${formula.id}.name`)}</h2>
            <KindBadge kind={formula.kind} />
          </div>
          <p className="text-muted-foreground">{t(`methods.${formula.id}.description`)}</p>
          <code className="block overflow-x-auto rounded-xl bg-muted px-3 py-2.5 text-xs leading-relaxed whitespace-pre-wrap">{formula.formula}</code>
          <p className="text-xs text-muted-foreground">{t(`methods.${formula.id}.limits`)}</p>
          <p className="text-xs text-muted-foreground">
            {t('methods.usedFor')}: {formula.inputs.map((key) => t(`metrics.${key}.label`)).join(', ')}
          </p>
        </Panel>
      ))}
      <Panel className="space-y-1.5 text-sm">
        <h2 className="text-base font-semibold">{t('methods.measuredVsCalculated')}</h2>
        <p className="text-muted-foreground">{t('methods.measuredVsCalculatedBody')}</p>
        <p className="text-xs text-muted-foreground">{t('methods.metricCount', { measured: Object.values(METRICS).filter((m) => m.kind === 'measured').length, calculated: Object.values(METRICS).filter((m) => m.kind === 'calculated').length })}</p>
      </Panel>
    </div>
  )
}
