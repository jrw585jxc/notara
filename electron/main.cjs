// Notara — Electron Main Process
// Handle Squirrel installer events on Windows (required for electron-forge)
if (require('electron-squirrel-startup')) { process.exit(0) }

const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const isDev = process.env.NODE_ENV === 'development'
const PREFS_PATH = path.join(app.getPath('userData'), 'notara-prefs.json')

let mainWindow = null

// ── Preferences ──────────────────────────────────────────────
function loadPrefs() {
  try {
    if (fs.existsSync(PREFS_PATH)) return JSON.parse(fs.readFileSync(PREFS_PATH, 'utf-8'))
  } catch {}
  return {}
}

function savePrefs(prefs) {
  try { fs.writeFileSync(PREFS_PATH, JSON.stringify(prefs, null, 2), 'utf-8') } catch {}
}

// ── Window ────────────────────────────────────────────────────
function createWindow() {
  const prefs = loadPrefs()

  mainWindow = new BrowserWindow({
    width: prefs.width || 1280,
    height: prefs.height || 800,
    minWidth: 760,
    minHeight: 500,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'))
  }

  // Save window size on close
  mainWindow.on('close', () => {
    const [w, h] = mainWindow.getSize()
    savePrefs({ ...loadPrefs(), width: w, height: h })
  })

  buildMenu()
}

// ── Menu ──────────────────────────────────────────────────────
function buildMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Page', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu-new-page') },
        { type: 'separator' },
        { label: 'Choose Vault Folder…', click: () => mainWindow?.webContents.send('menu-choose-vault') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Search', accelerator: 'CmdOrCtrl+K', click: () => mainWindow?.webContents.send('menu-search') },
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: () => mainWindow?.webContents.send('menu-toggle-sidebar') },
        { type: 'separator' },
        { role: 'reload' }, { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── IPC: Vault ────────────────────────────────────────────────
ipcMain.handle('vault:select', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose your Notara vault folder',
    buttonLabel: 'Use this folder',
  })
  if (result.canceled) return null
  const vaultPath = result.filePaths[0]
  savePrefs({ ...loadPrefs(), vault: vaultPath })
  return vaultPath
})

ipcMain.handle('vault:get', () => {
  return loadPrefs().vault || null
})

ipcMain.handle('vault:set', (_, vaultPath) => {
  savePrefs({ ...loadPrefs(), vault: vaultPath })
  return true
})

// ── IPC: Pages ────────────────────────────────────────────────
ipcMain.handle('pages:readAll', async (_, vaultPath) => {
  try {
    if (!vaultPath || !fs.existsSync(vaultPath)) return []
    const files = fs.readdirSync(vaultPath).filter(f => f.endsWith('.md'))
    return files.map(filename => {
      try {
        const content = fs.readFileSync(path.join(vaultPath, filename), 'utf-8')
        return { filename, content }
      } catch { return null }
    }).filter(Boolean)
  } catch { return [] }
})

ipcMain.handle('pages:write', async (_, { vaultPath, id, content }) => {
  try {
    if (!vaultPath) return { ok: false, error: 'No vault selected' }
    fs.mkdirSync(vaultPath, { recursive: true })
    fs.writeFileSync(path.join(vaultPath, `${id}.md`), content, 'utf-8')
    return { ok: true }
  } catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('pages:delete', async (_, { vaultPath, id }) => {
  try {
    const filepath = path.join(vaultPath, `${id}.md`)
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath)
    return { ok: true }
  } catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('pages:readOne', async (_, { vaultPath, id }) => {
  try {
    const filepath = path.join(vaultPath, `${id}.md`)
    if (!fs.existsSync(filepath)) return null
    return fs.readFileSync(filepath, 'utf-8')
  } catch { return null }
})

// ── IPC: Shell ────────────────────────────────────────────────
ipcMain.handle('shell:openVault', async (_, vaultPath) => {
  if (vaultPath) shell.openPath(vaultPath)
})

// ── App lifecycle ─────────────────────────────────────────────
app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
