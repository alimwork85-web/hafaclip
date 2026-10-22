import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('panel', {
  setInteractive: (on) => ipcRenderer.send('panel:interactive', !!on),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  getItems: () => ipcRenderer.invoke('items:get'),
  copyItem: (id) => ipcRenderer.invoke('items:copy', id),
  pasteItem: (id) => ipcRenderer.invoke('items:paste', id),
  pinItem: (id, pinned) => ipcRenderer.invoke('items:pin', id, pinned),
  deleteItem: (id) => ipcRenderer.invoke('items:delete', id),
  clearHistory: () => ipcRenderer.invoke('items:clear'),
  onItems: (cb) => {
    const listener = (_e, items) => cb(items)
    ipcRenderer.on('items:changed', listener)
    return () => ipcRenderer.removeListener('items:changed', listener)
  }
})
