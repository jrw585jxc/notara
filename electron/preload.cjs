// Notara — Electron Preload (IPC bridge)
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('notara', {
  // Vault
  vault: {
    select: () => ipcRenderer.invoke('vault:select'),
    get: () => ipcRenderer.invoke('vault:get'),
    set: (path) => ipcRenderer.invoke('vault:set', path),
    openInExplorer: (path) => ipcRenderer.invoke('shell:openVault', path),
    readEncConfig: (vaultPath) => ipcRenderer.invoke('vault:readEncConfig', vaultPath),
    writeEncConfig: (vaultPath, config) => ipcRenderer.invoke('vault:writeEncConfig', { vaultPath, config }),
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
    saveBuffer: (vaultPath, filename, buffer) =>
      ipcRenderer.invoke('media:saveBuffer', { vaultPath, filename, buffer }),
  },
  // Prefs (PIN encryption)
  prefs: {
    getPinData: () => ipcRenderer.invoke('prefs:getPinData'),
    setPinData: (data) => ipcRenderer.invoke('prefs:setPinData', data),
    clearPinData: () => ipcRenderer.invoke('prefs:clearPinData'),
  },
  // Sticky notes
  sticky: {
    open: (id, exportedKey) => ipcRenderer.invoke('sticky:open', { id, exportedKey: exportedKey || null }),
    close: () => ipcRenderer.invoke('sticky:close'),
    setAlwaysOnTop: (alwaysOnTop) => ipcRenderer.invoke('sticky:setAlwaysOnTop', alwaysOnTop),
    syncPage: (page) => ipcRenderer.invoke('sticky:syncPage', page),
    getKey: (id) => ipcRenderer.invoke('sticky:getKey', id),
    restoreOpen: (exportedKey) => ipcRenderer.invoke('sticky:restoreOpen', exportedKey || null),
  },
  // Window controls (frameless)
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    platform: () => ipcRenderer.invoke('window:platform'),
  },
  // Spellcheck
  spellcheck: {
    replace: (word) => ipcRenderer.invoke('spellcheck:replace', word),
    addWord: (word) => ipcRenderer.invoke('spellcheck:addWord', word),
  },
  // Event listeners (main → renderer)
  on: (channel, callback) => {
    const valid = [
      'menu-new-page',
      'menu-search',
      'menu-toggle-sidebar',
      'menu-choose-vault',
      'menu-new-sticky',
      'sticky:pageUpdated',
      'window:maximized',
      'spellcheck:context',
    ]
    if (valid.includes(channel)) {
      ipcRenderer.on(channel, callback)
      return () => ipcRenderer.removeListener(channel, callback)
    }
  },
})
