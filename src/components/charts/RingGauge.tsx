import type { ReactNode } from 'react'
import { motion } from 'motion/react'

interface RingGaugeProps {
  /** 0–100, or null when there is no value. */
  value: number | null
  color: string
  size?: number
  strokeWidth?: number
  children?: ReactNode
  label?: string
}

/** Circular progress with an animated sweep; the centre is free for the value. */
export function RingGauge({ value, color, size = 132, strokeWidth = 11, children, label }: RingGaugeProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const fraction = value === null ? 0 : Math.max(0, Math.min(1, value / 100))

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--muted)" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - fraction) }}
          transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}
