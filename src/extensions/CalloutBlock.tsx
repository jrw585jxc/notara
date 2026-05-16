import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useState } from 'react'

const CALLOUT_COLORS: Record<string, string> = {
  yellow:  '#fef3c7',
  green:   '#d1fae5',
  blue:    '#dbeafe',
  purple:  '#ede9fe',
  pink:    '#fce7f3',
  orange:  '#ffedd5',
  red:     '#fee2e2',
  teal:    '#ccfbf1',
  gray:    '#f3f4f6',
}

const CALLOUT_EMOJIS = ['💡','ℹ️','⚠️','🚀','✅','❌','📌','🔥','💎','🎯','📢','🧠','💬','🌟','🔑']

function CalloutBlockView({ node, updateAttributes }: NodeViewProps) {
  const { emoji, color } = node.attrs as { emoji: string; color: string }
  const [showPicker, setShowPicker] = useState(false)
  const bg = CALLOUT_COLORS[color] || CALLOUT_COLORS.yellow

  return (
    <NodeViewWrapper as="div" className="callout-block" data-type="callout" style={{ background: bg }}>
      <div className="callout-side" contentEditable={false}>
        <div className="callout-emoji-btn" onClick={() => setShowPicker(v => !v)}>
          {emoji}
        </div>
        {showPicker && (
          <>
            <div className="callout-picker-overlay" onClick={() => setShowPicker(false)} />
            <div className="callout-picker">
              <div className="callout-picker-emojis">
                {CALLOUT_EMOJIS.map(e => (
                  <button key={e} className="callout-picker-emoji" onClick={() => { updateAttributes({ emoji: e }); setShowPicker(false) }}>
                    {e}
                  </button>
                ))}
              </div>
              <div className="callout-picker-colors">
                {Object.entries(CALLOUT_COLORS).map(([key, val]) => (
                  <button
                    key={key}
                    className={`callout-color-swatch${color === key ? ' active' : ''}`}
                    style={{ background: val }}
                    title={key}
                    onClick={() => { updateAttributes({ color: key }); setShowPicker(false) }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
      <NodeViewContent className="callout-content" />
    </NodeViewWrapper>
  )
}

export const CalloutBlock = Node.create({
  name: 'calloutBlock',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      emoji: { default: '💡' },
      color: { default: 'yellow' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="callout"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'callout' }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutBlockView)
  },
})
