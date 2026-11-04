import { useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useId } from 'react'
import { niceScale } from './scale'
import { formatClock } from '@/lib/format'

interface IntradayChartProps {
  /** [epoch seconds, value] */
  points: [number, number][]
  color: string
  unit: string
  height?: number
  domain?: [number, number]
}

const clock = (epochSeconds: number) => formatClock(new Date(epochSeconds * 1000).toISOString())

interface TooltipProps {
  active?: boolean
  payload?: readonly { payload: { t: number; v: number } }[]
  unit: string
  color: string
}

function IntradayTooltip({ active, payload, unit, color }: TooltipProps) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="surface pointer-events-none rounded-xl px-3 py-2 text-xs shadow-lg">
      <div className="text-muted-foreground tabular">{clock(p.t)}</div>
      <div className="font-semibold tabular" style={{ color }}>
        {Math.round(p.v)} {unit}
      </div>
    </div>
  )
}

/** Value over the course of one day (heart rate, stress, Body Battery). */
export function IntradayChart({ points, color, unit, height = 160, domain }: IntradayChartProps) {
  const gradientId = useId()
  const data = useMemo(() => points.map(([t, v]) => ({ t, v })), [points])
  if (!data.length) return null
  const values = data.map((d) => d.v)
  const { ticks, domain: niceDomain } = niceScale(domain?.[0] ?? Math.min(...values), domain?.[1] ?? Math.max(...values), 4, domain?.[0], domain?.[1])
  const axisWidth = Math.max(...ticks.map((v) => String(v).length), 2) * 6.6 + 10
  return (
    <div style={{ height }} className="w-full select-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" horizontalValues={ticks} />
          <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={clock} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} minTickGap={40} />
          <YAxis domain={niceDomain} ticks={ticks} interval={0} tickLine={false} axisLine={false} width={axisWidth} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
          <Tooltip cursor={{ stroke: 'var(--muted-foreground)', strokeOpacity: 0.4 }} content={(props) => <IntradayTooltip {...(props as unknown as TooltipProps)} unit={unit} color={color} />} />
          <Area dataKey="v" type="monotone" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 4, fill: color, stroke: 'var(--card)', strokeWidth: 2 }} animationDuration={800} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
