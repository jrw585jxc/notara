import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Search, Plus, Moon, Sun, Monitor, FolderOpen, ChevronLeft, Folder, Minus, StickyNote } from 'lucide-react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from '@dnd-kit/core'

function NotaraLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M7 25 L7 7 L25 25 L25 7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.55"/>
      <circle cx="7"  cy="25" r="2.2" fill="currentColor"/>
      <circle cx="7"  cy="7"  r="2.2" fill="currentColor"/>
      <circle cx="25" cy="25" r="2.2" fill="currentColor"/>
      <circle cx="25" cy="7"  r="2.2" fill="currentColor"/>
      <circle cx="16" cy="16" r="2.6" fill="currentColor"/>
    </svg>
  )
}
import { type Theme } from '../types'
import { useStore } from '../store/useStore'
import { buildTree, getAllDescendantIds } from '../lib/pageUtils'
import { SidebarItem } from './SidebarItem'

// ── Drag context ──────────────────────────────────────────────
export interface DragCtxValue {
  draggingId: string | null
  overDropId: string | null   // e.g. "before:abc", "inside:abc", "after:abc"
}
export const SidebarDragCtx = createContext<DragCtxValue>({ draggingId: null, overDropId: null })
export const useSidebarDrag = () => useContext(SidebarDragCtx)

// ── New item dropdown ─────────────────────────────────────────
function NewItemDropdown({ onClose }: { onClose: () => void }) {
  const { createPage } = useStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div ref={ref} className="new-item-dropdown">
      <div className="new-item-option" onClick={() => { createPage(null, 'page'); onClose() }}>
        <span className="new-item-icon">📄</span>
        <div>
          <div className="new-item-label">New Page</div>
          <div className="new-item-desc">A blank page</div>
        </div>
      </div>
      <div className="new-item-option" onClick={() => { createPage(null, 'folder'); onClose() }}>
        <Folder size={15} className="new-item-icon-svg" />
        <div>
          <div className="new-item-label">New Folder</div>
          <div className="new-item-desc">Group pages together</div>
        </div>
      </div>
      <div className="new-item-option" onClick={() => { createPage(null, 'section'); onClose() }}>
        <Minus size={15} className="new-item-icon-svg" />
        <div>
          <div className="new-item-label">New Section</div>
          <div className="new-item-desc">A bold divider label</div>
        </div>
      </div>
    </div>
  )
}

// ── Sticky note sidebar item ──────────────────────────────────
function StickyItem({ page }: { page: import('../types').Page }) {
  const { deletePage, openStickyNote } = useStore()
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const COLOR_DOTS: Record<string, string> = {
    yellow: '#fde047', blue: '#93c5fd', green: '#86efac',
    pink: '#f9a8d4', purple: '#c4b5fd', black: '#202020', white: '#e0e0de',
  }
  const dot = COLOR_DOTS[page.color ?? 'yellow'] ?? COLOR_DOTS.yellow

  return (
    <>
      <div
        className="sticky-sidebar-item"
        onClick={() => openStickyNote(page.id)}
        onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
        title={page.title || 'Untitled sticky'}
      >
        <span className="sticky-sidebar-dot" style={{ background: dot }} />
        <span className="sticky-sidebar-title">{page.title || 'Untitled sticky'}</span>
      </div>
      {contextMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 499 }} onClick={() => setContextMenu(null)} />
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
            <div className="context-menu-item" onClick={() => { setContextMenu(null); openStickyNote(page.id) }}>
              <StickyNote size={13} /> Open
            </div>
            <div className="context-menu-sep" />
            <div className="context-menu-item danger" onClick={() => { setContextMenu(null); deletePage(page.id) }}>
              Delete
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── Sidebar ───────────────────────────────────────────────────
export function Sidebar() {
  const {
    pages, activePageId, vault, theme, setSearchOpen, setTheme,
    toggleSidebar, sidebarCollapsed, reorderPage, createStickyNote,
  } = useStore()
  const rootPages = buildTree(pages).filter(p => p.kind !== 'sticky')
  const stickyPages = [...pages].filter(p => p.kind === 'sticky').sort((a, b) => a.order - b.order)
  const [showNewDropdown, setShowNewDropdown] = useState(false)
  const plusBtnRef = useRef<HTMLButtonElement>(null)

  // Resizable divider between pages and stickies
  const [pagesHeight, setPagesHeight] = useState<number | null>(null)
  const dividerRef = useRef<HTMLDivElement>(null)
  const draggingDivider = useRef(false)
  const dragStartY = useRef(0)
  const dragStartH = useRef(0)
  const sidebarBodyRef = useRef<HTMLDivElement>(null)

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    draggingDivider.current = true
    dragStartY.current = e.clientY
    dragStartH.current = pagesHeight ?? (sidebarBodyRef.current?.clientHeight ?? 300) / 2

    const onMove = (ev: MouseEvent) => {
      if (!draggingDivider.current) return
      const delta = ev.clientY - dragStartY.current
      const next = Math.max(60, Math.min(dragStartH.current + delta, (sidebarBodyRef.current?.clientHeight ?? 600) - 60))
      setPagesHeight(next)
    }
    const onUp = () => {
      draggingDivider.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [pagesHeight])

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [overDropId, setOverDropId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

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

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(event.active.id as string)
  }

  const handleDragOver = (event: DragOverEvent) => {
    setOverDropId(event.over ? (event.over.id as string) : null)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingId(null)
    setOverDropId(null)

    const { active, over } = event
    if (!over) return

    const draggedId = active.id as string
    const overId = over.id as string
    const colonIdx = overId.indexOf(':')
    if (colonIdx === -1) return

    const position = overId.slice(0, colonIdx)         // 'before' | 'inside' | 'after'
    const targetId = overId.slice(colonIdx + 1)

    if (draggedId === targetId) return

    const draggedPage = pages.find(p => p.id === draggedId)
    const targetPage  = pages.find(p => p.id === targetId)
    if (!draggedPage || !targetPage) return

    // Don't allow dropping a parent onto its own descendant
    if (getAllDescendantIds(pages, draggedId).includes(targetId)) return

    let newParentId: string | null
    let newOrder: number

    if (position === 'inside') {
      newParentId = targetId
      const children = pages.filter(p => p.parentId === targetId && p.id !== draggedId)
      newOrder = children.length > 0 ? Math.max(...children.map(c => c.order)) + 1 : 0
    } else {
      // before / after — sibling of target
      newParentId = targetPage.parentId
      const siblings = pages
        .filter(p => p.parentId === newParentId && p.id !== draggedId)
        .sort((a, b) => a.order - b.order)
      const targetIdx = siblings.findIndex(s => s.id === targetId)

      if (position === 'before') {
        const prev = siblings[targetIdx - 1]
        newOrder = prev ? (prev.order + targetPage.order) / 2 : targetPage.order - 1
      } else {
        const next = siblings[targetIdx + 1]
        newOrder = next ? (targetPage.order + next.order) / 2 : targetPage.order + 1
      }
    }

    reorderPage(draggedId, newParentId, newOrder)
  }

  const draggedPage = draggingId ? pages.find(p => p.id === draggingId) : null

  return (
    <aside className={`sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
      <div
        className="sidebar-header"
        style={{ position: 'relative', WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <NotaraLogo />
          <span className="sidebar-title">Notara</span>
        </div>
        <div className="sidebar-actions" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button className="btn btn-icon btn-ghost" onClick={() => setSearchOpen(true)} title="Search (Ctrl+K)">
            <Search size={14} />
          </button>
          <button
            ref={plusBtnRef}
            className="btn btn-icon btn-ghost"
            onClick={() => setShowNewDropdown(v => !v)}
            title="New item"
          >
            <Plus size={14} />
          </button>
          <button className="btn btn-icon btn-ghost" onClick={toggleSidebar} title="Collapse sidebar">
            <ChevronLeft size={14} />
          </button>
        </div>
        {showNewDropdown && (
          <NewItemDropdown onClose={() => setShowNewDropdown(false)} />
        )}
      </div>

      <SidebarDragCtx.Provider value={{ draggingId, overDropId }}>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {/* Pages section */}
          <div
            ref={sidebarBodyRef}
            className="sidebar-body"
            style={stickyPages.length > 0 && pagesHeight !== null ? { height: pagesHeight, flexShrink: 0 } : undefined}
          >
            {rootPages.length === 0 ? (
              <div style={{ padding: '16px 12px', color: 'var(--text-tertiary)', fontSize: 13 }}>
                No pages yet.{' '}
                <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => setShowNewDropdown(true)}>
                  Create one
                </span>
              </div>
            ) : (
              rootPages.map(page => (
                <SidebarItem key={page.id} page={page} depth={0} isActive={activePageId === page.id} />
              ))
            )}
          </div>

          <DragOverlay dropAnimation={null}>
            {draggedPage && (
              <div className="sidebar-drag-overlay">
                <span style={{ fontSize: 13, color: 'var(--text-primary)', opacity: 0.9 }}>
                  {draggedPage.emoji && draggedPage.kind === 'page' ? `${draggedPage.emoji} ` : ''}
                  {draggedPage.title || 'Untitled'}
                </span>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </SidebarDragCtx.Provider>

      {/* Sticky notes section */}
      {stickyPages.length > 0 && (
        <>
          {/* Resizable divider */}
          <div
            ref={dividerRef}
            className="sidebar-divider"
            onMouseDown={onDividerMouseDown}
            title="Drag to resize"
          />

          <div className="sidebar-stickies">
            <div className="sidebar-stickies-header">
              <StickyNote size={11} style={{ opacity: 0.5 }} />
              <span>Sticky Notes</span>
              <button
                className="btn btn-icon btn-ghost"
                style={{ marginLeft: 'auto', padding: '0 2px' }}
                onClick={createStickyNote}
                title="New sticky note"
              >
                <Plus size={12} />
              </button>
            </div>
            <div className="sidebar-stickies-list">
              {stickyPages.map(p => <StickyItem key={p.id} page={p} />)}
            </div>
          </div>
        </>
      )}

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
        <button
          className="btn btn-icon btn-ghost"
          onClick={createStickyNote}
          title="New sticky note (Ctrl+Shift+N)"
          style={{ opacity: 0.6 }}
        >
          <StickyNote size={13} />
        </button>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {pages.filter(p => p.kind === 'page' || !p.kind).length} pages
        </span>
      </div>
    </aside>
  )
}
