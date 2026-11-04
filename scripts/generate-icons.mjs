// Generates PWA icons, the favicon and iOS splash screens from one vector design.
// Run with `npm run icons`; output is committed so builds do not depend on sharp.
import { mkdirSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

const BACKGROUND = '#0d0f0e'
const ACCENT = '#3fd8b4'
const ACCENT_DEEP = '#1f8f78'

/** The mark: an open ring (recovery gauge) with a heartbeat line through it. `scale` shrinks it for the maskable safe zone. */
const mark = (size, scale = 1) => {
  const c = size / 2
  const r = size * 0.3 * scale
  const stroke = size * 0.07 * scale
  const arc = (from, to) => {
    const point = (deg) => [c + r * Math.cos((deg * Math.PI) / 180), c + r * Math.sin((deg * Math.PI) / 180)]
    const [x1, y1] = point(from)
    const [x2, y2] = point(to)
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
  }
  const w = r * 1.05
  const pulse = [
    [c - w, c],
    [c - w * 0.45, c],
    [c - w * 0.2, c - r * 0.55],
    [c + w * 0.05, c + r * 0.5],
    [c + w * 0.3, c],
    [c + w, c],
  ]
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(' ')
  return `
    <g transform="translate(0 ${(size * 0.06 * scale).toFixed(1)})">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="${ACCENT}"/><stop offset="1" stop-color="${ACCENT_DEEP}"/>
      </linearGradient>
    </defs>
    <path d="${arc(-210, 30)}" fill="none" stroke="url(#g)" stroke-width="${stroke}" stroke-linecap="round"/>
    <path d="${pulse}" fill="none" stroke="${ACCENT}" stroke-width="${stroke * 0.6}" stroke-linecap="round" stroke-linejoin="round"/>
    </g>`
}

const iconSvg = (size, { maskable = false, rounded = false } = {}) => `
  <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" ${rounded ? `rx="${size * 0.22}"` : ''} fill="${BACKGROUND}"/>
    ${mark(size, maskable ? 0.78 : 1)}
  </svg>`

const splashSvg = (width, height) => {
  const size = Math.min(width, height) * 0.28
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${BACKGROUND}"/>
    <g transform="translate(${(width - size) / 2} ${(height - size) / 2 - height * 0.03})">${mark(size)}</g>
  </svg>`
}

// Portrait iPhone/iPad sizes in device pixels: [width, height, css width, css height, pixel ratio].
export const SPLASH_SCREENS = [
  [1320, 2868, 440, 956, 3], // 16 Pro Max
  [1206, 2622, 402, 874, 3], // 16 Pro
  [1290, 2796, 430, 932, 3], // 15 Pro Max / 15 Plus / 14 Pro Max
  [1179, 2556, 393, 852, 3], // 15 Pro / 15 / 14 Pro
  [1284, 2778, 428, 926, 3], // 14 Plus / 13 Pro Max
  [1170, 2532, 390, 844, 3], // 14 / 13 / 12
  [1125, 2436, 375, 812, 3], // X / XS / 11 Pro
  [828, 1792, 414, 896, 2], // XR / 11
  [750, 1334, 375, 667, 2], // SE
  [1668, 2388, 834, 1194, 2], // iPad Pro 11
  [2048, 2732, 1024, 1366, 2], // iPad Pro 12.9
]

const out = 'public/icons'
mkdirSync(out, { recursive: true })
const png = (svg, file, size) => sharp(Buffer.from(svg)).resize(size ?? undefined).png({ compressionLevel: 9 }).toFile(`${out}/${file}`)

await Promise.all([
  png(iconSvg(512), 'icon-512.png'),
  png(iconSvg(192), 'icon-192.png'),
  png(iconSvg(512, { maskable: true }), 'maskable-512.png'),
  png(iconSvg(180), 'apple-touch-icon.png'),
  ...SPLASH_SCREENS.map(([w, h]) => sharp(Buffer.from(splashSvg(w, h))).png({ compressionLevel: 9 }).toFile(`${out}/splash-${w}x${h}.png`)),
])

writeFileSync('public/favicon.svg', iconSvg(64, { rounded: true }).trim())

// Link tags for index.html, printed so they can be pasted when the device list changes.
const links = SPLASH_SCREENS.map(
  ([w, h, cw, ch, ratio]) =>
    `<link rel="apple-touch-startup-image" media="(device-width: ${cw}px) and (device-height: ${ch}px) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: portrait)" href="%BASE_URL%icons/splash-${w}x${h}.png" />`,
)
console.log(links.join("\n"))
console.log(`Wrote icons and ${SPLASH_SCREENS.length} splash screens to ${out}`)
