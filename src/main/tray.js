/** System tray icon: pause capturing, choose the screen edge, quit. */
import { Menu, Tray } from 'electron'
import { makeTrayIcon } from './trayIcon'
import { t } from '../renderer/src/i18n'

export function createTray({ getLang, getEdge, setEdge, getLaunchAtLogin, setLaunchAtLogin, setPaused, quit }) {
  const icons = { on: makeTrayIcon(false), paused: makeTrayIcon(true) }
  const tray = new Tray(icons.on)
  let paused = false

  function refresh() {
    const lang = getLang()
    tray.setImage(paused ? icons.paused : icons.on)
    tray.setToolTip(paused ? `${t(lang, 'appName')} (${t(lang, 'paused')})` : t(lang, 'appName'))
    tray.setContextMenu(
      Menu.buildFromTemplate([
        { label: t(lang, 'appName'), enabled: false },
        { type: 'separator' },
        {
          label: t(lang, 'pauseCapturing'),
          type: 'checkbox',
          checked: paused,
          click: (mi) => {
            paused = mi.checked
            setPaused(paused)
            refresh()
          }
        },
        {
          label: t(lang, 'screenEdge'),
          submenu: ['left', 'right'].map((side) => ({
            label: t(lang, `opt.${side}`),
            type: 'radio',
            checked: getEdge() === side,
            click: () => setEdge(side)
          }))
        },
        {
          label: t(lang, 'startWithWindows'),
          type: 'checkbox',
          checked: getLaunchAtLogin(),
          click: (mi) => setLaunchAtLogin(mi.checked)
        },
        { type: 'separator' },
        { label: t(lang, 'quit'), click: quit }
      ])
    )
  }

  refresh()
  // Left click opens the same menu, since there is no separate window to show.
  tray.on('click', () => tray.popUpContextMenu())
  return { refresh }
}
