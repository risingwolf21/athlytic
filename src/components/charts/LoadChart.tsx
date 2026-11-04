import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDay, formatNumber } from '@/lib/format'

export interface LoadPoint {
  date: string
  load: number
  acute: number
  chronic: number
}

interface LoadChartProps {
  data: LoadPoint[]
  labels: { load: string; acute: string; chronic: string }
  height?: number
}

interface TooltipProps {
  active?: boolean
  payload?: readonly { payload: LoadPoint }[]
  labels: LoadChartProps['labels']
}

function LoadTooltip({ active, payload, labels }: TooltipProps) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="surface pointer-events-none rounded-xl px-3 py-2 text-xs shadow-lg">
      <div className="text-muted-foreground">{formatDay(p.date, 'medium')}</div>
      <div className="mt-1 space-y-0.5 tabular">
        <div className="flex items-center gap-2"><span className="size-2 rounded-sm bg-m-load/40" />{labels.load}: <b>{formatNumber(p.load)}</b></div>
        <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-m-hr" />{labels.acute}: <b>{formatNumber(p.acute)}</b></div>
        <div className="flex items-center gap-2"><span className="size-2 rounded-full bg-m-load" />{labels.chronic}: <b>{formatNumber(p.chronic)}</b></div>
      </div>
    </div>
  )
}

/** Daily training load as bars with the acute (7 d) and chronic (42 d) averages as lines. */
export function LoadChart({ data, labels, height = 220 }: LoadChartProps) {
  return (
    <div style={{ height }} className="w-full select-none">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis dataKey="date" tickFormatter={(d: string) => formatDay(d, 'short')} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} interval="preserveStartEnd" minTickGap={28} />
          <YAxis tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickCount={4} />
          <Tooltip cursor={{ fill: 'var(--muted)', fillOpacity: 0.5 }} content={(props) => <LoadTooltip {...(props as unknown as TooltipProps)} labels={labels} />} />
          <Bar dataKey="load" fill="var(--m-load)" fillOpacity={0.35} radius={[4, 4, 1, 1]} maxBarSize={14} animationDuration={800} />
          <Line dataKey="acute" type="monotone" stroke="var(--m-hr)" strokeWidth={2} dot={false} animationDuration={900} />
          <Line dataKey="chronic" type="monotone" stroke="var(--m-load)" strokeWidth={2.25} dot={false} animationDuration={900} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
