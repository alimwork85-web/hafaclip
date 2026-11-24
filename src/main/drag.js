/** Native drag-out of history items, plus turning dropped files into history items. */
import { app, nativeImage } from 'electron'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { isCleanable, stripMetadata } from './imageMeta'
import { randomUUID } from 'node:crypto'

export const tempDir = () => join(app.getPath('userData'), 'temp')

/** Drag copies from earlier sessions are no longer needed once the app restarts. */
export function cleanTemp() {
  rmSync(tempDir(), { recursive: true, force: true })
  mkdirSync(tempDir(), { recursive: true })
}

/** Temp path named after when the image was copied, e.g. "Clipboard image 2026-11-23 10-05-09.png". */
function imageCopyName(item, ext) {
  const d = new Date(item.createdAt)
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
  return join(tempDir(), `Clipboard image ${stamp}.${ext}`)
}

/** JPG has no transparency; see-through pixels go on white instead of turning black. */
function toJpeg(img) {
  const size = img.getSize()
  const px = img.toBitmap() // BGRA, premultiplied: adding the missing share of white is enough
  for (let i = 0; i < px.length; i += 4) {
    const rest = 255 - px[i + 3]
    if (rest) for (let c = 0; c < 3; c++) px[i + c] = Math.min(255, px[i + c] + rest)
    px[i + 3] = 255
  }
  return nativeImage.createFromBitmap(px, size).toJPEG(85)
}

/**
 * Converted copies to paste as files: an image as PNG or JPG ('png' | 'jpg'), or image files without metadata ('clean').
 * The copies live in tempDir; the item and the original files are never changed.
 */
export function convertedFiles(item, mode, imagesDir) {
  if (item.kind === 'image' && (mode === 'png' || mode === 'jpg')) {
    const src = join(imagesDir, item.image)
    if (!existsSync(src)) throw new Error('These files no longer exist')
    const png = readFileSync(src)
    const dest = imageCopyName(item, mode)
    writeFileSync(dest, mode === 'png' ? stripMetadata(png) ?? png : toJpeg(nativeImage.createFromBuffer(png)))
    return [dest]
  }
  if (item.kind === 'files' && mode === 'clean') {
    const files = item.files.filter((f) => existsSync(f) && isCleanable(f))
    if (!files.length) throw new Error('These files no longer exist')
    // A fresh folder per paste keeps the original file names without clashes.
    const dir = join(tempDir(), randomUUID())
    mkdirSync(dir, { recursive: true })
    return files.map((f) => {
      const buf = readFileSync(f)
      const dest = join(dir, basename(f))
      writeFileSync(dest, stripMetadata(buf) ?? buf)
      return dest
    })
  }
  throw new Error('Nothing to add')
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
  if (item.kind === 'group') {
    const files = item.parts.flatMap((p) => dragPayload(p, imagesDir)?.files ?? [])
    return files.length ? { files, icon: genericIcon() } : null
  }
  if (item.kind === 'files') {
    const files = item.files.filter((f) => existsSync(f))
    return files.length ? { files, icon: genericIcon() } : null
  }
  if (item.kind === 'image') {
    const src = join(imagesDir, item.image)
    if (!existsSync(src)) return null
    // Hand out a copy with a readable name, so a "move" by the target never takes our stored file.
    const dest = imageCopyName(item, 'png')
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
