// Notara — Electron Preload (IPC bridge)
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('notara', {
  // Vault
  vault: {
    select: () => ipcRenderer.invoke('vault:select'),
    get: () => ipcRenderer.invoke('vault:get'),
    set: (path) => ipcRenderer.invoke('vault:set', path),
    openInExplorer: (path) => ipcRenderer.invoke('shell:openVault', path),
  },
  // Pages
  pages: {
    readAll: (vaultPath) => ipcRenderer.invoke('pages:readAll', vaultPath),
    readOne: (vaultPath, id) => ipcRenderer.invoke('pages:readOne', { vaultPath, id }),
    write: (vaultPath, filename, content, oldFilename) =>
      ipcRenderer.invoke('pages:write', { vaultPath, filename, content, oldFilename }),
    delete: (vaultPath, filename) =>
      ipcRenderer.invoke('pages:delete', { vaultPath, filename }),
    importFile: (vaultPath) => ipcRenderer.invoke('pages:importFile', vaultPath),
    exportMd: (content, suggestedName) =>
      ipcRenderer.invoke('pages:exportMd', { content, suggestedName }),
    exportHtml: (content, suggestedName) =>
      ipcRenderer.invoke('pages:exportHtml', { content, suggestedName }),
    exportPdf: (suggestedName) => ipcRenderer.invoke('pages:exportPdf', suggestedName),
  },
  // Media / Bookmark
  media: {
    importFile: (vaultPath, fileType) =>
      ipcRenderer.invoke('media:importFile', { vaultPath, fileType }),
    fetchBookmark: (url) =>
      ipcRenderer.invoke('bookmark:fetch', url),
  },
  // Prefs (PIN encryption)
  prefs: {
    getPinData: () => ipcRenderer.invoke('prefs:getPinData'),
    setPinData: (salt, verificationToken) =>
      ipcRenderer.invoke('prefs:setPinData', { salt, verificationToken }),
    clearPinData: () => ipcRenderer.invoke('prefs:clearPinData'),
  },
  // Sticky notes
  sticky: {
    open: (id) => ipcRenderer.invoke('sticky:open', id),
    close: () => ipcRenderer.invoke('sticky:close'),
    setAlwaysOnTop: (alwaysOnTop) => ipcRenderer.invoke('sticky:setAlwaysOnTop', alwaysOnTop),
  },
  // Menu events
  on: (channel, callback) => {
    const valid = ['menu-new-page', 'menu-search', 'menu-toggle-sidebar', 'menu-choose-vault', 'menu-new-sticky']
    if (valid.includes(channel)) {
      ipcRenderer.on(channel, callback)
      return () => ipcRenderer.removeListener(channel, callback)
    }
  },
})
