import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('panel', {
  setInteractive: (on) => ipcRenderer.send('panel:interactive', !!on),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:set', patch)
})
