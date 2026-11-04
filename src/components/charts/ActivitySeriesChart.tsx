import { useId, useMemo } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ActivitySamples } from '@shared/domain.ts'
import { formatDuration, formatNumber, msToKmh } from '@/lib/format'

export type ActivitySeriesKey = 'elevation' | 'hr' | 'speed' | 'cadence'

interface ActivitySeriesChartProps {
  samples: ActivitySamples
  series: ActivitySeriesKey
  color: string
  unit: string
  height?: number
}

interface Row {
  x: number
  v: number
  t: number
}

const MAX_POINTS = 240

function toRows(samples: ActivitySamples, series: ActivitySeriesKey): { rows: Row[]; byDistance: boolean } {
  const values = samples[series]
  const hasDistance = samples.distance.some((d) => d !== null && d > 0)
  const step = Math.max(1, Math.ceil(samples.t.length / MAX_POINTS))
  const rows: Row[] = []
  for (let i = 0; i < samples.t.length; i += step) {
    const raw = values[i]
    if (raw === null || raw === undefined) continue
    const v = series === 'speed' ? msToKmh(raw) : raw
    const distance = samples.distance[i]
    rows.push({ x: hasDistance && distance != null ? distance / 1000 : (samples.t[i] as number) / 60, v, t: samples.t[i] as number })
  }
  return { rows, byDistance: hasDistance }
}

interface TooltipProps {
  active?: boolean
  payload?: readonly { payload: Row }[]
  unit: string
  color: string
  byDistance: boolean
}

function SeriesTooltip({ active, payload, unit, color, byDistance }: TooltipProps) {
  const p = payload?.[0]?.payload
  if (!active || !p) return null
  return (
    <div className="surface pointer-events-none rounded-xl px-3 py-2 text-xs shadow-lg">
      <div className="text-muted-foreground tabular">
        {byDistance ? `${formatNumber(p.x, 1)} km · ` : ''}
        {formatDuration(p.t)}
      </div>
      <div className="font-semibold tabular" style={{ color }}>
        {formatNumber(p.v, unit === 'km/h' ? 1 : 0)} {unit}
      </div>
    </div>
  )
}

/** One recorded channel (elevation, heart rate, speed, cadence) along the distance of an activity. */
export function ActivitySeriesChart({ samples, series, color, unit, height = 200 }: ActivitySeriesChartProps) {
  const gradientId = useId()
  const { rows, byDistance } = useMemo(() => toRows(samples, series), [samples, series])
  if (rows.length < 2) return null
  const values = rows.map((r) => r.v)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = (max - min || 1) * 0.1

  return (
    <div style={{ height }} className="w-full select-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -14 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={series === 'elevation' ? 0.4 : 0.22} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => `${formatNumber(v, byDistance ? 0 : 0)}${byDistance ? ' km' : ' min'}`} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} minTickGap={36} />
          <YAxis domain={[Math.floor(min - pad), Math.ceil(max + pad)]} tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} tickCount={4} />
          <Tooltip cursor={{ stroke: 'var(--muted-foreground)', strokeOpacity: 0.4 }} content={(props) => <SeriesTooltip {...(props as unknown as TooltipProps)} unit={unit} color={color} byDistance={byDistance} />} />
          <Area dataKey="v" type="monotone" stroke={color} strokeWidth={2} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 4, fill: color, stroke: 'var(--card)', strokeWidth: 2 }} animationDuration={800} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
