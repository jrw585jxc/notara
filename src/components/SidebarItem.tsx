import { useState, useRef, useEffect } from 'react'
import { ChevronRight, Plus, Trash2, Edit3, FileText, File, Folder, FolderOpen, Minus } from 'lucide-react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { type Page } from '../types'
import { useStore } from '../store/useStore'
import { getChildren } from '../lib/pageUtils'
import { useSidebarDrag } from './Sidebar'

interface Props { page: Page; depth: number; isActive: boolean }

export function SidebarItem({ page, depth, isActive }: Props) {
  const { pages, activePageId, setActivePage, createPage, deletePage, updatePage, devMode, isPageExpanded, setExpandedPage, toggleExpandedPage } = useStore()
  const expanded = isPageExpanded(page.id)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(page.title)
  const renameRef = useRef<HTMLInputElement>(null)

  const children = getChildren(pages, page.id)
  const hasChildren = children.length > 0

  useEffect(() => { if (renaming) renameRef.current?.select() }, [renaming])

  // ── Drag & Drop ─────────────────────────────────────────────
  const { draggingId, overDropId } = useSidebarDrag()
  const isDraggingThis = draggingId === page.id

  const { attributes, listeners, setNodeRef: setDragRef } = useDraggable({
    id: page.id,
    data: { page },
  })

  // Three drop zones per item
  const kind = page.kind || 'page'
  const { setNodeRef: setBeforeRef } = useDroppable({ id: `before:${page.id}` })
  const { setNodeRef: setInsideRef } = useDroppable({
    id: `inside:${page.id}`,
    disabled: kind === 'section',   // sections can't have children
  })
  const { setNodeRef: setAfterRef } = useDroppable({ id: `after:${page.id}` })

  const isDropBefore = overDropId === `before:${page.id}` && draggingId !== page.id
  const isDropInside = overDropId === `inside:${page.id}` && draggingId !== page.id
  const isDropAfter  = overDropId === `after:${page.id}`  && draggingId !== page.id

  // ── Section label ───────────────────────────────────────────
  if (kind === 'section') {
    return (
      <>
        <div
          ref={setDragRef}
          style={{ paddingLeft: depth * 12, position: 'relative' }}
          onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
          {...listeners} {...attributes}
        >
          {/* Drop zones */}
          {draggingId && <div ref={setBeforeRef} className="sidebar-drop-zone-before" />}
          {draggingId && <div ref={setInsideRef} className="sidebar-drop-zone-inside" />}
          {draggingId && <div ref={setAfterRef}  className="sidebar-drop-zone-after"  />}

          {renaming ? (
            <div className="sidebar-section-label" style={{ paddingLeft: depth * 12 + 8 }}>
              <input
                ref={renameRef}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={() => { updatePage(page.id, { title: renameValue.trim() || 'Section' }); setRenaming(false) }}
                onKeyDown={e => {
                  if (e.key === 'Enter') { updatePage(page.id, { title: renameValue.trim() || 'Section' }); setRenaming(false) }
                  if (e.key === 'Escape') setRenaming(false)
                }}
                onClick={e => e.stopPropagation()}
                style={{ background: 'none', border: 'none', outline: '1px solid var(--accent)',
                  borderRadius: 3, fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)',
                  textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'var(--font-sans)',
                  padding: '0 2px', width: '100%' }}
              />
            </div>
          ) : (
            <div className={`sidebar-section-label${isDropBefore ? ' drop-before' : ''}${isDropAfter ? ' drop-after' : ''}`}>
              <Minus size={10} style={{ opacity: 0.4, flexShrink: 0 }} />
              <span>{page.title}</span>
            </div>
          )}
        </div>

        {contextMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 499 }} onClick={() => setContextMenu(null)} />
            <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
              <div className="context-menu-item" onClick={() => { setContextMenu(null); setRenameValue(page.title); setRenaming(true) }}>
                <Edit3 size={13} /> Rename
              </div>
              <div className="context-menu-sep" />
              <div className="context-menu-item danger" onClick={() => { setContextMenu(null); deletePage(page.id) }}>
                <Trash2 size={13} /> Delete
              </div>
            </div>
          </>
        )}
      </>
    )
  }

  // ── Folder / Page ───────────────────────────────────────────
  const isFolder = kind === 'folder'

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (isFolder) { toggleExpandedPage(page.id) }
    else { setActivePage(page.id) }
  }
  const handleToggle = (e: React.MouseEvent) => { e.stopPropagation(); toggleExpandedPage(page.id) }
  const handleAddChild = (e: React.MouseEvent) => { e.stopPropagation(); createPage(page.id, 'page'); setExpandedPage(page.id, true) }
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }
  const closeContext = () => setContextMenu(null)
  const handleRename = () => { closeContext(); setRenameValue(page.title); setRenaming(true) }
  const handleRenameSubmit = () => { updatePage(page.id, { title: renameValue.trim() || 'Untitled' }); setRenaming(false) }
  const handleDelete = async () => { closeContext(); await deletePage(page.id) }

  const itemCls = [
    'sidebar-item',
    isActive && !isFolder ? 'active' : '',
    isFolder ? 'sidebar-folder' : '',
    isDraggingThis ? 'dragging' : '',
    isDropInside ? 'drop-inside' : '',
  ].filter(Boolean).join(' ')

  const toggleCls = 'sidebar-item-toggle' + (hasChildren ? (expanded ? ' open' : '') : ' leaf')

  // Folder icon — in dev mode all icons become monochrome linework
  const itemIcon = isFolder
    ? (expanded ? <FolderOpen size={14} className="sidebar-folder-icon" /> : <Folder size={14} className="sidebar-folder-icon" />)
    : devMode
      ? <File size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
      : <span className="sidebar-item-emoji">{page.emoji}</span>

  return (
    <>
      <div style={{ paddingLeft: depth * 12, position: 'relative' }}>
        {/* Drop zones — invisible hitboxes, positioned absolutely */}
        {draggingId && draggingId !== page.id && (
          <>
            <div ref={setBeforeRef} className={`sidebar-drop-zone-before${isDropBefore ? ' show' : ''}`} />
            <div ref={setInsideRef} className="sidebar-drop-zone-inside" />
            <div ref={setAfterRef}  className={`sidebar-drop-zone-after${isDropAfter ? ' show' : ''}`} />
          </>
        )}

        <div
          className={itemCls}
          ref={setDragRef}
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          {...listeners}
          {...attributes}
        >
          <div className={toggleCls} onClick={isFolder ? handleToggle : (hasChildren ? handleToggle : undefined)}>
            <ChevronRight size={12} />
          </div>
          {itemIcon}
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
            <span className={`sidebar-item-title${isFolder ? ' sidebar-folder-title' : ''}`}>
              {page.title}
              {devMode && !isFolder && <span className="sidebar-item-ext">.md</span>}
            </span>
          )}
          <span className="sidebar-item-add" onClick={handleAddChild} title="Add sub-page">
            <Plus size={12} />
          </span>
        </div>

        {(hasChildren || isFolder) && expanded && (
          <div className="sidebar-item-children">
            {children.map(child => (
              <SidebarItem key={child.id} page={child} depth={depth + 1} isActive={activePageId === child.id} />
            ))}
            {isFolder && children.length === 0 && (
              <div className="sidebar-folder-empty" style={{ paddingLeft: (depth + 1) * 12 + 20 }}>
                Empty folder
              </div>
            )}
          </div>
        )}
      </div>

      {contextMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 499 }} onClick={closeContext} />
          <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={e => e.stopPropagation()}>
            <div className="context-menu-item" onClick={handleRename}><Edit3 size={13} /> Rename</div>
            <div className="context-menu-item" onClick={() => { closeContext(); createPage(page.id, 'page'); setExpandedPage(page.id, true) }}>
              <Plus size={13} /> Add page inside
            </div>
            {!isFolder && (
              <div className="context-menu-item" onClick={() => { closeContext(); createPage(page.parentId) }}>
                <FileText size={13} /> Add page below
              </div>
            )}
            <div className="context-menu-sep" />
            <div className="context-menu-item danger" onClick={handleDelete}><Trash2 size={13} /> Delete</div>
          </div>
        </>
      )}
    </>
  )
}
