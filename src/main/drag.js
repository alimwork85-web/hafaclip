/** Native drag-out of history items, plus turning dropped files into history items. */
import { app, nativeImage } from 'electron'
import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const tempDir = () => join(app.getPath('userData'), 'temp')

/** Drag copies from earlier sessions are no longer needed once the app restarts. */
export function cleanTemp() {
  rmSync(tempDir(), { recursive: true, force: true })
  mkdirSync(tempDir(), { recursive: true })
}

// Windows refuses a drag without an image, so files get a small accent-coloured tile.
function genericIcon() {
  const size = 32
  const bgra = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) bgra.writeUInt32LE(0xff_ff8c7c, i * 4) // #7c8cff
  return nativeImage.createFromBitmap(bgra, { width: size, height: size })
}

/** Files to hand to webContents.startDrag for an item, or null when nothing can be dragged. */
export function dragPayload(item, imagesDir) {
  if (item.kind === 'files') {
    const files = item.files.filter((f) => existsSync(f))
    return files.length ? { files, icon: genericIcon() } : null
  }
  if (item.kind === 'image') {
    const src = join(imagesDir, item.image)
    if (!existsSync(src)) return null
    // Hand out a copy with a readable name, so a "move" by the target never takes our stored file.
    const d = new Date(item.createdAt)
    const pad = (n) => String(n).padStart(2, '0')
    const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
    const dest = join(tempDir(), `Clipboard image ${stamp}.png`)
    copyFileSync(src, dest)
    return { files: [dest], icon: nativeImage.createFromPath(src).resize({ height: 64 }) }
  }
  return null
}

/** A history item for files dropped onto the panel; only real, existing paths are kept. */
export function itemFromDroppedPaths(paths) {
  if (!Array.isArray(paths)) return null
  // Our own drag copies live in tempDir and are deleted on restart, so they must not become history.
  const files = paths.filter((p) => typeof p === 'string' && p && !p.startsWith(tempDir()) && existsSync(p))
  return files.length ? { id: randomUUID(), createdAt: Date.now(), pinned: false, kind: 'files', files } : null
}
