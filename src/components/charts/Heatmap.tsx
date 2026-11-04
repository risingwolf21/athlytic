import { useMemo, useState } from 'react'
import { addDays, isoWeekday } from '@shared/dates.ts'
import { formatDay } from '@/lib/format'

interface HeatmapProps {
  /** One value per calendar day; missing days render as empty cells. */
  values: Map<string, number>
  endDate: string
  weeks?: number
  color: string
  format: (value: number) => string
  emptyLabel: string
}

/** Calendar heatmap (weeks as columns, Monday on top). Tap a cell to read its value. */
export function Heatmap({ values, endDate, weeks = 26, color, format, emptyLabel }: HeatmapProps) {
  const [selected, setSelected] = useState<string | null>(null)

  const { columns, max } = useMemo(() => {
    const lastMonday = addDays(endDate, -isoWeekday(endDate))
    const firstMonday = addDays(lastMonday, -7 * (weeks - 1))
    const cols = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(firstMonday, w * 7 + d)))
    const all = [...values.values()]
    return { columns: cols, max: all.length ? Math.max(...all) : 0 }
  }, [values, endDate, weeks])

  const selectedValue = selected ? values.get(selected) : undefined

  return (
    <div className="space-y-3">
      <div className="h-5 text-xs text-muted-foreground tabular">
        {selected && (
          <>
            {formatDay(selected, 'long')} · <span className="font-medium text-foreground">{selectedValue === undefined ? emptyLabel : format(selectedValue)}</span>
          </>
        )}
      </div>
      <div className="flex gap-[3px] overflow-hidden" role="grid">
        {columns.map((column, w) => (
          <div key={w} className="flex flex-1 flex-col gap-[3px]">
            {column.map((date) => {
              const v = date > endDate ? undefined : values.get(date)
              const intensity = v === undefined || max === 0 ? 0 : Math.max(0.18, v / max)
              return (
                <button
                  key={date}
                  type="button"
                  disabled={date > endDate}
                  onClick={() => setSelected(date)}
                  aria-label={`${formatDay(date, 'long')}: ${v === undefined ? emptyLabel : format(v)}`}
                  className="aspect-square w-full rounded-[3px] outline-offset-1 transition-transform active:scale-90 data-[selected=true]:outline-2 data-[selected=true]:outline-foreground/60"
                  data-selected={selected === date}
                  style={{ background: v === undefined || v === 0 ? 'var(--muted)' : `color-mix(in oklch, ${color} ${Math.round(intensity * 100)}%, transparent)`, opacity: date > endDate ? 0 : 1 }}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
