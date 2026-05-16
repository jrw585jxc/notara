import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useRef, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'

// ── TabPanel ────────────────────────────────────────────────────
// No ReactNodeViewRenderer — ProseMirror renders natively so the
// .tab-panel divs are direct children of NodeViewContent, letting
// the CSS nth-child visibility trick work correctly.
export const TabPanel = Node.create({
  name: 'tabPanel',
  group: 'tabPanel',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      label: { default: 'Tab' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="tab-panel"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'tab-panel',
        'data-label': node.attrs.label,
        class: 'tab-panel',
      }),
      0,
    ]
  },
})

// ── TabGroup ────────────────────────────────────────────────────
function TabGroupView({ node, getPos, editor }: NodeViewProps) {
  const [activeTab, setActiveTab] = useState<number>((node.attrs.activeTab as number) || 0)
  const [editingTab, setEditingTab] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  const editRef = useRef<HTMLInputElement>(null)

  // Collect panel labels from children
  const panels: { label: string }[] = []
  node.content.forEach((child: any) => {
    panels.push({ label: child.attrs.label || 'Tab' })
  })

  const safeActiveTab = Math.min(activeTab, Math.max(0, panels.length - 1))

  // Panel visibility is handled purely via CSS using the data-active-tab attribute
  // on the .tab-panels wrapper (React-controlled, so ProseMirror never resets it).
  // See index.css for the matching .tab-panels[data-active-tab="N"] rules.

  const getPanelPos = (tabIndex: number): number => {
    const pos = (typeof getPos === 'function' ? getPos() : undefined) ?? 0
    let offset = pos + 1 // inside tabGroup
    node.content.forEach((child: any, _: any, i: number) => {
      if (i < tabIndex) offset += child.nodeSize
    })
    return offset
  }

  const deleteTabGroup = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const pos = typeof getPos === 'function' ? getPos() : undefined
    if (pos === undefined) return
    editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run()
  }

  const switchTab = (e: React.MouseEvent, i: number) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveTab(i)
    // Local state only — updateAttributes races with dispatch and corrupts the document
  }

  const addTab = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const pos = typeof getPos === 'function' ? getPos() : undefined
    if (pos == null) return
    const newIdx = panels.length
    // Insert new tab panel just before the tabGroup's closing token.
    // Use insertContentAt so ProseMirror handles position mapping cleanly —
    // the previous approach combined insert + setNodeMarkup in one transaction
    // which caused setNodeMarkup to silently revert the insert.
    editor
      .chain()
      .insertContentAt(pos + node.nodeSize - 1, {
        type: 'tabPanel',
        attrs: { label: `Tab ${newIdx + 1}` },
        content: [{ type: 'paragraph' }],
      })
      .run()
    setActiveTab(newIdx)
  }

  const deleteTab = (e: React.MouseEvent, tabIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (panels.length <= 1) return
    const rawPos = typeof getPos === 'function' ? getPos() : undefined
    if (rawPos === undefined) return
    const panelPos = getPanelPos(tabIndex)
    const panel = node.content.child(tabIndex)
    const newActive = Math.max(0, safeActiveTab >= tabIndex ? safeActiveTab - 1 : safeActiveTab)
    // Single transaction: delete panel + update activeTab attr atomically
    const tr = editor.state.tr.delete(panelPos, panelPos + panel.nodeSize)
    tr.setNodeMarkup(rawPos, undefined, { ...node.attrs, activeTab: newActive })
    editor.view.dispatch(tr)
    setActiveTab(newActive)
  }

  const startRename = (e: React.MouseEvent, tabIndex: number, label: string) => {
    e.preventDefault()
    e.stopPropagation()
    setEditingTab(tabIndex)
    setEditValue(label)
    setTimeout(() => editRef.current?.select(), 10)
  }

  const commitRename = (tabIndex: number) => {
    if (editValue.trim()) {
      const panelPos = getPanelPos(tabIndex)
      const panel = node.content.child(tabIndex)
      const tr = editor.state.tr.setNodeMarkup(panelPos, undefined, { ...panel.attrs, label: editValue.trim() })
      editor.view.dispatch(tr)
    }
    setEditingTab(null)
  }

  return (
    <NodeViewWrapper as="div" className="tab-group" data-type="tab-group">
      {/* Tab bar */}
      <div className="tab-bar" contentEditable={false}>
        {panels.map((panel, i) => (
          <div
            key={i}
            className={`tab-btn${i === safeActiveTab ? ' active' : ''}`}
            onMouseDown={e => switchTab(e, i)}
          >
            {editingTab === i ? (
              <input
                ref={editRef}
                className="tab-label-input"
                value={editValue}
                onChange={e => setEditValue(e.target.value)}
                onBlur={() => commitRename(i)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); commitRename(i) }
                  if (e.key === 'Escape') setEditingTab(null)
                }}
                onMouseDown={e => e.stopPropagation()}
              />
            ) : (
              <span className="tab-btn-label" onDoubleClick={e => startRename(e, i, panel.label)}>
                {panel.label}
              </span>
            )}
            {panels.length > 1 && (
              <button
                className="tab-close"
                onMouseDown={e => deleteTab(e, i)}
                title="Remove tab"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
        <button
          className="tab-add-btn"
          onMouseDown={addTab}
          title="Add tab"
        >
          <Plus size={13} />
        </button>
        <button
          className="tab-delete-group-btn"
          onMouseDown={deleteTabGroup}
          title="Delete tab block"
        >
          <Trash2 size={12} />
        </button>
      </div>
      {/* Tab panels — visibility managed via CSS data-active-tab attribute */}
      <div className="tab-panels" data-active-tab={safeActiveTab}>
        <NodeViewContent />
      </div>
    </NodeViewWrapper>
  )
}

export const TabGroup = Node.create({
  name: 'tabGroup',
  group: 'block',
  content: 'tabPanel+',
  defining: true,

  addAttributes() {
    return {
      activeTab: { default: 0, parseHTML: el => parseInt(el.getAttribute('data-active-tab') || '0', 10) },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="tab-group"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'tab-group', 'data-active-tab': node.attrs.activeTab }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(TabGroupView)
  },
})
