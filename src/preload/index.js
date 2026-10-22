import { contextBridge, ipcRenderer, webUtils } from 'electron'

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
  startDrag: (id) => ipcRenderer.send('items:drag', id),
  drop: (files, text) => ipcRenderer.invoke('items:drop', { paths: [...files].map((f) => webUtils.getPathForFile(f)), text }),
  onCursor: (cb) => {
    const edge = () => cb('edge')
    const away = () => cb('away')
    ipcRenderer.on('cursor:edge', edge)
    ipcRenderer.on('cursor:away', away)
    return () => {
      ipcRenderer.removeListener('cursor:edge', edge)
      ipcRenderer.removeListener('cursor:away', away)
    }
  },
  onItems: (cb) => {
    const listener = (_e, items) => cb(items)
    ipcRenderer.on('items:changed', listener)
    return () => ipcRenderer.removeListener('items:changed', listener)
  }
})
