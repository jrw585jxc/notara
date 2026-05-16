import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { ExternalLink, X } from 'lucide-react'

function BookmarkBlockView({ node, deleteNode }: NodeViewProps) {
  const { url, title, description, favicon } = node.attrs as {
    url: string; title: string; description: string; favicon: string
  }

  const handleOpen = (e: React.MouseEvent) => {
    e.preventDefault()
    if (typeof window.notara !== 'undefined') {
      // Use shell.openExternal via Electron or just window.open
      window.open(url, '_blank')
    } else {
      window.open(url, '_blank')
    }
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    deleteNode()
  }

  const displayTitle = title || url
  const hostname = (() => { try { return new URL(url).hostname } catch { return url } })()

  return (
    <NodeViewWrapper as="div" className="bookmark-block-wrapper" contentEditable={false}>
      <div className="bookmark-block" onClick={handleOpen}>
        <div className="bookmark-info">
          <div className="bookmark-title">{displayTitle}</div>
          {description && <div className="bookmark-desc">{description}</div>}
          <div className="bookmark-meta">
            {favicon && <img src={favicon} className="bookmark-favicon" alt="" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
            <span className="bookmark-hostname">{hostname}</span>
            <ExternalLink size={11} className="bookmark-ext-icon" />
          </div>
        </div>
      </div>
      <button className="media-delete" onMouseDown={handleDelete} title="Remove bookmark"><X size={14} /></button>
    </NodeViewWrapper>
  )
}

export const BookmarkBlock = Node.create({
  name: 'bookmarkBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      url:         { default: '' },
      title:       { default: '' },
      description: { default: '' },
      favicon:     { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="bookmark"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'bookmark',
        'data-url': node.attrs.url,
        'data-title': node.attrs.title,
        'data-description': node.attrs.description,
        'data-favicon': node.attrs.favicon,
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(BookmarkBlockView)
  },
})
