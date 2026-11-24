/** Native drag-out of history items, plus turning dropped files into history items. */
import { app, BrowserWindow, nativeImage } from 'electron'
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

/** Picture files of a group, in order: its images and any JPG/PNG files it holds. */
export const groupImages = (item, imagesDir) =>
  item.parts.flatMap((p) => (p.kind === 'image' ? [join(imagesDir, p.image)] : p.kind === 'files' ? p.files.filter(isCleanable) : [])).filter((f) => existsSync(f))

/** One A4 page per picture, each scaled to fit, printed by a hidden window into a PDF in tempDir. */
async function groupPdf(item, imagesDir) {
  const files = groupImages(item, imagesDir)
  if (!files.length) throw new Error('These files no longer exist')
  const pages = files
    .map((f) => `<div class="p"><img src="data:image/${/\.png$/i.test(f) ? 'png' : 'jpeg'};base64,${readFileSync(f).toString('base64')}"></div>`)
    .join('')
  const html = `<!doctype html><style>@page{size:A4;margin:0}body{margin:0}.p{height:100vh;display:flex;align-items:center;justify-content:center;break-after:page}img{max-width:100%;max-height:100%;image-orientation:from-image}</style>${pages}`
  const win = new BrowserWindow({ show: false, webPreferences: { javascript: false } })
  try {
    // A temp HTML file instead of a data: URL, which has a size limit that a few photos exceed.
    const page = join(tempDir(), `${randomUUID()}.html`)
    writeFileSync(page, html)
    await win.loadFile(page)
    rmSync(page, { force: true })
    const dest = join(tempDir(), `${(item.name || 'Images').replace(/[\\/:*?"<>|]/g, '_')}.pdf`)
    writeFileSync(dest, await win.webContents.printToPDF({ pageSize: 'A4', margins: { marginType: 'none' }, printBackground: true }))
    return dest
  } finally {
    win.destroy()
  }
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
 * Converted copies to paste as files: an image as PNG or JPG ('png' | 'jpg'), image files without metadata ('clean'),
 * or a group's pictures as one PDF ('pdf').
 * The copies live in tempDir; the item and the original files are never changed.
 */
export async function convertedFiles(item, mode, imagesDir) {
  if (item.kind === 'group' && mode === 'pdf') return [await groupPdf(item, imagesDir)]
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

/** A text item (or a text-only group) as a .txt file to drag, named after its first words. */
export function textFilePayload(item) {
  const text = item.kind === 'text' ? item.text : item.kind === 'group' && item.parts.every((p) => p.kind === 'text') ? item.parts.map((p) => p.text).join('\r\n') : null
  if (!text) return null
  const words = text.trim().split(/\r?\n/)[0].replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').slice(0, 40).trim()
  // A fresh folder per drag keeps the readable name without clashes.
  const dir = join(tempDir(), randomUUID())
  mkdirSync(dir, { recursive: true })
  const dest = join(dir, `${item.name?.replace(/[\\/:*?"<>|]/g, ' ') || words || 'Text'}.txt`)
  writeFileSync(dest, text)
  return { files: [dest], icon: genericIcon() }
}

/** A history item for files dropped onto the panel; only real, existing paths are kept. */
export function itemFromDroppedPaths(paths) {
  if (!Array.isArray(paths)) return null
  // Our own drag copies live in tempDir and are deleted on restart, so they must not become history.
  const files = paths.filter((p) => typeof p === 'string' && p && !p.startsWith(tempDir()) && existsSync(p))
  return files.length ? { id: randomUUID(), createdAt: Date.now(), pinned: false, kind: 'files', files } : null
}
