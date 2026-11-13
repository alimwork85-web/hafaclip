/** Windows accent colour, adjusted per theme so text on it (and it as text) stays readable. */

const channels = (hex) => [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16))
const toHex = (rgb) => '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')

function luminance(rgb) {
  const [r, g, b] = rgb.map((c) => {
    c /= 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Mixes `rgb` toward `target` in small steps until `text` on it reaches 4.5:1. */
function adjust(rgb, target, text) {
  for (let t = 0; t <= 1; t += 0.02) {
    const mixed = rgb.map((c, i) => c + (target[i] - c) * t)
    if (contrast(mixed, text) >= 4.5) return toHex(mixed)
  }
  return toHex(target)
}

const WHITE = [255, 255, 255]
const BLACK = [0, 0, 0]
const DARK_TEXT = channels('16181f') // --on-accent in the dark theme

/** 'RRGGBB' or 'RRGGBBAA' (Electron's getAccentColor) → shades for the light theme (white text) and the dark theme (dark text). */
export function accentShades(hex) {
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex ?? '')) return null
  const rgb = channels(hex)
  return { light: adjust(rgb, BLACK, WHITE), dark: adjust(rgb, WHITE, DARK_TEXT) }
}
