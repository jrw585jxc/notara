// Notara — Electron Main Process
// Handle Squirrel installer events on Windows (required for electron-forge)
if (require('electron-squirrel-startup')) { process.exit(0) }

const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')
const os = require('os')

const isDev = process.env.NODE_ENV === 'development'
const PREFS_PATH = path.join(app.getPath('userData'), 'notara-prefs.json')

let mainWindow = null
let tray = null
const stickyWindows = new Map() // noteId -> BrowserWindow

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
    icon: path.join(__dirname, '../build-resources/icon.png'),
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
        { label: 'New Sticky Note', accelerator: 'CmdOrCtrl+Shift+N', click: () => mainWindow?.webContents.send('menu-new-sticky') },
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

ipcMain.handle('pages:write', async (_, { vaultPath, filename, content, oldFilename }) => {
  try {
    if (!vaultPath) return { ok: false, error: 'No vault selected' }
    fs.mkdirSync(vaultPath, { recursive: true })
    // Rename: delete old file if filename changed
    if (oldFilename && oldFilename !== filename) {
      const oldPath = path.join(vaultPath, oldFilename)
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }
    fs.writeFileSync(path.join(vaultPath, filename), content, 'utf-8')
    return { ok: true }
  } catch (e) { return { ok: false, error: e.message } }
})

ipcMain.handle('pages:delete', async (_, { vaultPath, filename }) => {
  try {
    const filepath = path.join(vaultPath, filename)
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

// ── IPC: Import / Export ──────────────────────────────────────
ipcMain.handle('pages:importFile', async (_, vaultPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import note',
    filters: [
      { name: 'Text files', extensions: ['md', 'txt', 'html', 'htm'] },
      { name: 'All files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  try {
    const filePath = result.filePaths[0]
    const content = fs.readFileSync(filePath, 'utf-8')
    const ext = path.extname(filePath).toLowerCase().replace('.', '')
    const filename = path.basename(filePath)
    return { filename, content, ext }
  } catch (e) { return null }
})

ipcMain.handle('pages:exportMd', async (_, { content, suggestedName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export as Markdown',
    defaultPath: suggestedName,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  })
  if (result.canceled || !result.filePath) return false
  try { fs.writeFileSync(result.filePath, content, 'utf-8'); return true }
  catch { return false }
})

ipcMain.handle('pages:exportHtml', async (_, { content, suggestedName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export as HTML',
    defaultPath: suggestedName,
    filters: [{ name: 'HTML', extensions: ['html'] }],
  })
  if (result.canceled || !result.filePath) return false
  try { fs.writeFileSync(result.filePath, content, 'utf-8'); return true }
  catch { return false }
})

ipcMain.handle('pages:exportPdf', async (_, suggestedName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Export as PDF',
    defaultPath: suggestedName,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (result.canceled || !result.filePath) return false
  try {
    const pdfPath = result.filePath
    const data = await mainWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 1, bottom: 1, left: 1, right: 1, marginType: 'custom' },
    })
    fs.writeFileSync(pdfPath, data)
    return true
  } catch { return false }
})

// ── IPC: Media ────────────────────────────────────────────────
const MEDIA_MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac',
}

ipcMain.handle('media:importFile', async (_, { vaultPath, fileType }) => {
  const filters = {
    image: [{ name: 'Images', extensions: ['png','jpg','jpeg','gif','webp','svg','avif'] }],
    video: [{ name: 'Videos', extensions: ['mp4','webm','mov','mkv'] }],
    audio: [{ name: 'Audio',  extensions: ['mp3','wav','ogg','m4a','flac'] }],
    file:  [{ name: 'All files', extensions: ['*'] }],
  }[fileType] || [{ name: 'All files', extensions: ['*'] }]

  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters })
  if (result.canceled || !result.filePaths.length) return null

  try {
    const srcPath = result.filePaths[0]
    const ext = path.extname(srcPath).toLowerCase().slice(1)
    const mimeType = MEDIA_MIME[ext] || 'application/octet-stream'
    const filename = path.basename(srcPath)

    // Copy to vault/_media/
    const mediaDir = path.join(vaultPath, '_media')
    if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true })
    const destPath = path.join(mediaDir, filename)
    fs.copyFileSync(srcPath, destPath)

    // Return file:// URL so renderer can display it
    const { pathToFileURL } = require('url')
    return { src: pathToFileURL(destPath).href, name: filename, mimeType }
  } catch (e) { return null }
})

ipcMain.handle('bookmark:fetch', async (_, url) => {
  const fallback = { url, title: url, description: '', favicon: '' }
  try {
    const { net } = require('electron')
    return await new Promise((resolve) => {
      const req = net.request({ url, redirect: 'follow' })
      let data = ''
      let resolved = false

      const done = (result) => { if (!resolved) { resolved = true; resolve(result) } }

      req.on('response', (response) => {
        response.on('data', chunk => { data += chunk.toString(); if (data.length > 200000) done(parse(data, url)) })
        response.on('end', () => done(parse(data, url)))
        response.on('error', () => done(fallback))
      })
      req.on('error', () => done(fallback))
      req.setTimeout(8000, () => done(fallback))
      req.end()
    })
  } catch { return fallback }
})

function parse(html, url) {
  const get = (pattern) => { const m = html.match(pattern); return m ? m[1].trim() : '' }
  const title = get(/<title[^>]*>([^<]{1,200})<\/title>/i)
    || get(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']{1,200})["']/i)
    || url
  const description = get(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']{1,400})["']/i)
    || get(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']{1,400})["']/i)
    || ''
  let favicon = get(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i)
    || get(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i)
  if (favicon && !favicon.startsWith('http')) {
    try { favicon = new URL(favicon, url).href } catch { favicon = '' }
  }
  if (!favicon) {
    try { favicon = new URL('/favicon.ico', url).href } catch {}
  }
  return { url, title: title.replace(/\s+/g, ' '), description: description.replace(/\s+/g, ' '), favicon }
}

// ── IPC: Shell ────────────────────────────────────────────────
ipcMain.handle('shell:openVault', async (_, vaultPath) => {
  if (vaultPath) shell.openPath(vaultPath)
})

// ── IPC: Prefs (PIN encryption) ───────────────────────────────
ipcMain.handle('prefs:getPinData', () => {
  const prefs = loadPrefs()
  return {
    salt: prefs.pinSalt || null,
    verificationToken: prefs.pinVerificationToken || null,
  }
})

ipcMain.handle('prefs:setPinData', (_, { salt, verificationToken }) => {
  savePrefs({ ...loadPrefs(), pinSalt: salt, pinVerificationToken: verificationToken })
})

ipcMain.handle('prefs:clearPinData', () => {
  const prefs = loadPrefs()
  delete prefs.pinSalt
  delete prefs.pinVerificationToken
  savePrefs(prefs)
})

// ── Tray ──────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, '../build-resources/icon_16x16.png')
  let icon
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) throw new Error('empty')
    if (process.platform === 'darwin') icon = icon.resize({ width: 16, height: 16 })
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('Notara')

  const menu = Menu.buildFromTemplate([
    {
      label: 'Show Notara',
      click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus() }
        else createWindow()
      },
    },
    {
      label: 'New Sticky Note',
      click: () => {
        if (mainWindow) {
          mainWindow.show()
          mainWindow.webContents.send('menu-new-sticky')
        } else {
          createWindow()
          setTimeout(() => mainWindow && mainWindow.webContents.send('menu-new-sticky'), 1500)
        }
      },
    },
    { type: 'separator' },
    { label: 'Quit Notara', click: () => { tray = null; app.quit() } },
  ])
  tray.setContextMenu(menu)

  tray.on('click', () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus() }
    else createWindow()
  })
}

// ── IPC: Sticky notes ─────────────────────────────────────────
ipcMain.handle('sticky:open', async (_, id) => {
  if (stickyWindows.has(id)) {
    const existing = stickyWindows.get(id)
    if (!existing.isDestroyed()) { existing.show(); existing.focus(); return }
    stickyWindows.delete(id)
  }

  const win = new BrowserWindow({
    width: 300,
    height: 380,
    minWidth: 200,
    minHeight: 160,
    frame: false,
    transparent: false,
    resizable: true,
    alwaysOnTop: false,
    skipTaskbar: false,
    backgroundColor: '#fef9c3',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173/?sticky=' + encodeURIComponent(id))
  } else {
    win.loadFile(path.join(__dirname, '../dist-renderer/index.html'), {
      query: { sticky: id },
    })
  }

  win.on('closed', () => stickyWindows.delete(id))
  stickyWindows.set(id, win)
})

ipcMain.handle('sticky:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) win.close()
})

ipcMain.handle('sticky:setAlwaysOnTop', (event, alwaysOnTop) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win) win.setAlwaysOnTop(alwaysOnTop, 'floating')
})

// ── App lifecycle ─────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  createTray()
})

app.on('window-all-closed', () => {
  // Keep alive in tray so sticky notes persist; quit is in the tray menu
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().filter(w => !w.isDestroyed()).length === 0) createWindow()
})

app.on('before-quit', () => {
  if (tray) { tray.destroy(); tray = null }
})
