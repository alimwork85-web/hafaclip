/**
 * The app's icon, drawn in code so the tray icon and the EXE icon share one design:
 * a white handle (the screen edge) and a white card on a flat teal rounded square.
 * Pure (no Electron), so build scripts can use it too.
 */
const inRoundRect = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}
// x, y, width, height, corner radius on the 256-unit grid.
const box = (x, y, [x0, y0, w, h, r]) => inRoundRect(x, y, x0, y0, x0 + w, y0 + h, r)

// Shapes on a 256-unit grid; `paused` greys the background out; at 16px the card's two lines are dropped.
function colorAt(x, y, paused, lines) {
  if (!box(x, y, [0, 0, 256, 256, 56])) return null
  const white = [255, 255, 255]
  const bg = paused ? [120, 124, 138] : [0x0f, 0x76, 0x6e]
  if (box(x, y, [44, 56, 28, 144, 14])) return white // handle
  if (box(x, y, [92, 68, 120, 120, 22])) {
    if (lines && (box(x, y, [114, 100, 76, 14, 7]) || box(x, y, [114, 126, 52, 14, 7]))) return bg
    return white // card
  }
  return bg
}

/** Premultiplied BGRA pixels (what Windows and nativeImage.createFromBitmap expect), 4x4 supersampled. */
export function drawIcon(size, paused = false) {
  const bgra = Buffer.alloc(size * size * 4)
  const step = 256 / size
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < 4; sy++) {
        for (let sx = 0; sx < 4; sx++) {
          const c = colorAt((px + (sx + 0.5) / 4) * step, (py + (sy + 0.5) / 4) * step, paused, size > 16)
          if (c) [r, g, b, a] = [r + c[0], g + c[1], b + c[2], a + 1]
        }
      }
      if (!a) continue
      const o = (py * size + px) * 4
      bgra[o] = Math.round(b / 16)
      bgra[o + 1] = Math.round(g / 16)
      bgra[o + 2] = Math.round(r / 16)
      bgra[o + 3] = Math.round((a / 16) * 255)
    }
  }
  return bgra
}
