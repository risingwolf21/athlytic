import { useId } from 'react'
import { motion } from 'motion/react'

interface SparklineProps {
  values: (number | null)[]
  color: string
  height?: number
  className?: string
}

/** Tiny dependency-free trend line for metric cards. Gaps (null) break the line instead of being interpolated, unless most values are missing (e.g. weigh-ins), where the points are joined. */
export function Sparkline({ values, color, height = 36, className }: SparklineProps) {
  const id = useId()
  const nums = values.filter((v): v is number => v !== null)
  if (nums.length < 2) return <div style={{ height }} className={className} aria-hidden />

  const width = 120
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const span = max - min || 1
  const pad = 3
  const x = (i: number) => (i / (values.length - 1)) * width
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2)

  const sparse = nums.length < values.length / 2
  const segments: string[][] = []
  let current: string[] = []
  values.forEach((v, i) => {
    if (v === null) {
      if (sparse) return
      if (current.length) segments.push(current)
      current = []
    } else current.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`)
  })
  if (current.length) segments.push(current)

  const last = values.length - 1
  const lastValue = values[last]
  const lastSegment = segments[segments.length - 1] ?? []
  const area = lastSegment.length > 1 ? `M${lastSegment.join(' L')} L${lastSegment[lastSegment.length - 1]?.split(',')[0]},${height} L${lastSegment[0]?.split(',')[0]},${height} Z` : null

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className={className} style={{ height, width: '100%', overflow: 'visible' }} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {area && <path d={area} fill={`url(#${id})`} />}
      {segments.map((segment, i) => (
        <motion.path
          key={i}
          d={`M${segment.join(' L')}`}
          fill="none"
          stroke={color}
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      ))}
      {lastValue !== null && lastValue !== undefined && <circle cx={x(last)} cy={y(lastValue)} r={2.6} fill={color} vectorEffect="non-scaling-stroke" />}
    </svg>
  )
}
