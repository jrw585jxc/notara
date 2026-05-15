import { useState, useRef, useEffect } from 'react'
import { ChevronRight, Plus, Trash2, Edit3, FileText } from 'lucide-react'
import { type Page } from '../types'
import { useStore } from '../store/useStore'
import { getChildren } from '../lib/pageUtils'

interface Props { page: Page; depth: number; isActive: boolean }

export function SidebarItem({ page, depth, isActive }: Props) {
  const { pages, activePageId, setActivePage, createPage, deletePage, updatePage } = useStore()
  const [expanded, setExpanded] = useState(depth === 0)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(page.title)
  const renameRef = useRef<HTMLInputElement>(null)

  const children = getChildren(pages, page.id)
  const hasChildren = children.length > 0

  useEffect(() => { if (renaming) renameRef.current?.select() }, [renaming])

  const handleClick = (e: React.MouseEvent) => { e.stopPropagation(); setActivePage(page.id) }
  const handleToggle = (e: React.MouseEvent) => { e.stopPropagation(); setExpanded(v => !v) }
  const handleAddChild = (e: React.MouseEvent) => { e.stopPropagation(); createPage(page.id); setExpanded(true) }
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }
  const closeContext = () => setContextMenu(null)
  const handleRename = () => { closeContext(); setRenameValue(page.title); setRenaming(true) }
  const handleRenameSubmit = () => { updatePage(page.id, { title: renameValue.trim() || 'Untitled' }); setRenaming(false) }
  const handleDelete = async () => { closeContext(); await deletePage(page.id) }

  const itemCls = 'sidebar-item' + (isActive ? ' active' : '')
  const toggleCls = 'sidebar-item-toggle' + (hasChildren ? (expanded ? ' open' : '') : ' leaf')

  return (
    <>
      <div style={{ paddingLeft: depth * 12 }}>
        <div className={itemCls} onClick={handleClick} onContextMenu={handleContextMenu}>
          <div className={toggleCls} onClick={hasChildren ? handleToggle : undefined}>
            <ChevronRight size={12} />
          </div>
          <span className="sidebar-item-emoji">{page.emoji}</span>
          {renaming ? (
            <input
              ref={renameRef}
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRenameSubmit()
                if (e.key === 'Escape') setRenaming(false)
              }}
              onClick={e => e.stopPropagation()}
              style={{ flex: 1, background: 'none', border: 'none', outline: '1px solid var(--accent)',
                borderRadius: 3, fontSize: 13.5, color: 'var(--text-primary)',
                fontFamily: 'var(--font-sans)', padding: '0 2px',
                userSelect: 'text', WebkitUserSelect: 'text' }}
            />
          ) : (
            <span className="sidebar-item-title">{page.title}</span>
          )}
          <span className="sidebar-item-add" onClick={handleAddChild} title="Add sub-page">
            <Plus size={12} />
          </span>
        </div>
        {hasChildren && expanded && (
          <div className="sidebar-item-children">
            {children.map(child => (
              <SidebarItem key={child.id} page={child} depth={depth + 1} isActive={activePageId === child.id} />
            ))}
          </div>
        )}
      </div>
      {contextMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 499 }} onClick={closeContext} />
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
            <div className="context-menu-item" onClick={handleRename}><Edit3 size={13} /> Rename</div>
            <div className="context-menu-item" onClick={() => { closeContext(); createPage(page.id); setExpanded(true) }}>
              <Plus size={13} /> Add sub-page
            </div>
            <div className="context-menu-item" onClick={() => { closeContext(); createPage(page.parentId) }}>
              <FileText size={13} /> Add page below
            </div>
            <div className="context-menu-sep" />
            <div className="context-menu-item danger" onClick={handleDelete}><Trash2 size={13} /> Delete</div>
          </div>
        </>
      )}
    </>
  )
}
