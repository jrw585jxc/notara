// Notara — Electron Main Process
if (require('electron-squirrel-startup')) { process.exit(0) }

const { app, BrowserWindow, ipcMain, dialog, shell, Menu, Tray, nativeImage, session } = require('electron')
const path = require('path')
const fs = require('fs')

// ── Offline spell checker (nspell + bundled en_US dictionary) ─────────────
let _spellChecker = null
function getSpellChecker() {
  if (_spellChecker) return _spellChecker
  try {
    // Use explicit paths so resolution works the same inside an asar archive
    // and in plain dev mode.
    const nspellPath = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'nspell', 'lib', 'index.js')
      : path.join(__dirname, '..', 'node_modules', 'nspell', 'lib', 'index.js')
    const dictDir = app.isPackaged
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dictionaries')
      : path.join(__dirname, '..', 'dictionaries')
    const nspell = require(nspellPath)
    const aff = fs.readFileSync(path.join(dictDir, 'en_US.aff'))
    const dic = fs.readFileSync(path.join(dictDir, 'en_US.dic'))
    _spellChecker = nspell({ aff, dic })
    console.log('[spellcheck] Dictionary loaded OK')
  } catch (e) {
    console.error('[spellcheck] Failed to load dictionary:', e.message)
  }
  return _spellChecker
}
// Pre-load eagerly so the first right-click has no delay
app.whenReady().then(() => getSpellChecker())

const isDev = process.env.NODE_ENV === 'development'
const isMac = process.platform === 'darwin'
const PREFS_PATH = path.join(app.getPath('userData'), 'notara-prefs.json')

let mainWindow = null
let tray = null
const stickyWindows = new Map()
const stickyKeyMap = new Map() // noteId → exported AES key bytes (ArrayBuffer)

// ── Single-instance lock ──────────────────────────────────────
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) { app.quit(); process.exit(0) }

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

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

// ── Icon helpers (asar-safe) ──────────────────────────────────
// nativeImage.createFromPath() silently returns empty inside an asar archive.
// Always read the buffer ourselves and use createFromBuffer instead.
function getIconDir() {
  if (isDev) return path.join(__dirname, '..', 'build-resources')
  // electron-forge asarUnpack extracts build-resources next to the asar
  const unpacked = path.join(process.resourcesPath, 'app.asar.unpacked', 'build-resources')
  if (fs.existsSync(unpacked)) return unpacked
  // Fallback: inside the asar (icon loads may silently fail on Windows)
  return path.join(__dirname, '..', 'build-resources')
}

function makeTrayIcon() {
  const iconDir = getIconDir()
  const candidates = isMac
    ? ['icon_16x16.png', 'icon_32x32.png', 'icon.png']
    : ['icon.ico', 'icon_32x32.png', 'icon_16x16.png', 'icon.png']
  for (const name of candidates) {
    const p = path.join(iconDir, name)
    try {
      if (!fs.existsSync(p)) continue
      const img = nativeImage.createFromBuffer(fs.readFileSync(p))
      if (img.isEmpty()) continue
      if (isMac) { img.setTemplateImage(true); return img.resize({ width: 16, height: 16 }) }
      return img
    } catch {}
  }
  return nativeImage.createEmpty()
}

// ── Window ────────────────────────────────────────────────────
function createWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show(); mainWindow.focus(); return
  }
  const prefs = loadPrefs()

  const winOpts = {
    width: prefs.width || 1280,
    height: prefs.height || 800,
    minWidth: 760,
    minHeight: 500,
    icon: (() => {
      const iconDir = getIconDir()
      const icoPath = path.join(iconDir, 'icon.ico')
      const pngPath = path.join(iconDir, 'icon.png')
      try {
        if (process.platform === 'win32' && fs.existsSync(icoPath))
          return nativeImage.createFromBuffer(fs.readFileSync(icoPath))
        if (fs.existsSync(pngPath))
          return nativeImage.createFromBuffer(fs.readFileSync(pngPath))
      } catch {}
      return undefined
    })(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  }

  if (isMac) {
    winOpts.titleBarStyle = 'hiddenInset'
    winOpts.trafficLightPosition = { x: 12, y: 13 }
  } else {
    winOpts.frame = false
    winOpts.backgroundColor = '#ffffff'
  }

  mainWindow = new BrowserWindow(winOpts)

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist-renderer/index.html'))
  }

  // Enable spellcheck
  mainWindow.webContents.session.setSpellCheckerEnabled(true)
  if (!isMac) mainWindow.webContents.session.setSpellCheckerLanguages(['en-US', 'en-GB'])

  // Spellcheck suggestions are now fetched on-demand via spellcheck:check IPC
  // (webContents.isWordMisspelled / getWordSuggestions) — no context-menu
  // listener needed here.

  // Notify renderer when maximize state changes
  mainWindow.on('maximize',   () => mainWindow?.webContents.send('window:maximized', true))
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized', false))

  mainWindow.on('close', () => {
    if (!mainWindow.isDestroyed()) {
      const [w, h] = mainWindow.getSize()
      savePrefs({ ...loadPrefs(), width: w, height: h })
    }
  })
  mainWindow.on('closed', () => { mainWindow = null })

  buildMenu()

  // Hide menu bar on Windows/Linux (Alt key reveals it)
  if (!isMac) mainWindow.setMenuBarVisibility(false)
}

// ── Menu ──────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'New Page',        accelerator: 'CmdOrCtrl+N',       click: () => mainWindow?.webContents.send('menu-new-page') },
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
        { label: 'Search',         accelerator: 'CmdOrCtrl+K',  click: () => mainWindow?.webContents.send('menu-search') },
        { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+\\', click: () => mainWindow?.webContents.send('menu-toggle-sidebar') },
        { type: 'separator' },
        { role: 'reload' }, { role: 'toggleDevTools' },
      ],
    },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ── Tray ──────────────────────────────────────────────────────
function createTray() {
  if (tray && !tray.isDestroyed()) return
  tray = new Tray(makeTrayIcon())
  tray.setToolTip('Notara')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Notara', click: () => { if (!mainWindow || mainWindow.isDestroyed()) createWindow(); else { mainWindow.show(); mainWindow.focus() } } },
    { label: 'New Sticky Note', click: () => { if (!mainWindow || mainWindow.isDestroyed()) { createWindow(); setTimeout(() => mainWindow?.webContents.send('menu-new-sticky'), 1500) } else { mainWindow.show(); mainWindow.webContents.send('menu-new-sticky') } } },
    { type: 'separator' },
    { label: 'Quit Notara', click: () => { app.isQuitting = true; app.quit() } },
  ]))
  tray.on('click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow()
    else { mainWindow.show(); mainWindow.focus() }
  })
  tray.on('double-click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) createWindow()
    else { mainWindow.show(); mainWindow.focus() }
  })
}

// ── IPC: Window controls ──────────────────────────────────────
ipcMain.handle('window:minimize',    () => mainWindow?.minimize())
ipcMain.handle('window:maximize',    () => { if (!mainWindow) return false; if (mainWindow.isMaximized()) { mainWindow.unmaximize(); return false } mainWindow.maximize(); return true })
ipcMain.handle('window:close',       () => mainWindow?.close())
ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() ?? false)
ipcMain.handle('window:platform',    () => process.platform)

// ── IPC: Vault ────────────────────────────────────────────────
ipcMain.handle('vault:select', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'], title: 'Choose your Notara vault folder', buttonLabel: 'Use this folder' })
  if (result.canceled) return null
  const vaultPath = result.filePaths[0]
  savePrefs({ ...loadPrefs(), vault: vaultPath })
  return vaultPath
})
ipcMain.handle('vault:get', () => loadPrefs().vault || null)
ipcMain.handle('vault:set', (_, vaultPath) => { savePrefs({ ...loadPrefs(), vault: vaultPath }); return true })

// Read/write the per-vault encryption config (stores salt + verification token)
ipcMain.handle('vault:readEncConfig', (_, vaultPath) => {
  try {
    const p = path.join(vaultPath, '_notara-enc.json')
    if (!fs.existsSync(p)) return null
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch { return null }
})
ipcMain.handle('vault:writeEncConfig', (_, { vaultPath, config }) => {
  try {
    fs.writeFileSync(path.join(vaultPath, '_notara-enc.json'), JSON.stringify(config, null, 2), 'utf-8')
    return true
  } catch { return false }
})

// ── IPC: Pages ────────────────────────────────────────────────
ipcMain.handle('pages:readAll', async (_, vaultPath) => {
  try {
    if (!vaultPath || !fs.existsSync(vaultPath)) return []
    const files = fs.readdirSync(vaultPath).filter(f => f.endsWith('.md'))
    return files.map(filename => {
      try { return { filename, content: fs.readFileSync(path.join(vaultPath, filename), 'utf-8') } }
      catch { return null }
    }).filter(Boolean)
  } catch { return [] }
})
ipcMain.handle('pages:write', async (_, { vaultPath, filename, content, oldFilename }) => {
  try {
    if (!vaultPath) return { ok: false, error: 'No vault selected' }
    fs.mkdirSync(vaultPath, { recursive: true })
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
    filters: [{ name: 'Text files', extensions: ['md', 'txt', 'html', 'htm'] }, { name: 'All files', extensions: ['*'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  try {
    const filePath = result.filePaths[0]
    return { filename: path.basename(filePath), content: fs.readFileSync(filePath, 'utf-8'), ext: path.extname(filePath).toLowerCase().replace('.', '') }
  } catch { return null }
})
ipcMain.handle('pages:exportMd', async (_, { content, suggestedName }) => {
  const result = await dialog.showSaveDialog(mainWindow, { title: 'Export as Markdown', defaultPath: suggestedName, filters: [{ name: 'Markdown', extensions: ['md'] }] })
  if (result.canceled || !result.filePath) return false
  try { fs.writeFileSync(result.filePath, content, 'utf-8'); return true } catch { return false }
})
ipcMain.handle('pages:exportHtml', async (_, { content, suggestedName }) => {
  const result = await dialog.showSaveDialog(mainWindow, { title: 'Export as HTML', defaultPath: suggestedName, filters: [{ name: 'HTML', extensions: ['html'] }] })
  if (result.canceled || !result.filePath) return false
  try { fs.writeFileSync(result.filePath, content, 'utf-8'); return true } catch { return false }
})
ipcMain.handle('pages:exportPdf', async (_, suggestedName) => {
  const result = await dialog.showSaveDialog(mainWindow, { title: 'Export as PDF', defaultPath: suggestedName, filters: [{ name: 'PDF', extensions: ['pdf'] }] })
  if (result.canceled || !result.filePath) return false
  try { fs.writeFileSync(result.filePath, await mainWindow.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: { top: 1, bottom: 1, left: 1, right: 1, marginType: 'custom' } })); return true } catch { return false }
})

// ── IPC: Media ────────────────────────────────────────────────
const MEDIA_MIME = {
  png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif',
  webp:'image/webp', svg:'image/svg+xml', avif:'image/avif',
  mp4:'video/mp4', webm:'video/webm', mov:'video/quicktime', mkv:'video/x-matroska',
  mp3:'audio/mpeg', wav:'audio/wav', ogg:'audio/ogg', m4a:'audio/mp4', flac:'audio/flac',
}
ipcMain.handle('media:importFile', async (_, { vaultPath, fileType }) => {
  const filters = { image:[{name:'Images',extensions:['png','jpg','jpeg','gif','webp','svg','avif']}], video:[{name:'Videos',extensions:['mp4','webm','mov','mkv']}], audio:[{name:'Audio',extensions:['mp3','wav','ogg','m4a','flac']}], file:[{name:'All files',extensions:['*']}] }[fileType] || [{name:'All files',extensions:['*']}]
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters })
  if (result.canceled || !result.filePaths.length) return null
  try {
    const srcPath = result.filePaths[0]
    const ext = path.extname(srcPath).toLowerCase().slice(1)
    const mimeType = MEDIA_MIME[ext] || 'application/octet-stream'
    const filename = path.basename(srcPath)
    const mediaDir = path.join(vaultPath, '_media')
    if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true })
    const destPath = path.join(mediaDir, filename)
    fs.copyFileSync(srcPath, destPath)
    const { pathToFileURL } = require('url')
    return { src: pathToFileURL(destPath).href, name: filename, mimeType }
  } catch { return null }
})

// Save raw buffer from clipboard paste
ipcMain.handle('media:saveBuffer', async (_, { vaultPath, filename, buffer }) => {
  try {
    const mediaDir = path.join(vaultPath, '_media')
    if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true })
    const destPath = path.join(mediaDir, filename)
    fs.writeFileSync(destPath, Buffer.from(buffer))
    const { pathToFileURL } = require('url')
    const ext = path.extname(filename).toLowerCase().slice(1)
    return { src: pathToFileURL(destPath).href, name: filename, mimeType: MEDIA_MIME[ext] || 'application/octet-stream' }
  } catch (e) { return null }
})

ipcMain.handle('bookmark:fetch', async (_, url) => {
  const fallback = { url, title: url, description: '', favicon: '' }
  try {
    const { net } = require('electron')
    return await new Promise((resolve) => {
      const req = net.request({ url, redirect: 'follow' })
      let data = ''; let resolved = false
      const done = (r) => { if (!resolved) { resolved = true; resolve(r) } }
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
  const title = get(/<title[^>]*>([^<]{1,200})<\/title>/i) || get(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']{1,200})["']/i) || url
  const description = get(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']{1,400})["']/i) || get(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']{1,400})["']/i) || ''
  let favicon = get(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i) || get(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i)
  if (favicon && !favicon.startsWith('http')) { try { favicon = new URL(favicon, url).href } catch { favicon = '' } }
  if (!favicon) { try { favicon = new URL('/favicon.ico', url).href } catch {} }
  return { url, title: title.replace(/\s+/g, ' '), description: description.replace(/\s+/g, ' '), favicon }
}

// ── IPC: Shell ────────────────────────────────────────────────
ipcMain.handle('shell:openVault', async (_, vaultPath) => { if (vaultPath) shell.openPath(vaultPath) })

// ── IPC: Prefs (PIN / encryption) ────────────────────────────
ipcMain.handle('prefs:getPinData', () => {
  const prefs = loadPrefs()
  // Support both new key names (salt, verificationToken) and legacy (pinSalt, pinVerificationToken)
  return {
    salt: prefs.salt || prefs.pinSalt || null,
    verificationToken: prefs.verificationToken || prefs.pinVerificationToken || null,
    wrappedMasterKey: prefs.wrappedMasterKey || null,
  }
})
ipcMain.handle('prefs:setPinData', (_, data) => { savePrefs({ ...loadPrefs(), ...data }) })
ipcMain.handle('prefs:clearPinData', () => {
  const prefs = loadPrefs()
  // Clear both old and new key names
  delete prefs.salt; delete prefs.verificationToken; delete prefs.wrappedMasterKey
  delete prefs.pinSalt; delete prefs.pinVerificationToken
  savePrefs(prefs)
})

// ── IPC: Sticky notes ─────────────────────────────────────────
function openStickyWindow(id, exportedKey) {
  if (exportedKey) stickyKeyMap.set(id, exportedKey)
  if (stickyWindows.has(id)) {
    const existing = stickyWindows.get(id)
    if (!existing.isDestroyed()) { existing.show(); existing.focus(); return }
    stickyWindows.delete(id)
  }
  const win = new BrowserWindow({
    width: 300, height: 380, minWidth: 200, minHeight: 160,
    frame: false, transparent: false, resizable: true,
    alwaysOnTop: false, skipTaskbar: false, backgroundColor: '#fef9c3',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: false },
  })
  if (isDev) win.loadURL('http://localhost:5173/?sticky=' + encodeURIComponent(id))
  else win.loadFile(path.join(__dirname, '../dist-renderer/index.html'), { query: { sticky: id } })
  win.on('closed', () => { stickyWindows.delete(id); stickyKeyMap.delete(id) })
  stickyWindows.set(id, win)
}

ipcMain.handle('sticky:open', async (_, { id, exportedKey }) => openStickyWindow(id, exportedKey || null))
ipcMain.handle('sticky:getKey', (_, id) => stickyKeyMap.get(id) || null)
ipcMain.handle('sticky:restoreOpen', async (_, exportedKey) => {
  // Re-open all sticky windows that were open before a PIN-lock. Called after unlock.
  for (const id of stickyWindows.keys()) {
    openStickyWindow(id, exportedKey || null)
  }
})
ipcMain.handle('sticky:close', (event) => { const win = BrowserWindow.fromWebContents(event.sender); if (win) win.close() })
ipcMain.handle('sticky:setAlwaysOnTop', (event, alwaysOnTop) => { const win = BrowserWindow.fromWebContents(event.sender); if (win) win.setAlwaysOnTop(alwaysOnTop, 'floating') })
ipcMain.handle('sticky:syncPage', (_, page) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('sticky:pageUpdated', page) })

// ── IPC: Spellcheck ───────────────────────────────────────────
ipcMain.handle('spellcheck:replace', (_, word) => mainWindow?.webContents.replaceMisspelling(word))
ipcMain.handle('spellcheck:addWord', (_, word) => mainWindow?.webContents.session.addWordToSpellCheckerDictionary(word))
// Check a word using the bundled offline dictionary
ipcMain.handle('spellcheck:check', (_, word) => {
  if (!word) return { isMisspelled: false, suggestions: [] }
  const spell = getSpellChecker()
  if (!spell) return { isMisspelled: false, suggestions: [] }
  const isMisspelled = !spell.correct(word)
  const suggestions = isMisspelled ? spell.suggest(word).slice(0, 6) : []
  return { isMisspelled, suggestions }
})

// ── App lifecycle ─────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()
  createTray()

  // Fix Windows Settings icon: Squirrel sets DisplayIcon → Update.exe; override with Notara.exe
  if (process.platform === 'win32' && app.isPackaged) {
    try {
      const { execFileSync } = require('child_process')
      const exePath = app.getPath('exe')
      const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Notara'
      execFileSync('reg', ['add', regKey, '/v', 'DisplayIcon', '/t', 'REG_SZ', '/d', exePath, '/f'], { windowsHide: true })
    } catch (e) {
      console.warn('[icon] DisplayIcon registry update failed:', e.message)
    }
  }
})

app.on('window-all-closed', () => {
  // Stay alive in tray; quit via tray menu
})

app.on('activate', () => {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow()
  else { mainWindow.show(); mainWindow.focus() }
})

app.on('before-quit', () => {
  app.isQuitting = true
  if (tray && !tray.isDestroyed()) { tray.destroy(); tray = null }
})
