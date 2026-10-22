/** System tray icon: pause capturing, choose the screen edge, quit. */
import { Menu, Tray } from 'electron'
import { makeTrayIcon } from './trayIcon'

export function createTray({ getEdge, setEdge, setPaused, quit }) {
  const icons = { on: makeTrayIcon(false), paused: makeTrayIcon(true) }
  const tray = new Tray(icons.on)
  let paused = false

  function refresh() {
    tray.setImage(paused ? icons.paused : icons.on)
    tray.setToolTip(paused ? 'Edge Clipboard (paused)' : 'Edge Clipboard')
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: 'Edge Clipboard', enabled: false },
        { type: 'separator' },
        {
          label: 'Pause capturing',
          type: 'checkbox',
          checked: paused,
          click: (mi) => {
            paused = mi.checked
            setPaused(paused)
            refresh()
          }
        },
        {
          label: 'Screen edge',
          submenu: ['left', 'right'].map((side) => ({
            label: side === 'left' ? 'Left' : 'Right',
            type: 'radio',
            checked: getEdge() === side,
            click: () => setEdge(side)
          }))
        },
        { type: 'separator' },
        { label: 'Quit', click: quit }
      ])
    )
  }

  refresh()
  // Left click opens the same menu, since there is no separate window to show.
  tray.on('click', () => tray.popUpContextMenu())
  return { refresh }
}
