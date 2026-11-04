import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { formatDay } from '@/lib/format'

export interface ScatterPoint {
  x: number
  y: number
  /** Date of the x value. */
  date: string
}

interface RelationChartProps {
  points: ScatterPoint[]
  color: string
  xLabel: string
  yLabel: string
  formatX: (v: number) => string
  formatY: (v: number) => string
  height?: number
}

interface TooltipProps {
  active?: boolean
  payload?: readonly { payload: ScatterPoint }[]
  xLabel: string
  yLabel: string
  formatX: (v: number) => string
  formatY: (v: number) => string
}

function RelationTooltip({ active, payload, xLabel, yLabel, formatX, formatY }: TooltipProps) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="surface pointer-events-none rounded-xl px-3 py-2 text-xs shadow-lg">
      <div className="text-muted-foreground">{formatDay(p.date, 'medium')}</div>
      <div className="tabular">{xLabel}: <b>{formatX(p.x)}</b></div>
      <div className="tabular">{yLabel}: <b>{formatY(p.y)}</b></div>
    </div>
  )
}

/** Scatter plot of two metrics, one dot per day pair. */
export function RelationChart({ points, color, xLabel, yLabel, formatX, formatY, height = 240 }: RelationChartProps) {
  return (
    <div style={{ height }} className="w-full select-none">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 8, bottom: 16, left: -8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis type="number" dataKey="x" name={xLabel} domain={['auto', 'auto']} tickFormatter={formatX} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} label={{ value: xLabel, position: 'insideBottom', offset: -10, fontSize: 11, fill: 'var(--muted-foreground)' }} />
          <YAxis type="number" dataKey="y" name={yLabel} domain={['auto', 'auto']} tickFormatter={formatY} tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
          <ZAxis range={[36, 36]} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} content={(props) => <RelationTooltip {...(props as unknown as TooltipProps)} xLabel={xLabel} yLabel={yLabel} formatX={formatX} formatY={formatY} />} />
          <Scatter data={points} fill={color} fillOpacity={0.55} animationDuration={700} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}
