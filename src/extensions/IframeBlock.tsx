import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import { useState, useRef, useCallback } from 'react'
import { X, GripVertical } from 'lucide-react'

// ── Node spec ────────────────────────────────────────────────
export const IframeBlock = Node.create({
  name: 'iframeBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: '' },
      height: { default: 400 },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="iframe-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'iframe-block' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(IframeNodeView)
  },
})

// ── React node view ──────────────────────────────────────────
function IframeNodeView({ node, updateAttributes, deleteNode, selected }: any) {
  const { src, height } = node.attrs as { src: string; height: number }
  const [resizing, setResizing] = useState(false)
  const startY = useRef(0)
  const startH = useRef(0)

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setResizing(true)
    startY.current = e.clientY
    startH.current = height

    const onMove = (ev: MouseEvent) => {
      const next = Math.max(120, startH.current + ev.clientY - startY.current)
      updateAttributes({ height: next })
    }
    const onUp = () => {
      setResizing(false)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [height, updateAttributes])

  // Normalize URL
  const normalizedSrc = src.startsWith('http') ? src : `https://${src}`

  return (
    <NodeViewWrapper className={`iframe-block${selected ? ' selected' : ''}`}>
      <div className="iframe-toolbar">
        <GripVertical size={13} className="iframe-drag-handle" data-drag-handle />
        <span className="iframe-url-label" title={normalizedSrc}>{normalizedSrc}</span>
        <button
          className="iframe-delete-btn"
          onClick={deleteNode}
          title="Remove embed"
          onMouseDown={e => e.preventDefault()}
        >
          <X size={12} />
        </button>
      </div>
      <div className="iframe-wrap" style={{ height }}>
        <iframe
          src={normalizedSrc}
          title="Embedded content"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          referrerPolicy="no-referrer"
          className="iframe-el"
        />
        {resizing && <div className="iframe-resize-overlay" />}
      </div>
      <div
        className="iframe-resize-handle"
        onMouseDown={onResizeMouseDown}
        title="Drag to resize"
      />
    </NodeViewWrapper>
  )
}
