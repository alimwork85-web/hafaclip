/** Watches the Windows clipboard and turns each change into a history item (text, image or files). */
import { clipboard, nativeImage } from 'electron'
import { createHash, randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import koffi from 'koffi'

const CF_HDROP = 15
const user32 = koffi.load('user32.dll')
const shell32 = koffi.load('shell32.dll')
const GetClipboardSequenceNumber = user32.func('uint32 __stdcall GetClipboardSequenceNumber()')
const IsClipboardFormatAvailable = user32.func('bool __stdcall IsClipboardFormatAvailable(uint32 format)')
const OpenClipboard = user32.func('bool __stdcall OpenClipboard(void *hWnd)')
const CloseClipboard = user32.func('bool __stdcall CloseClipboard()')
const GetClipboardData = user32.func('void * __stdcall GetClipboardData(uint32 format)')
const DragQueryFileW = shell32.func('uint32 __stdcall DragQueryFileW(void *hDrop, uint32 index, void *buf, uint32 cch)')

/** Every copied file path (Electron only exposes the first one). Null when the clipboard is busy. */
function readFilePaths() {
  if (!OpenClipboard(null)) return null
  try {
    const hDrop = GetClipboardData(CF_HDROP)
    if (!hDrop) return []
    const count = DragQueryFileW(hDrop, 0xffffffff, null, 0)
    const paths = []
    for (let i = 0; i < count; i++) {
      const len = DragQueryFileW(hDrop, i, null, 0)
      const buf = Buffer.alloc((len + 1) * 2)
      DragQueryFileW(hDrop, i, buf, len + 1)
      paths.push(buf.toString('utf16le', 0, len * 2))
    }
    return paths
  } finally {
    CloseClipboard()
  }
}

/** Reads the current clipboard. Returns undefined when it is busy (retry later), null when there is nothing to keep. */
export async function readClipboard(imagesDir) {
  const base = { id: randomUUID(), createdAt: Date.now(), pinned: false }
  if (IsClipboardFormatAvailable(CF_HDROP)) {
    const files = readFilePaths()
    if (files === null) return undefined
    if (files.length) return { ...base, kind: 'files', files }
  }
  const [entry] = await clipboard.read()
  if (!entry) return null
  // Text wins over the picture Office apps also put on the clipboard.
  if (entry.types.includes('text/plain')) {
    const text = await (await entry.getType('text/plain')).text()
    if (text.trim()) return { ...base, kind: 'text', text }
  }
  if (entry.types.includes('image/png')) {
    const png = Buffer.from(await (await entry.getType('image/png')).arrayBuffer())
    const file = `${base.id}.png`
    writeFileSync(join(imagesDir, file), png)
    const { width, height } = nativeImage.createFromBuffer(png).getSize()
    return { ...base, kind: 'image', image: file, width, height, hash: createHash('sha1').update(png).digest('hex') }
  }
  return null
}

/** Polls the cheap sequence number and calls onItem for each new clipboard content. */
export function watchClipboard(imagesDir, onItem, intervalMs = 400) {
  let lastSeq = GetClipboardSequenceNumber()
  let busy = false
  const timer = setInterval(async () => {
    const seq = GetClipboardSequenceNumber()
    if (seq === lastSeq || busy) return
    busy = true
    try {
      const item = await readClipboard(imagesDir)
      if (item === undefined) return // clipboard locked by another app; try again next tick
      lastSeq = seq
      if (item) onItem(item)
    } catch (err) {
      lastSeq = seq
      console.error('[clipboard] read failed:', err)
    } finally {
      busy = false
    }
  }, intervalMs)
  return () => clearInterval(timer)
}
