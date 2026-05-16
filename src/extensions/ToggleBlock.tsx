import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

function ToggleBlockView({ node }: NodeViewProps) {
  // Local state only — updateAttributes dispatches a ProseMirror transaction
  // which races with typing and causes the block to vanish from the document.
  const [open, setOpen] = useState<boolean>((node.attrs.open as boolean) ?? true)
  return (
    <NodeViewWrapper
      as="div"
      className={`toggle-block${open ? ' open' : ''}`}
      data-type="toggle-block"
      data-open={String(open)}
    >
      <button
        className="toggle-arrow"
        contentEditable={false}
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v) }}
        aria-label={open ? 'Collapse' : 'Expand'}
      >
        <ChevronRight size={14} />
      </button>
      <NodeViewContent className="toggle-content" />
    </NodeViewWrapper>
  )
}

export const ToggleBlock = Node.create({
  name: 'toggleBlock',
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      open: { default: true, parseHTML: el => el.getAttribute('data-open') !== 'false' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="toggle-block"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'toggle-block' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleBlockView)
  },
})
