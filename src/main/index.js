import { app, BrowserWindow, ipcMain, net, protocol, screen } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { watchClipboard } from './clipboard'
import { add, getItems, imagesDir, loadItems } from './store'

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
  ipcMain.on('panel:interactive', (_e, on) => win.setIgnoreMouseEvents(!on, { forward: true }))

  ipcMain.handle('settings:get', () => settings)
  ipcMain.handle('settings:set', (_e, patch) => {
    if (patch?.edge === 'left' || patch?.edge === 'right') {
      settings.edge = patch.edge
      placeWindow(win, settings.edge)
      saveSettings(settings)
    }
    return settings
  })

  ipcMain.handle('items:get', () => getItems())
  watchClipboard(imagesDir(), (item) => {
    add(item)
    win.webContents.send('items:changed', getItems())
  })

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
  win.once('ready-to-show', () => win.showInactive())
}

if (!app.requestSingleInstanceLock()) app.quit()
else app.whenReady().then(createWindow)
