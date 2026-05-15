import { create } from 'zustand'
import { type Page, type Theme } from '../types'
import { createNewPage, markdownToPage, pageToMarkdown, getAllDescendantIds } from '../lib/pageUtils'

const isElectron = typeof window !== 'undefined' && typeof (window as any).notara !== 'undefined'

const LS_PAGES = 'notara:pages'
const LS_VAULT = 'notara:vault'
const LS_THEME = 'notara:theme'
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

  initVault: () => Promise<void>
  selectVault: () => Promise<void>
  loadPages: () => Promise<void>
  setActivePage: (id: string | null) => void
  createPage: (parentId?: string | null) => Page
  updatePage: (id: string, updates: Partial<Page>, save?: boolean) => void
  deletePage: (id: string) => Promise<void>
  savePage: (id: string) => Promise<void>
  reorderPage: (id: string, newParentId: string | null, newOrder: number) => void
  setTheme: (theme: Theme) => void
  toggleSidebar: () => void
  setSearchOpen: (open: boolean) => void
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

  initVault: async () => {
    set({ isLoading: true })
    let vault: string | null = null
    if (isElectron) vault = await (window as any).notara.vault.get()
    else vault = localStorage.getItem(LS_VAULT)
    if (vault) { set({ vault }); await get().loadPages() }
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

  loadPages: async () => {
    const { vault } = get()
    if (!vault) return
    set({ isLoading: true })
    let pages: Page[] = []
    if (isElectron) {
      const files = await (window as any).notara.pages.readAll(vault)
      pages = (files as any[]).map((f: any) => markdownToPage(f.content)).filter((p): p is Page => p !== null)
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
      else await (window as any).notara.pages.write(vault, welcome.id, pageToMarkdown(welcome))
    }
    set({ pages, isLoading: false, activePageId: pages[0]?.id ?? null })
  },

  setActivePage: (id) => set({ activePageId: id }),

  createPage: (parentId = null) => {
    const { pages, vault } = get()
    const siblings = pages.filter(p => p.parentId === parentId)
    const page = createNewPage(parentId, siblings.length)
    const newPages = [...pages, page]
    set({ pages: newPages, activePageId: page.id })
    if (vault) {
      if (isElectron) (window as any).notara.pages.write(vault, page.id, pageToMarkdown(page))
      else lsSetPages(newPages)
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
    const { pages, vault } = get()
    if (!vault) return
    const page = pages.find(p => p.id === id)
    if (!page) return
    try {
      if (isElectron) await (window as any).notara.pages.write(vault, page.id, pageToMarkdown(page))
      else lsSetPages(pages)
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
      if (isElectron) for (const did of idsToDelete) await (window as any).notara.pages.delete(vault, did)
      else lsSetPages(newPages)
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
}))
