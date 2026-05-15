import { useEffect } from 'react'
import { PanelLeftOpen, Search, Plus } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { PageView } from './PageView'
import { SearchModal } from './SearchModal'
import { useStore } from '../store/useStore'

export function Layout() {
  const { sidebarCollapsed, searchOpen, toggleSidebar, setSearchOpen, createPage } = useStore()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key === 'k') { e.preventDefault(); setSearchOpen(true) }
      if (meta && e.key === '\\') { e.preventDefault(); toggleSidebar() }
      if (meta && e.key === 'n') { e.preventDefault(); createPage(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSearchOpen, toggleSidebar, createPage])

  useEffect(() => {
    if (typeof window.notara === 'undefined') return
    const offSearch = window.notara.on('menu-search', () => setSearchOpen(true))
    const offToggle = window.notara.on('menu-toggle-sidebar', () => toggleSidebar())
    const offNew = window.notara.on('menu-new-page', () => createPage(null))
    const offVault = window.notara.on('menu-choose-vault', () => useStore.getState().selectVault())
    return () => { offSearch?.(); offToggle?.(); offNew?.(); offVault?.() }
  }, [setSearchOpen, toggleSidebar, createPage])

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <div className="topbar">
          <div className="topbar-left">
            {sidebarCollapsed && (
              <button className="btn btn-icon btn-ghost" onClick={toggleSidebar} title="Show sidebar (Ctrl+\\)">
                <PanelLeftOpen size={15} />
              </button>
            )}
          </div>
          <div style={{ flex: 1 }} />
          <div className="topbar-right">
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
          </div>
        </div>
        <PageView />
      </div>
      {searchOpen && <SearchModal />}
    </div>
  )
}
