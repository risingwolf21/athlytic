import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type RangePreset = '7d' | '30d' | '90d' | '1y'
export type Period = 'day' | 'week' | 'month' | 'year'

interface UiState {
  /** Window used by the Analytics and Recovery pages. */
  range: RangePreset
  period: Period
  setRange: (range: RangePreset) => void
  setPeriod: (period: Period) => void
}

export const RANGE_DAYS: Record<RangePreset, number> = { '7d': 7, '30d': 30, '90d': 90, '1y': 365 }

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      range: '30d',
      period: 'day',
      setRange: (range) => set({ range }),
      setPeriod: (period) => set({ period }),
    }),
    { name: 'athlytic.ui' },
  ),
)
