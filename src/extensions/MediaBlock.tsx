import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { FileText, Music, Download, X } from 'lucide-react'

function MediaBlockView({ node, deleteNode }: NodeViewProps) {
  const { mediaType, src, name } = node.attrs as {
    mediaType: 'image' | 'video' | 'audio' | 'file'
    src: string
    name: string
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    deleteNode()
  }

  const renderMedia = () => {
    switch (mediaType) {
      case 'image':
        return (
          <div className="media-block media-block-image">
            <img src={src} alt={name} className="media-image" />
            <button className="media-delete" onMouseDown={handleDelete} title="Remove image"><X size={14} /></button>
          </div>
        )
      case 'video':
        return (
          <div className="media-block media-block-video">
            <video src={src} controls className="media-video" />
            <button className="media-delete" onMouseDown={handleDelete} title="Remove video"><X size={14} /></button>
          </div>
        )
      case 'audio':
        return (
          <div className="media-block media-block-audio">
            <div className="media-audio-row">
              <Music size={16} className="media-audio-icon" />
              <span className="media-audio-name">{name}</span>
              <audio src={src} controls className="media-audio" />
            </div>
            <button className="media-delete" onMouseDown={handleDelete} title="Remove audio"><X size={14} /></button>
          </div>
        )
      case 'file':
        return (
          <div className="media-block media-block-file">
            <a href={src} className="media-file-link" target="_blank" rel="noreferrer" download={name}>
              <FileText size={18} />
              <span className="media-file-name">{name}</span>
              <Download size={14} className="media-file-download" />
            </a>
            <button className="media-delete" onMouseDown={handleDelete} title="Remove file"><X size={14} /></button>
          </div>
        )
      default:
        return null
    }
  }

  return (
    <NodeViewWrapper as="div" className="media-block-wrapper" contentEditable={false}>
      {renderMedia()}
    </NodeViewWrapper>
  )
}

export const MediaBlock = Node.create({
  name: 'mediaBlock',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      mediaType: { default: 'image' },
      src:       { default: '' },
      name:      { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="media-block"]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'media-block',
        'data-media-type': node.attrs.mediaType,
        'data-src': node.attrs.src,
        'data-name': node.attrs.name,
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MediaBlockView)
  },
})
