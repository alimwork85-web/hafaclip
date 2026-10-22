import { app, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'node:path'

const PANEL_WIDTH = 380

function createWindow() {
  const { workArea } = screen.getPrimaryDisplay()
  const win = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: PANEL_WIDTH,
    height: workArea.height,
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
  win.setAlwaysOnTop(true, 'screen-saver')
  // Click-through while collapsed; `forward` still delivers mousemove so the renderer can spot the hot zone.
  win.setIgnoreMouseEvents(true, { forward: true })
  ipcMain.on('panel:interactive', (_e, on) => win.setIgnoreMouseEvents(!on, { forward: true }))

  if (process.env.ELECTRON_RENDERER_URL) win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else win.loadFile(join(__dirname, '../renderer/index.html'))
  win.once('ready-to-show', () => win.showInactive())
}

if (!app.requestSingleInstanceLock()) app.quit()
else app.whenReady().then(createWindow)
