import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

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

function createWindow() {
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

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
  win.once('ready-to-show', () => win.showInactive())
}

if (!app.requestSingleInstanceLock()) app.quit()
else app.whenReady().then(createWindow)
