import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('panel', {
  setInteractive: (on) => ipcRenderer.send('panel:interactive', !!on)
})
