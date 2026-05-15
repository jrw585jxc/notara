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
    write: (vaultPath, id, content) => ipcRenderer.invoke('pages:write', { vaultPath, id, content }),
    delete: (vaultPath, id) => ipcRenderer.invoke('pages:delete', { vaultPath, id }),
  },
  // Menu events
  on: (channel, callback) => {
    const valid = ['menu-new-page', 'menu-search', 'menu-toggle-sidebar', 'menu-choose-vault']
    if (valid.includes(channel)) {
      ipcRenderer.on(channel, callback)
      return () => ipcRenderer.removeListener(channel, callback)
    }
  },
})
