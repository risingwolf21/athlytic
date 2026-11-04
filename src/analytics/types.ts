export type DateString = string

export interface DataPoint {
  date: DateString
  value: number | null
}

/** Chronologically sorted. Days without a measurement are either absent or have `value: null`. */
export type Series = DataPoint[]

export interface DateWindow {
  from: DateString
  to: DateString
}

export type Granularity = 'day' | 'week' | 'month' | 'year'

/** `measured` comes straight from a device; `calculated` is derived by Athlytic and is an estimate. */
export type ValueKind = 'measured' | 'calculated'

export type Polarity = 'higher-better' | 'lower-better' | 'neutral'
