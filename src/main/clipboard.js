/** Watches the Windows clipboard and turns each change into a history item (text, image or files). */
import { ClipboardItem, clipboard, nativeImage } from 'electron'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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
const kernel32 = koffi.load('kernel32.dll')
const EmptyClipboard = user32.func('bool __stdcall EmptyClipboard()')
const SetClipboardData = user32.func('void * __stdcall SetClipboardData(uint32 format, void *hMem)')
const GlobalAlloc = kernel32.func('void * __stdcall GlobalAlloc(uint32 flags, size_t bytes)')
const GlobalLock = kernel32.func('void * __stdcall GlobalLock(void *hMem)')
const GlobalUnlock = kernel32.func('bool __stdcall GlobalUnlock(void *hMem)')
const GlobalFree = kernel32.func('void * __stdcall GlobalFree(void *hMem)')
const RtlMoveMemory = kernel32.func('void __stdcall RtlMoveMemory(void *dst, void *src, size_t n)')
const GetForegroundWindow = user32.func('void * __stdcall GetForegroundWindow()')
const SetForegroundWindow = user32.func('bool __stdcall SetForegroundWindow(void *hWnd)')
const keybd_event = user32.func('void __stdcall keybd_event(uint8 vk, uint8 scan, uint32 flags, uintptr_t extra)')
const RegisterClipboardFormatW = user32.func('uint32 __stdcall RegisterClipboardFormatW(str16 name)')
const GetClipboardOwner = user32.func('void * __stdcall GetClipboardOwner()')
const GetWindowThreadProcessId = user32.func('uint32 __stdcall GetWindowThreadProcessId(void *hWnd, _Out_ uint32 *pid)')
const OpenProcess = kernel32.func('void * __stdcall OpenProcess(uint32 access, bool inherit, uint32 pid)')
const CloseHandle = kernel32.func('bool __stdcall CloseHandle(void *h)')
const QueryFullProcessImageNameW = kernel32.func('bool __stdcall QueryFullProcessImageNameW(void *h, uint32 flags, void *buf, _Inout_ uint32 *size)')

/** Lower-case program name ("chrome.exe") that put the current content on the clipboard, or null when unknown. */
function sourceApp() {
  // Some programs copy without an owner window; the window in front is then the best guess.
  const hwnd = GetClipboardOwner() ?? GetForegroundWindow()
  if (!hwnd) return null
  const pid = [0]
  GetWindowThreadProcessId(hwnd, pid)
  const h = pid[0] && OpenProcess(0x1000 /* PROCESS_QUERY_LIMITED_INFORMATION */, false, pid[0])
  if (!h) return null
  try {
    const buf = Buffer.alloc(1040)
    const size = [520]
    if (!QueryFullProcessImageNameW(h, 0, buf, size)) return null
    return buf.toString('utf16le', 0, size[0] * 2).split('\\').pop().toLowerCase()
  } finally {
    CloseHandle(h)
  }
}

// Formats password managers (KeePass, 1Password, Bitwarden...) add to say "don't keep this copy".
const EXCLUDE_FORMATS = ['ExcludeClipboardContentFromMonitorProcessing', 'Clipboard Viewer Ignore'].map((f) => RegisterClipboardFormatW(f))
const CF_CAN_INCLUDE = RegisterClipboardFormatW('CanIncludeInClipboardHistory')

/** True when the app that copied asked clipboard managers to skip it. Null when the clipboard is busy. */
function isSensitive() {
  if (EXCLUDE_FORMATS.some((f) => IsClipboardFormatAvailable(f))) return true
  if (!IsClipboardFormatAvailable(CF_CAN_INCLUDE)) return false
  if (!OpenClipboard(null)) return null
  try {
    const hMem = GetClipboardData(CF_CAN_INCLUDE)
    const ptr = hMem && GlobalLock(hMem)
    if (!ptr) return false
    try {
      return koffi.decode(ptr, 'uint32') === 0 // DWORD 0 = keep it out of history
    } finally {
      GlobalUnlock(hMem)
    }
  } finally {
    CloseClipboard()
  }
}

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

/**
 * Reads the current clipboard. Returns undefined when it is busy (retry later), null when there is nothing to keep.
 * `allow(kind)` turns capturing of 'text', 'images' or 'files' off; it is asked before an image is written to disk.
 * `allow('app', name)` turns capturing off for copies made in that program.
 */
export async function readClipboard(imagesDir, allow = () => true) {
  const app = sourceApp()
  const base = { id: randomUUID(), createdAt: Date.now(), pinned: false, ...(app && { app }) }
  const sensitive = isSensitive()
  if (sensitive === null) return undefined
  if (sensitive || (app && !allow('app', app))) return null
  if (IsClipboardFormatAvailable(CF_HDROP)) {
    const files = readFilePaths()
    if (files === null) return undefined
    if (files.length) return allow('files') ? { ...base, kind: 'files', files } : null
  }
  const [entry] = await clipboard.read()
  if (!entry) return null
  // Text wins over the picture Office apps also put on the clipboard.
  if (entry.types.includes('text/plain')) {
    const text = await (await entry.getType('text/plain')).text()
    if (text.trim()) return allow('text') ? { ...base, kind: 'text', text } : null
  }
  if (entry.types.includes('image/png') && allow('images')) {
    const png = Buffer.from(await (await entry.getType('image/png')).arrayBuffer())
    const file = `${base.id}.png`
    writeFileSync(join(imagesDir, file), png)
    const { width, height } = nativeImage.createFromBuffer(png).getSize()
    return { ...base, kind: 'image', image: file, width, height, hash: createHash('sha1').update(png).digest('hex') }
  }
  return null
}

/** Puts real file references (CF_HDROP) on the clipboard so Explorer, Word, etc. paste the files themselves. */
function writeFileList(paths) {
  const header = Buffer.alloc(20) // DROPFILES
  header.writeUInt32LE(20, 0) // pFiles: list starts right after the header
  header.writeUInt32LE(1, 16) // fWide: UTF-16 paths
  const data = Buffer.concat([header, Buffer.from(paths.join('\0') + '\0\0', 'utf16le')])
  const hMem = GlobalAlloc(0x2 /* GMEM_MOVEABLE */, data.length)
  if (!hMem) throw new Error('Out of memory')
  RtlMoveMemory(GlobalLock(hMem), data, data.length)
  GlobalUnlock(hMem)
  if (!OpenClipboard(null)) {
    GlobalFree(hMem)
    throw new Error('Clipboard is busy, try again')
  }
  try {
    EmptyClipboard()
    // On success Windows owns hMem; only free it if the hand-off failed.
    if (!SetClipboardData(CF_HDROP, hMem)) {
      GlobalFree(hMem)
      throw new Error('Could not write files to the clipboard')
    }
  } finally {
    CloseClipboard()
  }
}

/** Writes a history item back to the clipboard. Throws a user-facing message when it cannot. */
export async function writeItem(item, imagesDir) {
  if (item.kind === 'text') return clipboard.writeText(item.text)
  if (item.kind === 'image') {
    const png = readFileSync(join(imagesDir, item.image))
    return clipboard.write([new ClipboardItem({ 'image/png': new Blob([png], { type: 'image/png' }) })])
  }
  if (item.kind === 'group') {
    // Text-only groups paste as one text, line by line; anything with files or images pastes as a file list.
    const paths = item.parts.flatMap((p) => (p.kind === 'files' ? p.files : p.kind === 'image' ? [join(imagesDir, p.image)] : []))
    if (!paths.length) return clipboard.writeText(item.parts.map((p) => p.text).join('\n'))
    return writeItem({ kind: 'files', files: paths }, imagesDir)
  }
  const files = item.files.filter((f) => existsSync(f))
  if (!files.length) throw new Error('These files no longer exist')
  writeFileList(files)
}

export const foregroundWindow = () => GetForegroundWindow()
export const windowAddress = (hwnd) => (hwnd ? koffi.address(hwnd) : 0n)

/** Gives focus back to the window the user was in and sends Ctrl+V to it. */
export async function pasteInto(hwnd) {
  const VK_CONTROL = 0x11
  const VK_F24 = 0x87
  const VK_V = 0x56
  const KEYUP = 0x2
  if (hwnd) {
    // Windows only lets a process take focus right after it sent input. F24 satisfies that and, unlike Alt, opens no menus.
    keybd_event(VK_F24, 0, 0, 0)
    keybd_event(VK_F24, 0, KEYUP, 0)
    SetForegroundWindow(hwnd)
  }
  await new Promise((r) => setTimeout(r, 80))
  keybd_event(VK_CONTROL, 0, 0, 0)
  keybd_event(VK_V, 0, 0, 0)
  keybd_event(VK_V, 0, KEYUP, 0)
  keybd_event(VK_CONTROL, 0, KEYUP, 0)
}

/** Polls the cheap sequence number and calls onItem for each new clipboard content. */
export function watchClipboard(imagesDir, onItem, allow, intervalMs = 400) {
  let lastSeq = GetClipboardSequenceNumber()
  let busy = false
  let paused = false
  const timer = setInterval(async () => {
    const seq = GetClipboardSequenceNumber()
    if (seq === lastSeq || busy) return
    if (paused) {
      lastSeq = seq // what is copied while paused is never captured, not even after resuming
      return
    }
    busy = true
    try {
      const item = await readClipboard(imagesDir, allow)
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
  return {
    stop: () => clearInterval(timer),
    /** Ignore the change we just made ourselves, so a re-copied item is not captured twice. */
    skipCurrent: () => {
      lastSeq = GetClipboardSequenceNumber()
    },
    setPaused: (on) => {
      paused = on
    }
  }
}
