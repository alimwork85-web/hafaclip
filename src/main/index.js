import { app, BrowserWindow, ipcMain, net, protocol, screen } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { foregroundWindow, pasteInto, watchClipboard, windowAddress, writeItem } from './clipboard'
import { add, clearHistory, findItem, flush, getItems, imagesDir, loadItems, remove, setPinned, touch } from './store'

const PANEL_WIDTH = 380
const DEFAULT_SETTINGS = { edge: 'left' }

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

function placeWindow(win, edge) {
  const { workArea } = screen.getPrimaryDisplay()
  const x = edge === 'right' ? workArea.x + workArea.width - PANEL_WIDTH : workArea.x
  win.setBounds({ x, y: workArea.y, width: PANEL_WIDTH, height: workArea.height })
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
  registerImageProtocol()
  const settings = loadSettings()
  const win = new BrowserWindow({
    width: PANEL_WIDTH,
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
  placeWindow(win, settings.edge)
  win.setAlwaysOnTop(true, 'screen-saver')
  // Click-through while collapsed; `forward` still delivers mousemove so the renderer can spot the hot zone.
  win.setIgnoreMouseEvents(true, { forward: true })
  // The window the user was working in when the panel opened; paste sends Ctrl+V back to it.
  let previousWindow = null
  const ownWindow = win.getNativeWindowHandle().readBigUInt64LE()
  ipcMain.on('panel:interactive', (_e, on) => {
    if (on) {
      const fg = foregroundWindow()
      if (windowAddress(fg) !== ownWindow) previousWindow = fg    }
    win.setIgnoreMouseEvents(!on, { forward: true })
  })

  ipcMain.handle('settings:get', () => settings)
  ipcMain.handle('settings:set', (_e, patch) => {
    if (patch?.edge === 'left' || patch?.edge === 'right') {
      settings.edge = patch.edge
      placeWindow(win, settings.edge)
      saveSettings(settings)
    }
    return settings
  })

  const pushItems = () => win.webContents.send('items:changed', getItems())
  const watcher = watchClipboard(imagesDir(), (item) => {
    add(item)
    pushItems()
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
  ipcMain.handle('items:clear', () => {
    clearHistory()
    pushItems()
  })
  app.on('before-quit', flush)

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
  win.once('ready-to-show', () => win.showInactive())
}

if (!app.requestSingleInstanceLock()) app.quit()
else app.whenReady().then(createWindow)
