import { Search, Plus, Moon, Sun, Monitor, FolderOpen, ChevronLeft } from 'lucide-react'
import { type Theme } from '../types'
import { useStore } from '../store/useStore'
import { buildTree } from '../lib/pageUtils'
import { SidebarItem } from './SidebarItem'

export function Sidebar() {
  const { pages, activePageId, vault, theme, createPage, setSearchOpen, setTheme, toggleSidebar } = useStore()
  const rootPages = buildTree(pages)

  const themeIcons: Record<Theme, React.ReactNode> = {
    light: <Sun size={14} />,
    dark: <Moon size={14} />,
    system: <Monitor size={14} />,
  }

  const cycleTheme = () => {
    const order: Theme[] = ['system', 'light', 'dark']
    setTheme(order[(order.indexOf(theme) + 1) % order.length])
  }

  const openVault = async () => {
    if (vault && typeof window.notara !== 'undefined') {
      await window.notara.vault.openInExplorer(vault)
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span style={{ fontSize: 16, marginRight: 2 }}>🗒️</span>
        <span className="sidebar-title">Notara</span>
        <div className="sidebar-actions">
          <button className="btn btn-icon btn-ghost" onClick={() => setSearchOpen(true)} title="Search (Ctrl+K)">
            <Search size={14} />
          </button>
          <button className="btn btn-icon btn-ghost" onClick={() => createPage(null)} title="New page">
            <Plus size={14} />
          </button>
          <button className="btn btn-icon btn-ghost" onClick={toggleSidebar} title="Collapse sidebar">
            <ChevronLeft size={14} />
          </button>
        </div>
      </div>
      <div className="sidebar-body">
        {rootPages.length === 0 ? (
          <div style={{ padding: '16px 12px', color: 'var(--text-tertiary)', fontSize: 13 }}>
            No pages yet.{' '}
            <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => createPage(null)}>
              Create one
            </span>
          </div>
        ) : (
          rootPages.map(page => (
            <SidebarItem key={page.id} page={page} depth={0} isActive={activePageId === page.id} />
          ))
        )}
      </div>
      <div className="sidebar-footer">
        <button className="btn btn-icon btn-ghost" onClick={cycleTheme} title={'Theme: ' + theme}>
          {themeIcons[theme]}
        </button>
        {vault && (
          <button className="btn btn-icon btn-ghost" onClick={openVault} title="Open vault folder">
            <FolderOpen size={14} />
          </button>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {pages.length} {pages.length === 1 ? 'page' : 'pages'}
        </span>
      </div>
    </aside>
  )
}
