import { contextBridge, ipcRenderer, webUtils } from 'electron'

contextBridge.exposeInMainWorld('panel', {
  setInteractive: (on) => ipcRenderer.send('panel:interactive', !!on),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  setShortcut: (accelerator) => ipcRenderer.invoke('shortcut:set', accelerator),
  onSettings: (cb) => {
    const listener = (_e, s) => cb(s)
    ipcRenderer.on('settings:changed', listener)
    return () => ipcRenderer.removeListener('settings:changed', listener)
  },
  getItems: () => ipcRenderer.invoke('items:get'),
  ocrLanguages: () => ipcRenderer.invoke('ocr:languages'),
  getUpdate: () => ipcRenderer.invoke('update:get'),
  openReleases: () => ipcRenderer.invoke('update:open'),
  openDataFolder: () => ipcRenderer.invoke('data:open'),
  onUpdate: (cb) => {
    const listener = (_e, version) => cb(version)
    ipcRenderer.on('update:available', listener)
    return () => ipcRenderer.removeListener('update:available', listener)
  },
  copyItem: (id) => ipcRenderer.invoke('items:copy', id),
  pasteItem: (id) => ipcRenderer.invoke('items:paste', id),
  pinItem: (id, pinned) => ipcRenderer.invoke('items:pin', id, pinned),
  pastePart: (id, partId) => ipcRenderer.invoke('items:paste-part', id, partId),
  renameGroup: (id, name) => ipcRenderer.invoke('items:rename', id, name),
  extractPart: (id, partId) => ipcRenderer.invoke('items:extract', id, partId),
  deleteItem: (id) => ipcRenderer.invoke('items:delete', id),
  clearHistory: () => ipcRenderer.invoke('items:clear'),
  mergeItems: (ids) => ipcRenderer.invoke('items:merge', ids),
  pasteEmoji: (text) => ipcRenderer.invoke('emoji:paste', text),
  pasteText: (text) => ipcRenderer.invoke('text:paste', text),
  splitItem: (id) => ipcRenderer.invoke('items:split', id),
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
