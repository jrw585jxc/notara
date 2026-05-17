import { create } from 'zustand'
import { type Page, type Theme, type FontFamily, type PageKind } from '../types'
import { createNewPage, markdownToPage, pageToMarkdown, getAllDescendantIds, slugifyFilename } from '../lib/pageUtils'
import {
  deriveMasterKey, derivePinKey, generateSalt, saltToBase64, saltFromBase64,
  encryptText, decryptText, createVerificationToken, verifyKey,
  wrapMasterKey, unwrapMasterKey,
} from '../lib/crypto'

const isElectron = typeof window !== 'undefined' && typeof (window as any).notara !== 'undefined'

const LS_PAGES = 'notara:pages'
const LS_VAULT = 'notara:vault'
const LS_THEME = 'notara:theme'
const LS_DEV_MODE = 'notara:devMode'
const lsGetPages = (): Page[] => { try { return JSON.parse(localStorage.getItem(LS_PAGES) || '[]') } catch { return [] } }
const lsSetPages = (p: Page[]) => { try { localStorage.setItem(LS_PAGES, JSON.stringify(p)) } catch {} }

interface Store {
  pages: Page[]
  activePageId: string | null
  vault: string | null
  theme: Theme
  sidebarCollapsed: boolean
  searchOpen: boolean
  isLoading: boolean
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'

  // Dev mode
  devMode: boolean
  cursorLine: number

  // Encryption (master password + optional per-device PIN)
  pinEnabled: boolean          // true = vault has _notara-enc.json
  pinLocked: boolean           // true = waiting for unlock
  hasDevicePin: boolean        // true = this device has a wrapped master key (PIN shortcut)
  cryptoKey: CryptoKey | null
  pinError: string | null

  initVault: () => Promise<void>
  selectVault: () => Promise<void>
  loadPages: () => Promise<void>
  setActivePage: (id: string | null) => void
  createPage: (parentId?: string | null, kind?: PageKind) => Page
  updatePage: (id: string, updates: Partial<Page>, save?: boolean) => void
  deletePage: (id: string) => Promise<void>
  savePage: (id: string) => Promise<void>
  reorderPage: (id: string, newParentId: string | null, newOrder: number) => void
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setSearchOpen: (open: boolean) => void
  setPageFont: (id: string, fontFamily: FontFamily) => void
  toggleFullWidth: (id: string) => void

  // Dev mode
  toggleDevMode: () => void
  setCursorLine: (line: number) => void

  // Encryption
  checkPinStatus: () => Promise<void>
  setupEncryption: (masterPassword: string, pin?: string) => Promise<void>
  unlockWithMasterPassword: (password: string) => Promise<boolean>
  unlockWithPin: (pin: string) => Promise<boolean>
  setupPinForDevice: (pin: string) => Promise<void>
  disableEncryption: (masterPassword: string) => Promise<boolean>
  lockApp: () => void
  // Legacy compat
  setupPin: (pin: string) => Promise<void>
  disablePin: (pin: string) => Promise<boolean>

  // Sticky notes
  createStickyNote: () => Promise<void>
  openStickyNote: (id: string) => Promise<void>
  syncPageFromSticky: (updatedPage: Page) => void

  // Import / Export
  importPage: () => Promise<void>
  exportCurrentMd: () => Promise<void>
  exportCurrentHtml: () => Promise<void>
  exportCurrentPdf: () => Promise<void>
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export const useStore = create<Store>((set, get) => ({
  pages: [],
  activePageId: null,
  vault: null,
  theme: (localStorage.getItem(LS_THEME) as Theme) || 'system',
  sidebarCollapsed: false,
  searchOpen: false,
  isLoading: false,
  saveStatus: 'idle',
  devMode: localStorage.getItem(LS_DEV_MODE) === 'true',
  cursorLine: 1,
  pinEnabled: false,
  pinLocked: false,
  hasDevicePin: false,
  cryptoKey: null,
  pinError: null,

  initVault: async () => {
    set({ isLoading: true })
    let vault: string | null = null
    if (isElectron) vault = await (window as any).notara.vault.get()
    else vault = localStorage.getItem(LS_VAULT)

    if (vault) {
      set({ vault })
      // Check if PIN is set before loading pages
      await get().checkPinStatus()
      if (!get().pinLocked) {
        await get().loadPages()
      }
    }
    set({ isLoading: false })
  },

  selectVault: async () => {
    let vault: string | null = null
    if (isElectron) vault = await (window as any).notara.vault.select()
    else { vault = 'browser-vault'; localStorage.setItem(LS_VAULT, vault) }
    if (!vault) return
    set({ vault, pages: [] })
    await get().loadPages()
  },

  checkPinStatus: async () => {
    if (!isElectron) return
    const { vault } = get()

    // New scheme: vault stores _notara-enc.json
    if (vault) {
      const encConfig = await (window as any).notara.vault.readEncConfig(vault)
      if (encConfig?.salt && encConfig?.verificationToken) {
        // Check if this device has a PIN-wrapped master key
        const prefs = await (window as any).notara.prefs.getPinData()
        const hasPin = !!(prefs.wrappedMasterKey && prefs.salt)
        set({ pinEnabled: true, pinLocked: true, hasDevicePin: hasPin })
        return
      }
    }

    // Legacy fallback: prefs-based salt (old scheme — treat as not encrypted to avoid lockout)
    set({ pinEnabled: false, pinLocked: false, hasDevicePin: false })
  },

  loadPages: async () => {
    const { vault, cryptoKey } = get()
    if (!vault) return
    set({ isLoading: true })
    let pages: Page[] = []
    if (isElectron) {
      const files = await (window as any).notara.pages.readAll(vault) as Array<{ filename: string; content: string }>
      const parsed = await Promise.all(files.map(async (f) => {
        let raw = f.content
        // Decrypt if key is set
        if (cryptoKey) {
          try { raw = await decryptText(raw, cryptoKey) }
          catch { return null } // skip files that fail decryption
        }
        return markdownToPage(raw, f.filename)
      }))
      pages = parsed.filter((p): p is Page => p !== null)
    } else {
      pages = lsGetPages()
    }

    if (pages.length === 0) {
      const welcome = createNewPage(null, 0)
      welcome.title = 'Welcome to Notara'
      welcome.emoji = '\u{1F44B}'
      welcome.content = '<h1>Welcome to Notara</h1><p>This is your private, offline workspace.</p><h2>Getting started</h2><ul><li><p>Click <strong>+</strong> in the sidebar to create pages</p></li><li><p>Type <strong>/</strong> in the editor for block commands</p></li><li><p>Press <strong>Ctrl/Cmd+K</strong> to search all pages</p></li></ul><p>Notes are stored as plain <code>.md</code> files, synced by Proton Drive.</p>'
      pages = [welcome]
      if (!isElectron) lsSetPages(pages)
      else await get().savePage(welcome.id)
    }
    set({ pages, isLoading: false, activePageId: pages[0]?.id ?? null })
  },

  setActivePage: (id) => set({ activePageId: id }),

  createPage: (parentId = null, kind: PageKind = 'page') => {
    const { pages, vault, cryptoKey } = get()
    const siblings = pages.filter(p => p.parentId === parentId)
    const page = createNewPage(parentId, siblings.length, kind)
    const newPages = [...pages, page]
    set({ pages: newPages, activePageId: page.id })
    if (vault) {
      if (isElectron) {
        const write = async () => {
          let content = pageToMarkdown(page)
          if (cryptoKey) content = await encryptText(content, cryptoKey)
          // Guard: if the page was renamed while encryption was running (race with savePage),
          // skip writing the stale untitled filename to avoid leaving a phantom file on disk.
          const current = get().pages.find(p => p.id === page.id)
          if (!current || current.filename !== page.filename) return
          ;(window as any).notara.pages.write(vault, page.filename, content)
        }
        write()
      } else lsSetPages(newPages)
    }
    return page
  },

  updatePage: (id, updates, save = true) => {
    const newPages = get().pages.map(p =>
      p.id === id ? { ...p, ...updates, modified: new Date().toISOString() } : p
    )
    set({ pages: newPages })
    if (save) {
      if (saveTimer) clearTimeout(saveTimer)
      set({ saveStatus: 'saving' })
      saveTimer = setTimeout(() => get().savePage(id), 1500)
    }
  },

  savePage: async (id) => {
    const { pages, vault, cryptoKey } = get()
    if (!vault) return
    const page = pages.find(p => p.id === id)
    if (!page) return
    try {
      if (isElectron) {
        // Compute new filename from current title
        const newFilename = slugifyFilename(page.title, page.id)
        const oldFilename = page.filename !== newFilename ? page.filename : undefined

        // Update the page's filename in state if changed
        let updatedPages = pages
        if (newFilename !== page.filename) {
          updatedPages = pages.map(p => p.id === id ? { ...p, filename: newFilename } : p)
          set({ pages: updatedPages })
        }

        const updatedPage = updatedPages.find(p => p.id === id)!
        let content = pageToMarkdown({ ...updatedPage, filename: newFilename })
        if (cryptoKey) content = await encryptText(content, cryptoKey)

        await (window as any).notara.pages.write(vault, newFilename, content, oldFilename)
      } else {
        lsSetPages(pages)
      }
      set({ saveStatus: 'saved' })
      setTimeout(() => set({ saveStatus: 'idle' }), 2000)
    } catch { set({ saveStatus: 'error' }) }
  },

  deletePage: async (id) => {
    const { pages, vault, activePageId } = get()
    const idsToDelete = [id, ...getAllDescendantIds(pages, id)]
    const newPages = pages.filter(p => !idsToDelete.includes(p.id))
    const newActive = activePageId && idsToDelete.includes(activePageId) ? (newPages[0]?.id ?? null) : activePageId
    set({ pages: newPages, activePageId: newActive })
    if (vault) {
      if (isElectron) {
        for (const did of idsToDelete) {
          const p = pages.find(pg => pg.id === did)
          if (p) await (window as any).notara.pages.delete(vault, p.filename)
        }
      } else lsSetPages(newPages)
    }
  },

  reorderPage: (id, newParentId, newOrder) => {
    const newPages = get().pages.map(p =>
      p.id === id ? { ...p, parentId: newParentId, order: newOrder, modified: new Date().toISOString() } : p
    )
    set({ pages: newPages })
    get().savePage(id)
  },

  setTheme: (theme) => { localStorage.setItem(LS_THEME, theme); set({ theme }) },
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSearchOpen: (open) => set({ searchOpen: open }),

  setPageFont: (id, fontFamily) => {
    get().updatePage(id, { fontFamily })
  },

  toggleFullWidth: (id) => {
    const page = get().pages.find(p => p.id === id)
    if (page) get().updatePage(id, { fullWidth: !page.fullWidth })
  },

  // ── Dev mode ────────────────────────────────────────────────
  toggleDevMode: () => {
    const next = !get().devMode
    localStorage.setItem(LS_DEV_MODE, String(next))
    set({ devMode: next })
  },
  setCursorLine: (line) => set({ cursorLine: line }),

  // ── PIN encryption ──────────────────────────────────────────
  // ── Encryption: first-time setup ─────────────────────────────
  setupEncryption: async (masterPassword, pin) => {
    const { pages, vault } = get()
    if (!vault || !isElectron) return

    const vaultSalt = generateSalt()
    const masterKey = await deriveMasterKey(masterPassword, vaultSalt)
    const verificationToken = await createVerificationToken(masterKey)

    // Write enc config to vault (shared across all devices)
    await (window as any).notara.vault.writeEncConfig(vault, {
      salt: saltToBase64(vaultSalt),
      verificationToken,
    })

    // Re-encrypt all pages with master key
    for (const page of pages) {
      let content = pageToMarkdown(page)
      content = await encryptText(content, masterKey)
      await (window as any).notara.pages.write(vault, page.filename, content)
    }

    // Optionally set up PIN for this device
    let hasPin = false
    if (pin) {
      const pinSalt = generateSalt()
      const pinKey = await derivePinKey(pin, pinSalt)
      const wrappedMasterKey = await wrapMasterKey(masterKey, pinKey)
      await (window as any).notara.prefs.setPinData({
        salt: saltToBase64(pinSalt),
        verificationToken,
        wrappedMasterKey,
      })
      hasPin = true
    }

    set({ pinEnabled: true, pinLocked: false, hasDevicePin: hasPin, cryptoKey: masterKey, pinError: null })
  },

  // ── Unlock with master password (any device) ─────────────────
  unlockWithMasterPassword: async (password) => {
    if (!isElectron) return true
    const { vault } = get()
    if (!vault) return false

    try {
      const encConfig = await (window as any).notara.vault.readEncConfig(vault)
      if (!encConfig?.salt || !encConfig?.verificationToken) return false

      const salt = saltFromBase64(encConfig.salt)
      const key = await deriveMasterKey(password, salt)
      const valid = await verifyKey(encConfig.verificationToken, key)

      if (valid) {
        set({ cryptoKey: key, pinLocked: false, pinError: null })
        await get().loadPages()
        return true
      } else {
        set({ pinError: 'Incorrect password. Try again.' })
        return false
      }
    } catch {
      set({ pinError: 'Incorrect password. Try again.' })
      return false
    }
  },

  // ── Unlock with PIN (this device, has wrappedMasterKey) ───────
  unlockWithPin: async (pin) => {
    if (!isElectron) return true
    const { vault } = get()

    try {
      const prefs = await (window as any).notara.prefs.getPinData()
      if (!prefs.salt || !prefs.wrappedMasterKey) {
        set({ pinError: 'No PIN set for this device.' })
        return false
      }

      const pinSalt = saltFromBase64(prefs.salt)
      const pinKey = await derivePinKey(pin, pinSalt)
      const masterKey = await unwrapMasterKey(prefs.wrappedMasterKey, pinKey)

      // Verify the unwrapped key against the vault config
      const encConfig = vault ? await (window as any).notara.vault.readEncConfig(vault) : null
      if (encConfig?.verificationToken) {
        const valid = await verifyKey(encConfig.verificationToken, masterKey)
        if (!valid) {
          set({ pinError: 'Incorrect PIN. Try again.' })
          return false
        }
      }

      set({ cryptoKey: masterKey, pinLocked: false, pinError: null })
      await get().loadPages()
      return true
    } catch {
      set({ pinError: 'Incorrect PIN. Try again.' })
      return false
    }
  },

  // ── Set up PIN for this device (must be already unlocked) ────
  setupPinForDevice: async (pin) => {
    const { cryptoKey } = get()
    if (!cryptoKey || !isElectron) return

    const { vault } = get()
    const encConfig = vault ? await (window as any).notara.vault.readEncConfig(vault) : null

    const pinSalt = generateSalt()
    const pinKey = await derivePinKey(pin, pinSalt)
    const wrappedMasterKey = await wrapMasterKey(cryptoKey, pinKey)

    await (window as any).notara.prefs.setPinData({
      salt: saltToBase64(pinSalt),
      verificationToken: encConfig?.verificationToken ?? '',
      wrappedMasterKey,
    })

    set({ hasDevicePin: true, pinError: null })
  },

  // ── Disable encryption entirely ───────────────────────────────
  disableEncryption: async (masterPassword) => {
    const { pages, vault } = get()
    if (!isElectron || !vault) return false

    try {
      const encConfig = await (window as any).notara.vault.readEncConfig(vault)
      if (!encConfig?.salt || !encConfig?.verificationToken) return true

      const salt = saltFromBase64(encConfig.salt)
      const key = await deriveMasterKey(masterPassword, salt)
      const valid = await verifyKey(encConfig.verificationToken, key)
      if (!valid) {
        set({ pinError: 'Incorrect password.' })
        return false
      }

      // Re-save all pages as plaintext
      for (const page of pages) {
        const content = pageToMarkdown(page)
        await (window as any).notara.pages.write(vault, page.filename, content)
      }

      // Remove vault enc config by writing empty  (or we leave the file but clear it)
      // Write an empty marker so the file doesn't show as encrypted
      await (window as any).notara.vault.writeEncConfig(vault, { salt: '', verificationToken: '' })
      await (window as any).notara.prefs.clearPinData()

      set({ pinEnabled: false, pinLocked: false, hasDevicePin: false, cryptoKey: null, pinError: null })
      return true
    } catch {
      set({ pinError: 'Failed to disable encryption.' })
      return false
    }
  },

  // ── Legacy aliases (kept for compatibility with old UI) ───────
  setupPin: async (pin) => {
    // Re-route to new flow: treat PIN as master password for simplicity in legacy callers
    await get().setupEncryption(pin)
  },

  disablePin: async (pin) => {
    return get().disableEncryption(pin)
  },

  lockApp: () => {
    set({ pinLocked: true, cryptoKey: null, pages: [] })
  },

  // ── Import / Export ─────────────────────────────────────────
  importPage: async () => {
    const { vault, pages, cryptoKey } = get()
    if (!vault || !isElectron) return

    const result = await (window as any).notara.pages.importFile(vault)
    if (!result) return

    const { content, ext, filename: importedFilename } = result

    // Convert content to a new page
    let title = importedFilename.replace(/\.[^.]+$/, '') // strip extension
    let html = '<p></p>'

    if (ext === 'html' || ext === 'htm') {
      // Strip to body content
      const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
      html = bodyMatch ? bodyMatch[1].trim() : content
    } else {
      // Treat as markdown / text — do basic conversion
      html = content
        .split('\n')
        .map((ln: string) => {
          if (ln.startsWith('# ')) { title = ln.slice(2).trim(); return `<h1>${title}</h1>` }
          if (ln.startsWith('## ')) return `<h2>${ln.slice(3).trim()}</h2>`
          if (ln.startsWith('### ')) return `<h3>${ln.slice(4).trim()}</h3>`
          if (ln.startsWith('- ') || ln.startsWith('* ')) return `<li>${ln.slice(2).trim()}</li>`
          if (ln.trim() === '') return ''
          return `<p>${ln}</p>`
        })
        .filter(Boolean)
        .join('\n')
    }

    const newPage = createNewPage(null, pages.filter(p => p.parentId === null).length)
    newPage.title = title
    newPage.content = html

    const newPages = [...pages, newPage]
    set({ pages: newPages, activePageId: newPage.id })

    // Save
    let mdContent = pageToMarkdown(newPage)
    if (cryptoKey) mdContent = await encryptText(mdContent, cryptoKey)
    await (window as any).notara.pages.write(vault, newPage.filename, mdContent)
  },

  exportCurrentMd: async () => {
    const { pages, activePageId } = get()
    const page = pages.find(p => p.id === activePageId)
    if (!page || !isElectron) return
    const content = pageToMarkdown(page)
    await (window as any).notara.pages.exportMd(content, page.filename)
  },

  exportCurrentHtml: async () => {
    const { pages, activePageId } = get()
    const page = pages.find(p => p.id === activePageId)
    if (!page || !isElectron) return
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${page.title}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 24px; color: #37352f; line-height: 1.65; }
    h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.2em; }
    code { background: #f5f5f3; padding: 0.1em 0.35em; border-radius: 3px; font-size: 0.875em; }
    pre { background: #f5f5f3; padding: 1em; border-radius: 6px; overflow: auto; }
    blockquote { border-left: 3px solid #ccc; margin: 0; padding-left: 1em; color: #666; }
    a { color: #2eaadc; }
  </style>
</head>
<body>
  <h1>${page.title}</h1>
  ${page.content}
</body>
</html>`
    const suggestedName = page.filename.replace('.md', '.html')
    await (window as any).notara.pages.exportHtml(html, suggestedName)
  },

  exportCurrentPdf: async () => {
    const { pages, activePageId } = get()
    const page = pages.find(p => p.id === activePageId)
    if (!page || !isElectron) return
    const suggestedName = page.filename.replace('.md', '.pdf')
    await (window as any).notara.pages.exportPdf(suggestedName)
  },

  // ── Sticky notes ────────────────────────────────────────────
  createStickyNote: async () => {
    const { pages, vault } = get()
    const stickies = pages.filter(p => p.kind === 'sticky')
    const page = createNewPage(null, stickies.length, 'sticky')
    const newPages = [...pages, page]
    set({ pages: newPages })
    if (vault && isElectron) {
      const content = pageToMarkdown(page)
      await (window as any).notara.pages.write(vault, page.filename, content)
      await (window as any).notara.sticky.open(page.id)
    }
  },

  openStickyNote: async (id) => {
    if (!isElectron) return
    await (window as any).notara.sticky.open(id)
  },

  // Called when a sticky note window updates its page (title / color / content)
  syncPageFromSticky: (updatedPage) => {
    const { pages } = get()
    const idx = pages.findIndex(p => p.id === updatedPage.id)
    if (idx === -1) return
    const newPages = [...pages]
    newPages[idx] = updatedPage
    set({ pages: newPages })
  },
}))
