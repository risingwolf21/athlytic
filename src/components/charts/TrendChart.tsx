import { useId, useMemo } from 'react'
import { Area, Bar, CartesianGrid, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Granularity } from '@/analytics'
import { formatDay } from '@/lib/format'

export interface TrendPoint {
  /** First day of the bucket (YYYY-MM-DD). */
  date: string
  value: number | null
  /** Share of days in the bucket that have data; low values are flagged in the tooltip. */
  coverage?: number
}

interface TrendChartProps {
  data: TrendPoint[]
  granularity?: Granularity
  color: string
  variant?: 'area' | 'line' | 'bar'
  format: (value: number) => string
  /** Shorter label for axis ticks; defaults to `format`. */
  formatTick?: (value: number) => string
  height?: number
  /** Normal range from the personal baseline. */
  band?: { low: number; high: number; median: number } | null
  bandLabel?: string
  /** Values of the previous period, aligned by index with `data`. */
  compare?: (number | null)[]
  compareLabel?: string
  lowCoverageLabel?: string
  showYAxis?: boolean
}

function xTick(date: string, granularity: Granularity): string {
  switch (granularity) {
    case 'day':
      return formatDay(date, 'short')
    case 'week':
      return formatDay(date, 'short')
    case 'month':
      return formatDay(date, 'monthShort')
    case 'year':
      return formatDay(date, 'year')
  }
}

/** Round tick values (1, 2, 5 × 10ⁿ) inside the domain, so axes read 40, 50, 60 instead of 34, 54, 74. */
function niceTicks(min: number, max: number, target: number): number[] {
  const rough = (max - min) / target
  if (!(rough > 0)) return [min]
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const residual = rough / magnitude
  const step = (residual < 1.5 ? 1 : residual < 3 ? 2 : residual < 7 ? 5 : 10) * magnitude
  const ticks: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(Math.round(v / step) * step)
  return ticks
}

interface Row {
  date: string
  v: number | null
  c: number | null
  coverage: number
}

interface TooltipProps {
  active?: boolean
  payload?: readonly { payload: Row }[]
  format: (value: number) => string
  granularity: Granularity
  color: string
  compareLabel?: string
  lowCoverageLabel?: string
}

function ChartTooltip({ active, payload, format, granularity, color, compareLabel, lowCoverageLabel }: TooltipProps) {
  const row = payload?.[0]?.payload
  if (!active || !row) return null
  return (
    <div className="surface pointer-events-none rounded-xl px-3 py-2 text-xs shadow-lg">
      <div className="text-muted-foreground">{granularity === 'year' ? formatDay(row.date, 'year') : granularity === 'month' ? formatDay(row.date, 'month') : formatDay(row.date, 'medium')}</div>
      <div className="mt-0.5 text-base font-semibold tabular" style={{ color }}>
        {row.v === null ? '–' : format(row.v)}
      </div>
      {row.c !== null && compareLabel && (
        <div className="text-muted-foreground tabular">
          {compareLabel}: {format(row.c)}
        </div>
      )}
      {row.coverage < 0.6 && row.v !== null && lowCoverageLabel && <div className="mt-1 text-attention">{lowCoverageLabel}</div>}
    </div>
  )
}

/** Interactive time-series chart (touch + hover tooltip) with optional baseline band and previous-period overlay. */
export function TrendChart({ data, granularity = 'day', color, variant = 'area', format, formatTick, height = 220, band, bandLabel, compare, compareLabel, lowCoverageLabel, showYAxis = true }: TrendChartProps) {
  const gradientId = useId()
  const rows = useMemo<Row[]>(() => data.map((p, i) => ({ date: p.date, v: p.value, c: compare?.[i] ?? null, coverage: p.coverage ?? 1 })), [data, compare])

  const values = rows.flatMap((r) => [r.v, r.c]).filter((v): v is number => v !== null)
  const lows = band ? [...values, band.low] : values
  const highs = band ? [...values, band.high] : values
  const rawMin = lows.length ? Math.min(...lows) : 0
  const rawMax = highs.length ? Math.max(...highs) : 1
  const pad = (rawMax - rawMin || 1) * 0.12
  const domain: [number, number] = variant === 'bar' ? [0, rawMax * 1.1 || 1] : [Math.max(0, rawMin - pad), rawMax + pad]

  return (
    <div style={{ height }} className="w-full select-none">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: showYAxis ? -12 : 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 4" />
          <XAxis dataKey="date" tickFormatter={(d: string) => xTick(d, granularity)} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} interval="preserveStartEnd" minTickGap={28} />
          <YAxis hide={!showYAxis} domain={domain} tickLine={false} axisLine={false} width={44} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} ticks={niceTicks(domain[0], domain[1], 4)} tickFormatter={(v: number) => (formatTick ?? format)(v)} />
          {band && <ReferenceArea y1={band.low} y2={band.high} fill={color} fillOpacity={0.1} stroke="none" ifOverflow="extendDomain" label={bandLabel ? { value: bandLabel, position: 'insideTopLeft', fontSize: 10, fill: 'var(--muted-foreground)' } : undefined} />}
          {band && <ReferenceLine y={band.median} stroke={color} strokeOpacity={0.35} strokeDasharray="4 4" />}
          <Tooltip cursor={{ stroke: 'var(--muted-foreground)', strokeOpacity: 0.4, strokeDasharray: '3 3' }} content={(props) => <ChartTooltip {...(props as unknown as TooltipProps)} format={format} granularity={granularity} color={color} {...(compareLabel ? { compareLabel } : {})} {...(lowCoverageLabel ? { lowCoverageLabel } : {})} />} />
          {compare && <Line dataKey="c" type="monotone" stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />}
          {variant === 'bar' ? (
            <Bar dataKey="v" fill={color} radius={[5, 5, 2, 2]} maxBarSize={22} animationDuration={800} />
          ) : variant === 'area' ? (
            <Area dataKey="v" type="monotone" stroke={color} strokeWidth={2.25} fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)', fill: color }} animationDuration={900} />
          ) : (
            <Line dataKey="v" type="monotone" stroke={color} strokeWidth={2.25} dot={rows.length <= 14 ? { r: 3, fill: color, strokeWidth: 0 } : false} activeDot={{ r: 5, strokeWidth: 2, stroke: 'var(--card)', fill: color }} animationDuration={900} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}
