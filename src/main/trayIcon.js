/** Tray icon drawn in code: a purple rounded square holding a white clipboard. */
import { nativeImage } from 'electron'

const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}

// Shapes on a 64-unit grid; `paused` greys the background out.
function colorAt(x, y, paused) {
  if (!inRoundRect(x, y, 2, 2, 62, 62, 14)) return null
  const white = [255, 255, 255]
  const accent = paused ? [120, 124, 138] : [124 + (52 * (x + y)) / 128, 140 - (16 * (x + y)) / 128, 255]
  if (inRoundRect(x, y, 25, 10, 39, 20, 3)) return white // clip
  if (inRoundRect(x, y, 16, 15, 48, 54, 5)) {
    const line = (y0, w) => y >= y0 && y <= y0 + 3 && x >= 22 && x <= 22 + w
    return line(26, 20) || line(34, 16) || line(42, 18) ? accent : white
  }
  return accent
}

/** 32px icon with a 64px high-DPI representation, anti-aliased by 4x4 supersampling. */
export function makeTrayIcon(paused = false) {
  const image = nativeImage.createEmpty()
  for (const size of [32, 64]) {
    const bgra = Buffer.alloc(size * size * 4)
    const step = 64 / size
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        let r = 0, g = 0, b = 0, a = 0
        for (let sy = 0; sy < 4; sy++) {
          for (let sx = 0; sx < 4; sx++) {
            const c = colorAt((px + (sx + 0.5) / 4) * step, (py + (sy + 0.5) / 4) * step, paused)
            if (c) [r, g, b, a] = [r + c[0], g + c[1], b + c[2], a + 1]
          }
        }
        if (!a) continue
        const o = (py * size + px) * 4
        // Premultiplied BGRA, as Windows expects.
        bgra[o] = Math.round(b / 16)
        bgra[o + 1] = Math.round(g / 16)
        bgra[o + 2] = Math.round(r / 16)
        bgra[o + 3] = Math.round((a / 16) * 255)
      }
    }
    // addRepresentation only takes encoded images, so go through PNG.
    const png = nativeImage.createFromBitmap(bgra, { width: size, height: size }).toPNG()
    image.addRepresentation({ scaleFactor: size / 32, width: size, height: size, buffer: png })
  }
  return image
}
