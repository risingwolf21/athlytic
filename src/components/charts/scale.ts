/** Round tick values (1, 2, 5 × 10ⁿ); the domain is widened to the outer ticks so grid lines and labels always coincide. */
export function niceScale(min: number, max: number, target: number, fixedMin?: number, fixedMax?: number): { ticks: number[]; domain: [number, number] } {
  const rough = (max - min) / target
  if (!(rough > 0)) return { ticks: [min], domain: [min - 1, max + 1] }
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const residual = rough / magnitude
  const step = (residual < 1.5 ? 1 : residual < 3 ? 2 : residual < 7 ? 5 : 10) * magnitude
  const lo = fixedMin ?? Math.floor(min / step + 1e-9) * step
  const hi = fixedMax ?? Math.ceil(max / step - 1e-9) * step
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) ticks.push(Math.round(v / step) * step + 0)
  return { ticks, domain: [lo, hi] }
}
