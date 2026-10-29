import { app, BrowserWindow, globalShortcut, ipcMain, net, protocol, screen } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { foregroundWindow, pasteInto, watchClipboard, windowAddress, writeItem } from './clipboard'
import { cleanTemp, dragPayload, itemFromDroppedPaths } from './drag'
import { createTray } from './tray'
import { HANDLE_COLORS, HANDLE_LENGTHS, HANDLE_THICKNESS, isInHotZone, PANEL_WIDTHS } from '../renderer/src/hotZone'
import { resolveLang } from '../renderer/src/i18n'
import { add, clearHistory, findItem, flush, getItems, imagesDir, loadItems, merge, prune, remove, setPinned, split, touch } from './store'

const DEFAULT_SETTINGS = {
  edge: 'left',
  language: 'system',
  launchAtLogin: true,
  handleLength: 'medium',
  handleThickness: 'medium',
  handleColor: 'purple',
  historyLimit: 1000,
  autoDeleteDays: 0,
  captureText: true,
  captureImages: true,
  captureFiles: true,
  shortcut: 'Control+Alt+E',
  openDelay: 0,
  theme: 'system',
  font: 'system',
  textSize: 'medium',
  density: 'comfortable',
  panelWidth: 'medium'
}
// Settings the renderer may change (besides the edge and shortcut), each checked against its allowed values.
const CHOICE_SETTINGS = {
  handleLength: HANDLE_LENGTHS,
  handleThickness: HANDLE_THICKNESS,
  handleColor: HANDLE_COLORS,
  language: ['system', 'en', 'ar'],
  historyLimit: [250, 500, 750, 1000],
  autoDeleteDays: [0, 30, 40],
  captureText: [true, false],
  captureImages: [true, false],
  captureFiles: [true, false],
  openDelay: [0, 300, 600],
  theme: ['system', 'light', 'dark', 'ocean', 'sand'],
  font: ['system', 'plex', 'cairo', 'tajawal'],
  textSize: ['small', 'medium', 'large'],
  density: ['compact', 'comfortable'],
  panelWidth: PANEL_WIDTHS
}
const allowed = (key, value) => (Array.isArray(CHOICE_SETTINGS[key]) ? CHOICE_SETTINGS[key].includes(value) : Object.hasOwn(CHOICE_SETTINGS[key], value))
// At least one of Ctrl, Alt or Win, so a shortcut never swallows plain typing.
const SHORTCUT_RE = /^(?=.*\b(Control|Alt|Super)\+)((Control|Alt|Shift|Super)\+)+([A-Z0-9]|F([1-9]|1[0-9]|2[0-4])|Space)$/
const historyRules = (s) => ({ limit: s.historyLimit, maxAgeDays: s.autoDeleteDays })

const settingsFile = () => join(app.getPath('userData'), 'settings.json')

function loadSettings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(readFileSync(settingsFile(), 'utf8')) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function saveSettings(settings) {
  try {
    writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), 'utf8')
  } catch (err) {
    console.error('[settings] save failed:', err)
  }
}

/**
 * Adds or removes the HKCU Run entry. Unpackaged (dev) runs register electron.exe plus the project folder,
 * so the packaged build later overwrites the same entry with its own exe.
 */
function applyLaunchAtLogin(enabled) {
  // Test runs use their own data folder and must not change the real "Edge Clipboard" startup entry.
  if (process.env.EDGE_CLIPBOARD_DATA) return
  app.setLoginItemSettings({
    openAtLogin: enabled,
    name: 'Edge Clipboard',
    path: process.execPath,
    args: app.isPackaged ? [] : [app.getAppPath()]
  })
}

function placeWindow(win, { edge, panelWidth }) {
  const { workArea } = screen.getPrimaryDisplay()
  const width = (PANEL_WIDTHS[panelWidth] ?? PANEL_WIDTHS.medium) + 20
  const x = edge === 'right' ? workArea.x + workArea.width - width : workArea.x
  win.setBounds({ x, y: workArea.y, width, height: workArea.height })
}

/** clip://image/<id>.png serves stored captures; the name check keeps it inside the images folder. */
function registerImageProtocol() {
  protocol.handle('clip', (req) => {
    const name = new URL(req.url).pathname.slice(1)
    if (!/^[0-9a-f-]+\.png$/.test(name)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(join(imagesDir(), name)).toString())
  })
}

function createWindow() {
  loadItems()
  cleanTemp()
  registerImageProtocol()
  const settings = loadSettings()
  const win = new BrowserWindow({
    width: PANEL_WIDTHS.medium + 20,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  placeWindow(win, settings)
  win.setAlwaysOnTop(true, 'screen-saver')
  // Click-through while collapsed; `forward` still delivers mousemove so the renderer can spot the hot zone.
  win.setIgnoreMouseEvents(true, { forward: true })
  // The window the user was working in when the panel opened; paste sends Ctrl+V back to it.
  let previousWindow = null
  let interactive = false
  const ownWindow = win.getNativeWindowHandle().readBigUInt64LE()
  ipcMain.on('panel:interactive', (_e, on) => {
    interactive = on
    if (!on) openedByKey = false
    if (on) {
      const fg = foregroundWindow()
      if (windowAddress(fg) !== ownWindow) previousWindow = fg
    }
    win.setIgnoreMouseEvents(!on, { forward: true })
  })

  function setEdge(edge) {
    if (edge !== 'left' && edge !== 'right') return
    settings.edge = edge
    placeWindow(win, settings)
    saveSettings(settings)
    win.webContents.send('settings:changed', settings)
    tray.refresh()
  }
  ipcMain.handle('settings:get', () => settings)
  ipcMain.handle('settings:set', (_e, patch) => {
    if (patch?.edge) setEdge(patch.edge)
    const valid = Object.keys(CHOICE_SETTINGS).filter((key) => patch && key in patch && allowed(key, patch[key]))
    if (valid.length) {
      valid.forEach((key) => (settings[key] = patch[key]))
      saveSettings(settings)
      win.webContents.send('settings:changed', settings)
      if (patch.language) tray.refresh()
      if (patch.panelWidth) placeWindow(win, settings)
      if (('historyLimit' in patch || 'autoDeleteDays' in patch) && prune(historyRules(settings))) pushItems()
    }
    return settings
  })
  /** Swaps the global shortcut; keeps the old one when the new one is invalid or taken by another program. */
  ipcMain.handle('shortcut:set', (_e, accelerator) => {
    if (typeof accelerator !== 'string' || !SHORTCUT_RE.test(accelerator)) return { ok: false, error: 'Use Ctrl, Alt or Win with a letter, digit or F-key' }
    if (accelerator === settings.shortcut) return { ok: true }
    globalShortcut.unregister(settings.shortcut)
    if (!globalShortcut.register(accelerator, onShortcut)) {
      globalShortcut.register(settings.shortcut, onShortcut)
      return { ok: false, error: 'This shortcut is used by another program' }
    }
    settings.shortcut = accelerator
    saveSettings(settings)
    win.webContents.send('settings:changed', settings)
    return { ok: true }
  })

  const pushItems = () => win.webContents.send('items:changed', getItems())
  prune(historyRules(settings))
  // Auto-delete runs on start and then every hour, so items go soon after they pass the age.
  setInterval(() => prune() && pushItems(), 3600000)
  const capture = { text: 'captureText', images: 'captureImages', files: 'captureFiles' }
  const watcher = watchClipboard(
    imagesDir(),
    (item) => {
      add(item)
      pushItems()
    },
    (kind) => settings[capture[kind]] !== false
  )

  applyLaunchAtLogin(settings.launchAtLogin)
  const tray = createTray({
    getLang: () => resolveLang(settings.language, app.getLocale()),
    getEdge: () => settings.edge,
    setEdge,
    getLaunchAtLogin: () => settings.launchAtLogin,
    setLaunchAtLogin: (on) => {
      settings.launchAtLogin = on
      applyLaunchAtLogin(on)
      saveSettings(settings)
    },
    setPaused: (on) => watcher.setPaused(on),
    quit: () => app.quit()
  })

  /** Puts an item back on the clipboard; returns an error message for the renderer instead of throwing. */
  async function copyItem(id) {
    const item = typeof id === 'string' && findItem(id)
    if (!item) return { ok: false, error: 'Item not found' }
    try {
      await writeItem(item, imagesDir())
    } catch (err) {
      return { ok: false, error: err.message }
    }
    watcher.skipCurrent()
    touch(id)
    pushItems()
    return { ok: true }
  }

  ipcMain.handle('items:get', () => getItems())
  ipcMain.handle('items:copy', (_e, id) => copyItem(id))
  ipcMain.handle('items:paste', async (_e, id) => {
    const result = await copyItem(id)
    if (result.ok) {
      win.setIgnoreMouseEvents(true, { forward: true })
      await pasteInto(previousWindow)
    }
    return result
  })
  ipcMain.handle('items:pin', (_e, id, pinned) => {
    if (typeof id === 'string') setPinned(id, pinned === true)
    pushItems()
  })
  ipcMain.handle('items:delete', (_e, id) => {
    if (typeof id === 'string') remove(id)
    pushItems()
  })
  // Emoji are pasted straight into the previous window and kept out of the history.
  ipcMain.handle('emoji:paste', async (_e, text) => {
    if (typeof text !== 'string' || !text || text.length > 64) return { ok: false, error: 'Invalid emoji' }
    await writeItem({ kind: 'text', text }, imagesDir())
    watcher.skipCurrent()
    win.setIgnoreMouseEvents(true, { forward: true })
    await pasteInto(previousWindow)
    return { ok: true }
  })
  // A converted copy of an item's text (digits, diacritics) is pasted once and kept out of the history.
  ipcMain.handle('text:paste', async (_e, text) => {
    if (typeof text !== 'string' || !text) return { ok: false, error: 'Nothing to add' }
    await writeItem({ kind: 'text', text }, imagesDir())
    watcher.skipCurrent()
    win.setIgnoreMouseEvents(true, { forward: true })
    await pasteInto(previousWindow)
    return { ok: true }
  })
  ipcMain.handle('items:merge', (_e, ids) => {
    if (Array.isArray(ids) && ids.every((id) => typeof id === 'string')) merge(ids)
    pushItems()
  })
  ipcMain.handle('items:split', (_e, id) => {
    if (typeof id === 'string') split(id)
    pushItems()
  })
  ipcMain.handle('items:clear', () => {
    clearHistory()
    pushItems()
  })
  app.on('before-quit', flush)

  ipcMain.on('items:drag', (e, id) => {
    const item = typeof id === 'string' && findItem(id)
    const payload = item && dragPayload(item, imagesDir())
    if (payload) e.sender.startDrag(payload)
  })
  ipcMain.handle('items:drop', (_e, { paths, text } = {}) => {
    const item =
      itemFromDroppedPaths(paths) ??
      (typeof text === 'string' && text.trim() ? { id: randomUUID(), createdAt: Date.now(), pinned: false, kind: 'text', text } : null)
    if (!item) return { ok: false, error: 'Nothing to add' }
    add(item)
    pushItems()
    return { ok: true }
  })

  // A panel opened with the shortcut stays open while the cursor is elsewhere, until the cursor
  // has visited it and left, the shortcut is pressed again, Esc is pressed, or another window is clicked.
  let openedByKey = false
  function onShortcut() {
    if (interactive) return win.webContents.send('cursor:away')
    previousWindow = foregroundWindow() // record before focusing ourselves, so paste goes back there
    openedByKey = true
    win.webContents.send('cursor:edge')
    win.focus()
  }
  if (!globalShortcut.register(settings.shortcut, onShortcut)) {
    console.warn(`[shortcut] ${settings.shortcut} is taken by another program`)
  }
  app.on('will-quit', () => globalShortcut.unregisterAll())
  win.on('blur', () => interactive && win.webContents.send('cursor:away'))
  // Windows sometimes drops skipTaskbar after focus/show, so the panel shows up on the taskbar; reassert it.
  win.on('focus', () => win.setSkipTaskbar(true))
  win.on('show', () => win.setSkipTaskbar(true))
  // "Close window" from the taskbar must not quit the app; only the tray's Quit (or a Windows sign-out) does.
  let quitting = false
  app.on('before-quit', () => (quitting = true))
  win.on('session-end', () => (quitting = true))
  win.on('close', (e) => quitting || e.preventDefault())

  // During a drag (into or out of the panel) the window gets no mouse events, so watch the cursor here:
  // open when it has stayed at the edge for the open delay, close once it has left the window.
  let edgeSince = null
  setInterval(() => {
    const { x, y } = screen.getCursorScreenPoint()
    const b = win.getBounds()
    const inside = x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height
    if (inside) openedByKey = false
    if (isInHotZone(x - b.x, y - b.y, b.width, b.height, settings.edge, settings.handleLength, settings.handleThickness)) {
      edgeSince ??= Date.now()
      if (Date.now() - edgeSince >= settings.openDelay) win.webContents.send('cursor:edge')
      return
    }
    edgeSince = null
    if (interactive && !inside && !openedByKey) win.webContents.send('cursor:away')
  }, 150)

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
  win.once('ready-to-show', () => win.showInactive())
}

// The installed build is named "Edge Clipboard"; pin the data folder so it keeps the history made by dev runs.
// EDGE_CLIPBOARD_DATA points tests and demos at a separate folder so real history is never touched.
app.setPath('userData', process.env.EDGE_CLIPBOARD_DATA || join(app.getPath('appData'), 'edge-clipboard'))

if (!app.requestSingleInstanceLock()) app.quit()
else app.whenReady().then(createWindow)
