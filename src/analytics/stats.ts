/** Small, dependency-free statistics helpers. All functions ignore `null`/`NaN` entries. */

export const isNum = (v: number | null | undefined): v is number => typeof v === 'number' && Number.isFinite(v)

export function clean(values: readonly (number | null | undefined)[]): number[] {
  return values.filter(isNum)
}

export function sum(values: readonly (number | null | undefined)[]): number {
  return clean(values).reduce((a, b) => a + b, 0)
}

export function mean(values: readonly (number | null | undefined)[]): number | null {
  const v = clean(values)
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

export function median(values: readonly (number | null | undefined)[]): number | null {
  const v = clean(values).sort((a, b) => a - b)
  if (!v.length) return null
  const mid = Math.floor(v.length / 2)
  return v.length % 2 ? (v[mid] as number) : ((v[mid - 1] as number) + (v[mid] as number)) / 2
}

/** Median absolute deviation. */
export function mad(values: readonly (number | null | undefined)[]): number | null {
  const m = median(values)
  if (m === null) return null
  return median(clean(values).map((x) => Math.abs(x - m)))
}

/** Sample standard deviation (n-1). */
export function stdev(values: readonly (number | null | undefined)[]): number | null {
  const v = clean(values)
  if (v.length < 2) return null
  const m = v.reduce((a, b) => a + b, 0) / v.length
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1))
}

export function percentile(values: readonly (number | null | undefined)[], p: number): number | null {
  const v = clean(values).sort((a, b) => a - b)
  if (!v.length) return null
  const pos = (v.length - 1) * p
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return (v[lo] as number) + ((v[hi] as number) - (v[lo] as number)) * (pos - lo)
}

export function min(values: readonly (number | null | undefined)[]): number | null {
  const v = clean(values)
  return v.length ? Math.min(...v) : null
}

export function max(values: readonly (number | null | undefined)[]): number | null {
  const v = clean(values)
  return v.length ? Math.max(...v) : null
}

/** Ordinary least squares slope of y over x = 0..n-1 (units of y per step). */
export function slope(values: readonly (number | null)[]): number | null {
  const pts = values.flatMap((y, x) => (isNum(y) ? [[x, y] as const] : []))
  if (pts.length < 3) return null
  const mx = pts.reduce((a, [x]) => a + x, 0) / pts.length
  const my = pts.reduce((a, [, y]) => a + y, 0) / pts.length
  const num = pts.reduce((a, [x, y]) => a + (x - mx) * (y - my), 0)
  const den = pts.reduce((a, [x]) => a + (x - mx) ** 2, 0)
  return den === 0 ? null : num / den
}

export function pearson(xs: readonly number[], ys: readonly number[]): number | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 3) return null
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const a = (xs[i] as number) - mx
    const b = (ys[i] as number) - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  const den = Math.sqrt(dx * dy)
  return den === 0 ? null : num / den
}

/** Average ranks (ties share the mean rank). */
export function ranks(values: readonly number[]): number[] {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
  const out = new Array<number>(values.length)
  for (let i = 0; i < order.length; ) {
    let j = i
    while (j + 1 < order.length && (order[j + 1] as readonly [number, number])[0] === (order[i] as readonly [number, number])[0]) j++
    const rank = (i + j) / 2 + 1
    for (let k = i; k <= j; k++) out[(order[k] as readonly [number, number])[1]] = rank
    i = j + 1
  }
  return out
}

/** Spearman rank correlation: robust against outliers and non-linear monotonic relations. */
export function spearman(xs: readonly number[], ys: readonly number[]): number | null {
  return pearson(ranks(xs), ranks(ys))
}

function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z))
  const d = 0.3989423 * Math.exp((-z * z) / 2)
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))))
  return z > 0 ? 1 - p : p
}

/** Two-sided p-value for a correlation via the Fisher z transform (normal approximation, n > 3). */
export function correlationPValue(r: number, n: number): number | null {
  if (n <= 3 || Math.abs(r) >= 1) return null
  const z = Math.atanh(r) * Math.sqrt(n - 3)
  return 2 * (1 - normalCdf(Math.abs(z)))
}

/** Exponentially weighted moving average with time constant `tau` days. */
export function ewma(values: readonly number[], tau: number, seed = 0): number[] {
  const k = 1 - Math.exp(-1 / tau)
  const out: number[] = []
  let prev = seed
  for (const v of values) {
    prev += (v - prev) * k
    out.push(prev)
  }
  return out
}
