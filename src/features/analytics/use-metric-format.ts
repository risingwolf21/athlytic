import { useTranslation } from 'react-i18next'
import { METRICS, type MetricKey } from '@/analytics'
import { formatHours, formatMetricValue } from '@/lib/format'

/** Display text and unit for a metric value; sleep is shown as h:mm, everything else with the metric's decimals. */
export function useMetricFormatter() {
  const { t } = useTranslation()
  return (metric: MetricKey, value: number | null | undefined) => {
    const text = metric === 'sleepHours' ? formatHours(value) : formatMetricValue(metric, value)
    const unit = metric === 'sleepHours' ? '' : t(`units.${METRICS[metric].unit}`)
    return { text, unit, full: unit && value !== null && value !== undefined ? `${text} ${unit}` : text }
  }
}
