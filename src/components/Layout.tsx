import { useEffect, useRef, useState } from 'react'
import { PanelLeftOpen, Search, Plus, Terminal, MoreHorizontal } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { PageView } from './PageView'
import { SearchModal } from './SearchModal'
import { PageMenu } from './PageMenu'
import { useStore } from '../store/useStore'

// ── Window controls (frameless, non-macOS) ────────────────────
const isElectron = typeof window !== 'undefined' && typeof (window as any).notara !== 'undefined'

function WindowControls() {
  const [platform, setPlatform] = useState<string>('')
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!isElectron) return
    ;(window as any).notara.window.platform().then((p: string) => setPlatform(p))
    ;(window as any).notara.window.isMaximized().then((m: boolean) => setMaximized(m))
    const off = (window as any).notara.on('window:maximized', (_e: any, isMax: boolean) => {
      setMaximized(isMax)
    })
    return () => off?.()
  }, [])

  if (!platform || platform === 'darwin') return null

  return (
    <div className="win-controls">
      <div className="win-controls-sep" />
      <button
        className="win-btn win-btn-min"
        onClick={() => (window as any).notara.window.minimize()}
        title="Minimize"
        tabIndex={-1}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <rect x="0" y="5.5" width="10" height="1.5" rx="0.5" fill="currentColor"/>
        </svg>
      </button>
      <button
        className="win-btn win-btn-max"
        onClick={async () => {
          const next = await (window as any).notara.window.maximize()
          setMaximized(next)
        }}
        title={maximized ? 'Restore' : 'Maximize'}
        tabIndex={-1}
      >
        {maximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="2.5" y="0.5" width="7" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.4"/>
            <rect x="0.5" y="3.5" width="7" height="6" rx="0.5" stroke="currentColor" strokeWidth="1.4" fill="var(--bg-base)"/>
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="0.5" y="0.5" width="9" height="9" rx="0.5" stroke="currentColor" strokeWidth="1.4"/>
          </svg>
        )}
      </button>
      <button
        className="win-btn win-btn-close"
        onClick={() => (window as any).notara.window.close()}
        title="Close"
        tabIndex={-1}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  )
}

export function Layout() {
  const {
    sidebarCollapsed, searchOpen, toggleSidebar, setSearchOpen, createPage,
    devMode, toggleDevMode, saveStatus, pages, activePageId, cursorLine,
    vault,
  } = useStore()

  const [menuOpen, setMenuOpen] = useState(false)
  const menuBtnRef = useRef<HTMLButtonElement>(null)

  const activePage = pages.find(p => p.id === activePageId)

  // Abbreviate vault path for status bar
  const shortVault = vault
    ? vault.replace(/\\/g, '/').replace(/^.*?(\/[^/]+\/[^/]+\/[^/]+)$/, '~$1')
    : '~'
  const filePath = activePage
    ? `${shortVault}/${activePage.filename}`
    : ''

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
      if (meta && e.key === '\\') { e.preventDefault(); toggleSidebar() }
      if (meta && e.key === 'n') { e.preventDefault(); createPage(null) }
      if (meta && e.shiftKey && e.key === 'd') { e.preventDefault(); toggleDevMode() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSearchOpen, toggleSidebar, createPage, toggleDevMode])

  useEffect(() => {
    if (typeof window.notara === 'undefined') return
    const offSearch = window.notara.on('menu-search', () => setSearchOpen(true))
    const offToggle = window.notara.on('menu-toggle-sidebar', () => toggleSidebar())
    const offNew = window.notara.on('menu-new-page', () => createPage(null))
    const offVault = window.notara.on('menu-choose-vault', () => useStore.getState().selectVault())
    return () => { offSearch?.(); offToggle?.(); offNew?.(); offVault?.() }
  }, [setSearchOpen, toggleSidebar, createPage])

  return (
    <div className={`app-layout ${devMode ? 'dev-mode' : ''}`}>
      <Sidebar />
      <div className="main-area">
        <div className="topbar">
          <div className="topbar-left">
            {sidebarCollapsed && (
              <button className="btn btn-icon btn-ghost" onClick={toggleSidebar} title="Show sidebar (Ctrl+\\)">
                <PanelLeftOpen size={15} />
              </button>
            )}
            {devMode && activePage && (
              <span className="topbar-filepath" title={filePath}>
                {filePath}
              </span>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <div className="topbar-right">
            {/* Dev mode toggle */}
            <button
              className={`btn btn-icon btn-ghost ${devMode ? 'btn-active' : ''}`}
              onClick={toggleDevMode}
              title="Toggle Dev Mode (Ctrl+Shift+D)"
            >
              <Terminal size={14} />
            </button>

            <button className="btn btn-icon btn-ghost" onClick={() => setSearchOpen(true)} title="Search (Ctrl+K)">
              <Search size={14} />
            </button>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 13, gap: 4, padding: '4px 10px', height: 28 }}
              onClick={() => createPage(null)}
            >
              <Plus size={14} /> New page
            </button>

            {/* Page menu (···) */}
            {activePage && (
              <button
                ref={menuBtnRef}
                className={`btn btn-icon btn-ghost ${menuOpen ? 'btn-active' : ''}`}
                onClick={() => setMenuOpen(v => !v)}
                title="Page options"
              >
                <MoreHorizontal size={15} />
              </button>
            )}

            {/* Window controls — only on frameless non-macOS */}
            <WindowControls />
          </div>
        </div>

        <PageView />

        {/* Dev mode status bar */}
        {devMode && activePage && (
          <div className="status-bar">
            <span className="status-bar-item">{activePage.filename}</span>
            <span className="status-bar-sep" />
            <span className="status-bar-item">
              {saveStatus === 'saving' ? 'saving…'
                : saveStatus === 'saved' ? 'saved to disk'
                : saveStatus === 'error' ? 'save failed'
                : 'saved to disk'}
            </span>
            <span className="status-bar-sep" />
            <span className="status-bar-item">UTF-8</span>
            <span className="status-bar-sep" />
            <span className="status-bar-item">Markdown</span>
            <div style={{ flex: 1 }} />
            <span className="status-bar-item">Ln {cursorLine}</span>
          </div>
        )}
      </div>

      {searchOpen && <SearchModal />}
      {menuOpen && activePage && (
        <PageMenu anchorRef={menuBtnRef} onClose={() => setMenuOpen(false)} />
      )}
    </div>
  )
}
