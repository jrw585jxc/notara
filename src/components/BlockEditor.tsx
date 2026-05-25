import { useEditor, EditorContent } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Link from '@tiptap/extension-link'
import Typography from '@tiptap/extension-typography'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import Underline from '@tiptap/extension-underline'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import {
  Bold, Italic, Strikethrough, Code, Highlighter, AlignLeft,
  Grid3X3, Plus, Trash2, ChevronRight,
  Underline as UnderlineIcon, Type, X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SlashMenu } from './SlashMenu'
import { useStore } from '../store/useStore'
import { ToggleBlock } from '../extensions/ToggleBlock'
import { MediaBlock } from '../extensions/MediaBlock'
import { TabGroup, TabPanel } from '../extensions/TabsBlock'
import { IframeBlock } from '../extensions/IframeBlock'

// ── Color palettes ────────────────────────────────────────────
const TEXT_COLORS = [
  { label: 'Default', color: '' },
  { label: 'Gray', color: '#9b9b97' },
  { label: 'Brown', color: '#9b6c4e' },
  { label: 'Orange', color: '#d97706' },
  { label: 'Yellow', color: '#ca8a04' },
  { label: 'Green', color: '#16a34a' },
  { label: 'Blue', color: '#2563eb' },
  { label: 'Purple', color: '#7c3aed' },
  { label: 'Pink', color: '#db2777' },
  { label: 'Red', color: '#dc2626' },
]

// Semi-transparent rgba highlights — look good on both light and dark backgrounds.
const HIGHLIGHT_COLORS = [
  { label: 'None',   color: '' },
  { label: 'Yellow', color: 'rgba(250,204,21,0.45)' },
  { label: 'Green',  color: 'rgba(34,197,94,0.38)' },
  { label: 'Blue',   color: 'rgba(59,130,246,0.38)' },
  { label: 'Purple', color: 'rgba(168,85,247,0.38)' },
  { label: 'Pink',   color: 'rgba(236,72,153,0.38)' },
  { label: 'Orange', color: 'rgba(249,115,22,0.42)' },
  { label: 'Red',    color: 'rgba(239,68,68,0.38)' },
  { label: 'Teal',   color: 'rgba(20,184,166,0.38)' },
  { label: 'Gray',   color: 'rgba(156,163,175,0.38)' },
]

const LS_CUSTOM_COLORS = 'notara:customColors'
function getCustomColors(): string[] {
  try { return JSON.parse(localStorage.getItem(LS_CUSTOM_COLORS) || '[]') } catch { return [] }
}
function addCustomColor(color: string) {
  const existing = getCustomColors()
  if (!existing.includes(color)) {
    localStorage.setItem(LS_CUSTOM_COLORS, JSON.stringify([color, ...existing].slice(0, 8)))
  }
}

// ── Format button ─────────────────────────────────────────────
function FormatButton({
  onClick, active, title, children,
}: {
  onClick: () => void; active?: boolean; title: string; children: React.ReactNode
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className="btn btn-icon btn-icon-sm btn-ghost"
      style={active ? { background: 'var(--bg-active)', color: 'var(--text-primary)' } : {}}
    >
      {children}
    </button>
  )
}

// ── Color picker panel ────────────────────────────────────────
function ColorPanel({
  type, onTextColor, onHighlight, currentTextColor, currentHighlight,
}: {
  type: 'text' | 'highlight'
  onTextColor: (color: string) => void
  onHighlight: (color: string) => void
  currentTextColor?: string
  currentHighlight?: string
}) {
  const [customColors, setCustomColors] = useState<string[]>(getCustomColors())
  const colorInputRef = useRef<HTMLInputElement>(null)
  const refreshCustom = () => setCustomColors(getCustomColors())

  // Native 'change' fires only when the OS color picker is closed/committed —
  // unlike React's onChange which fires on every drag. This prevents filling
  // the custom color slots with intermediate values.
  useEffect(() => {
    const el = colorInputRef.current
    if (!el) return
    const handleCommit = (e: Event) => {
      const color = (e.target as HTMLInputElement).value
      addCustomColor(color)
      refreshCustom()
    }
    el.addEventListener('change', handleCommit)
    return () => el.removeEventListener('change', handleCommit)
  }, [])

  if (type === 'text') {
    return (
      <div className="color-panel">
        <div className="color-panel-label">Text color</div>
        <div className="color-swatch-grid">
          {TEXT_COLORS.map(c => (
            <button
              key={c.color || 'default'}
              className={`color-swatch ${!c.color ? 'color-swatch-default' : ''} ${currentTextColor === c.color ? 'color-swatch-active' : ''}`}
              style={c.color ? { background: c.color } : {}}
              title={c.label}
              onMouseDown={e => { e.preventDefault(); onTextColor(c.color) }}
            >
              {!c.color && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)' }}>A</span>}
            </button>
          ))}
          {customColors.map(c => (
            <button key={c} className={`color-swatch ${currentTextColor === c ? 'color-swatch-active' : ''}`}
              style={{ background: c }} title={c}
              onMouseDown={e => { e.preventDefault(); onTextColor(c) }} />
          ))}
          <button className="color-swatch color-swatch-picker" title="Custom color"
            onMouseDown={e => { e.preventDefault(); colorInputRef.current?.click() }}>+</button>
        </div>
        {/* onChange = real-time preview only; saving happens via native 'change' listener above */}
        <input ref={colorInputRef} type="color"
          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
          onChange={e => onTextColor(e.target.value)} />
      </div>
    )
  }

  return (
    <div className="color-panel">
      <div className="color-panel-label">Highlight</div>
      <div className="color-swatch-grid">
        {HIGHLIGHT_COLORS.map(c => (
          <button
            key={c.color || 'none'}
            className={`color-swatch ${!c.color ? 'color-swatch-none' : ''} ${currentHighlight === c.color ? 'color-swatch-active' : ''}`}
            style={c.color ? { background: c.color } : {}}
            title={c.label}
            onMouseDown={e => { e.preventDefault(); onHighlight(c.color) }}
          >
            {!c.color && <span style={{ fontSize: 10 }}>∅</span>}
          </button>
        ))}
        {customColors.map(c => (
          <button key={'h-' + c} className={`color-swatch ${currentHighlight === c ? 'color-swatch-active' : ''}`}
            style={{ background: c }} title={c}
            onMouseDown={e => { e.preventDefault(); onHighlight(c) }} />
        ))}
        <button className="color-swatch color-swatch-picker" title="Custom highlight"
          onMouseDown={e => { e.preventDefault(); colorInputRef.current?.click() }}>+</button>
      </div>
      <input ref={colorInputRef} type="color"
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
        onChange={e => onHighlight(e.target.value)} />
    </div>
  )
}

// ── Context menu (right-click) ────────────────────────────────
interface SpellcheckData { word: string; suggestions: string[] }
interface CtxMenu { x: number; y: number; spellcheck?: SpellcheckData | null }

function ContextMenu({
  pos, editor, onClose,
}: {
  pos: CtxMenu
  editor: ReturnType<typeof useEditor>
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [showTextColors, setShowTextColors] = useState(false)
  const [showHighlights, setShowHighlights] = useState(false)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  if (!editor) return null

  const hasSelection = !editor.state.selection.empty
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(pos.x, window.innerWidth - 220),
    top: Math.min(pos.y, window.innerHeight - 300),
    zIndex: 800,
  }

  const notara = (window as any).notara

  return (
    <div ref={ref} className="context-menu ctx-rich" style={menuStyle}>
      {pos.spellcheck && (
        <>
          {pos.spellcheck.suggestions.length > 0
            ? pos.spellcheck.suggestions.map(word => (
                <div
                  key={word}
                  className="context-menu-item context-menu-item-spell"
                  onMouseDown={e => { e.preventDefault(); notara?.spellcheck?.replace(word); onClose() }}
                >
                  {word}
                </div>
              ))
            : <div className="context-menu-item context-menu-item-muted" style={{ pointerEvents: 'none' }}>
                No suggestions
              </div>
          }
          <div
            className="context-menu-item context-menu-item-muted"
            onMouseDown={e => { e.preventDefault(); notara?.spellcheck?.addWord(pos.spellcheck!.word); onClose() }}
          >
            Add "{pos.spellcheck.word}" to dictionary
          </div>
          <div className="context-menu-sep" />
        </>
      )}
      {hasSelection && (
        <>
          <div className="ctx-format-row">
            <button className={`btn btn-icon btn-icon-sm btn-ghost ${editor.isActive('bold') ? 'btn-active' : ''}`}
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run(); onClose() }} title="Bold"><Bold size={13} /></button>
            <button className={`btn btn-icon btn-icon-sm btn-ghost ${editor.isActive('italic') ? 'btn-active' : ''}`}
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); onClose() }} title="Italic"><Italic size={13} /></button>
            <button className={`btn btn-icon btn-icon-sm btn-ghost ${editor.isActive('underline') ? 'btn-active' : ''}`}
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); onClose() }} title="Underline"><UnderlineIcon size={13} /></button>
            <button className={`btn btn-icon btn-icon-sm btn-ghost ${editor.isActive('strike') ? 'btn-active' : ''}`}
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); onClose() }} title="Strikethrough"><Strikethrough size={13} /></button>
            <button className={`btn btn-icon btn-icon-sm btn-ghost ${editor.isActive('code') ? 'btn-active' : ''}`}
              onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleCode().run(); onClose() }} title="Code"><Code size={13} /></button>
          </div>
          <div className="context-menu-sep" />

          <div className="context-menu-item" onClick={() => setShowTextColors(v => !v)}>
            <Type size={13} /> Text color <ChevronRight size={11} style={{ marginLeft: 'auto' }} />
          </div>
          {showTextColors && (
            <div style={{ padding: '0 8px 4px' }}>
              <ColorPanel type="text"
                onTextColor={c => { if (c) editor.chain().focus().setColor(c).run(); else editor.chain().focus().unsetColor().run(); onClose() }}
                onHighlight={() => {}} currentTextColor={editor.getAttributes('textStyle').color} />
            </div>
          )}

          <div className="context-menu-item" onClick={() => setShowHighlights(v => !v)}>
            <Highlighter size={13} /> Highlight <ChevronRight size={11} style={{ marginLeft: 'auto' }} />
          </div>
          {showHighlights && (
            <div style={{ padding: '0 8px 4px' }}>
              <ColorPanel type="highlight"
                onTextColor={() => {}}
                onHighlight={c => { if (c) editor.chain().focus().setHighlight({ color: c }).run(); else editor.chain().focus().unsetHighlight().run(); onClose() }}
                currentHighlight={editor.getAttributes('highlight').color} />
            </div>
          )}
          <div className="context-menu-sep" />
        </>
      )}
      <div className="context-menu-item" onClick={() => { document.execCommand('copy'); onClose() }}>Copy</div>
      <div className="context-menu-item" onClick={() => { document.execCommand('cut'); onClose() }}>Cut</div>
      <div className="context-menu-item" onClick={() => { document.execCommand('paste'); onClose() }}>Paste</div>
    </div>
  )
}

// ── Bubble menu color panel toggle ────────────────────────────
function BubbleColorToggle({
  icon, label, active, children,
}: { icon: React.ReactNode; label: string; active?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onMouseDown={e => { e.preventDefault(); setOpen(v => !v) }}
        title={label}
        className="btn btn-icon btn-icon-sm btn-ghost"
        style={active || open ? { background: 'var(--bg-active)', color: 'var(--text-primary)' } : {}}
      >
        {icon}
      </button>
      {open && <div className="bubble-color-panel">{children}</div>}
    </div>
  )
}

// ── Media insertion dialog ─────────────────────────────────────
type MediaType = 'image' | 'video' | 'audio' | 'file'
interface MediaDialogState { mediaType: MediaType }

function MediaDialog({
  state, onConfirm, onClose,
}: { state: MediaDialogState; onConfirm: (src: string, name: string) => void; onClose: () => void }) {
  const { vault } = useStore()
  const [tab, setTab] = useState<'upload' | 'url'>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [urlValue, setUrlValue] = useState('')
  const urlInputRef = useRef<HTMLInputElement>(null)
  const { mediaType } = state
  const typeLabels: Record<MediaType, string> = { image: 'Image', video: 'Video', audio: 'Audio', file: 'File' }

  useEffect(() => {
    if (tab === 'url') setTimeout(() => urlInputRef.current?.focus(), 50)
  }, [tab])

  const handleUpload = async () => {
    if (!vault || typeof window.notara === 'undefined') return
    setLoading(true); setError('')
    const result = await window.notara.media.importFile(vault, mediaType)
    setLoading(false)
    if (!result) { setError('No file selected.'); return }
    onConfirm(result.src, result.name)
  }

  const handleUrlConfirm = () => {
    const u = urlValue.trim()
    if (!u) { setError('Please enter a URL.'); return }
    // Derive a filename from the URL path
    const name = u.split('/').filter(Boolean).pop() || mediaType
    onConfirm(u, name)
  }

  return (
    <div className="media-dialog-overlay" onClick={onClose}>
      <div className="media-dialog" onClick={e => e.stopPropagation()}>
        <div className="media-dialog-header">
          <span className="media-dialog-title">Insert {typeLabels[mediaType]}</span>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={14} /></button>
        </div>

        {/* Tab strip */}
        <div className="media-dialog-tabs">
          <button
            className={`media-dialog-tab${tab === 'upload' ? ' active' : ''}`}
            onClick={() => { setTab('upload'); setError('') }}
          >Upload</button>
          <button
            className={`media-dialog-tab${tab === 'url' ? ' active' : ''}`}
            onClick={() => { setTab('url'); setError('') }}
          >URL</button>
        </div>

        <div style={{ padding: '12px 16px 16px' }}>
          {tab === 'upload' ? (
            <>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 12px' }}>
                Choose a {typeLabels[mediaType].toLowerCase()} file from your computer.
              </p>
              <button className="btn btn-primary" onClick={handleUpload} disabled={loading}>
                {loading ? 'Importing…' : 'Choose file…'}
              </button>
            </>
          ) : (
            <>
              <input
                ref={urlInputRef}
                className="media-url-input"
                placeholder={mediaType === 'image' ? 'https://example.com/image.png' : 'https://'}
                value={urlValue}
                onChange={e => setUrlValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleUrlConfirm() }}
              />
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={handleUrlConfirm} disabled={!urlValue.trim()}>
                  Insert
                </button>
              </div>
            </>
          )}
          {error && <div className="media-dialog-error" style={{ marginTop: 8 }}>{error}</div>}
        </div>
      </div>
    </div>
  )
}

// ── Main editor ───────────────────────────────────────────────
interface SlashState { x: number; y: number; query: string }

interface Props {
  content: string
  onChange: (html: string) => void
  devMode?: boolean
}

const isElectron = typeof window !== 'undefined' && typeof (window as any).notara !== 'undefined'

export function BlockEditor({ content, onChange, devMode }: Props) {
  const { setCursorLine, vault } = useStore()
  const [slashMenu, setSlashMenu] = useState<SlashState | null>(null)
  const [slashStart, setSlashStart] = useState<number | null>(null)
  const [tableToolbar, setTableToolbar] = useState(false)
  const [contextMenu, setContextMenu] = useState<CtxMenu | null>(null)
  const [mediaDialog, setMediaDialog] = useState<MediaDialogState | null>(null)
  const [embedDialog, setEmbedDialog] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  // Track whether the last content change came from the editor itself.
  // When true, the useEffect below must NOT call setContent() — that would
  // destroy all React node-views and reset their local state (activeTab,
  // open, etc.) mid-typing.
  const isInternalUpdate = useRef(false)

  const closeSlash = useCallback(() => {
    setSlashMenu(null)
    setSlashStart(null)
  }, [])

  // Spellcheck: receive suggestions from main process before the menu opens
  const spellcheckRef = useRef<SpellcheckData | null>(null)
  useEffect(() => {
    if (!isElectron || typeof (window as any).notara?.on !== 'function') return
    const off = (window as any).notara.on(
      'spellcheck:context',
      (_: unknown, data: SpellcheckData) => { spellcheckRef.current = data },
    )
    return () => { if (typeof off === 'function') off() }
  }, [])

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === 'heading' ? 'Heading' : "Write something, or type '/' for commands…",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
      Typography,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      Underline,
      TextStyle,
      Color,
      ToggleBlock,
      MediaBlock,
      TabGroup,
      TabPanel,
      IframeBlock,
    ],
    content,
    onUpdate: ({ editor: ed }) => {
      isInternalUpdate.current = true
      onChange(ed.getHTML())
      setTableToolbar(ed.isActive('table'))
      const { state } = ed
      const { $from } = state.selection
      let line = 0
      state.doc.descendants((node, pos) => {
        if (pos < $from.pos && node.isBlock) line++
      })
      setCursorLine(Math.max(1, line))

      const { selection } = state
      const { $from: $f } = selection
      const lineText = $f.parent.textContent.slice(0, $f.parentOffset)
      const slashIdx = lineText.lastIndexOf('/')
      if (slashIdx === -1) { setSlashMenu(null); setSlashStart(null); return }
      const afterSlash = lineText.slice(slashIdx + 1)
      if (afterSlash.includes(' ') || afterSlash.length > 20) { setSlashMenu(null); setSlashStart(null); return }

      const domSel = window.getSelection()
      if (!domSel || domSel.rangeCount === 0) return
      const range = domSel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const editorRect = editorRef.current?.getBoundingClientRect()
      if (!editorRect) return

      setSlashStart($f.pos - afterSlash.length - 1)
      setSlashMenu({ x: rect.left - editorRect.left, y: rect.bottom - editorRect.top + 4, query: afterSlash })
    },
    onSelectionUpdate: ({ editor: ed }) => {
      setTableToolbar(ed.isActive('table'))
      const { state } = ed
      const { $from } = state.selection
      let line = 0
      state.doc.descendants((node, pos) => {
        if (pos < $from.pos && node.isBlock) line++
      })
      setCursorLine(Math.max(1, line))
    },
    editorProps: {
      attributes: { class: 'ProseMirror', spellcheck: 'true' },
      handlePaste: (_view, event) => {
        if (!isElectron || !vault) return false
        const files = event.clipboardData?.files
        if (!files || files.length === 0) return false

        // Only handle files (images, videos, audio, other)
        const file = files[0]
        const mime = file.type

        let mediaType: 'image' | 'video' | 'audio' | 'file' = 'file'
        if (mime.startsWith('image/')) mediaType = 'image'
        else if (mime.startsWith('video/')) mediaType = 'video'
        else if (mime.startsWith('audio/')) mediaType = 'audio'

        file.arrayBuffer().then(async (buf) => {
          const result = await (window as any).notara.media.saveBuffer(vault, file.name, buf)
          if (!result) return
          // Re-get editor ref since this is async
          const ed = editor
          if (!ed || ed.isDestroyed) return
          ed.chain().focus().insertContent({
            type: 'mediaBlock',
            attrs: { mediaType, src: result.src, name: result.name },
          }).run()
        })

        return true  // prevent default paste
      },
    },
  })

  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    // If this content change originated from the editor itself (user typing),
    // skip — the editor already has the right state and calling setContent()
    // would destroy all React node-views (resetting tab/toggle state).
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false
      return
    }
    const current = editor.getHTML()
    if (current !== content) editor.commands.setContent(content)
  }, [content]) // eslint-disable-line

  const onSlashCommand = useCallback((type: string) => {
    if (!editor || slashStart === null) return
    closeSlash()
    const { from } = editor.state.selection
    editor.chain().focus().deleteRange({ from: slashStart, to: from }).run()

    if (['image', 'video', 'audio', 'file'].includes(type)) {
      setMediaDialog({ mediaType: type as MediaType }); return
    }
    if (type === 'embed') { setEmbedDialog(true); return }
    switch (type) {
      case 'h1':      editor.chain().focus().toggleHeading({ level: 1 }).run(); break
      case 'h2':      editor.chain().focus().toggleHeading({ level: 2 }).run(); break
      case 'h3':      editor.chain().focus().toggleHeading({ level: 3 }).run(); break
      case 'bullet':  editor.chain().focus().toggleBulletList().run(); break
      case 'ordered': editor.chain().focus().toggleOrderedList().run(); break
      case 'todo':    editor.chain().focus().toggleTaskList().run(); break
      case 'quote':   editor.chain().focus().toggleBlockquote().run(); break
      case 'code':    editor.chain().focus().toggleCodeBlock().run(); break
      case 'rule':    editor.chain().focus().setHorizontalRule().run(); break
      case 'toggle':
        editor.chain().focus().insertContent({
          type: 'toggleBlock', attrs: { open: true }, content: [{ type: 'paragraph' }],
        }).run(); break
      case 'tabs':
        editor.chain().focus().insertContent({
          type: 'tabGroup', attrs: { activeTab: 0 }, content: [
            { type: 'tabPanel', attrs: { label: 'Tab 1' }, content: [{ type: 'paragraph' }] },
            { type: 'tabPanel', attrs: { label: 'Tab 2' }, content: [{ type: 'paragraph' }] },
          ],
        }).run(); break
      case 'table':
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break
    }
  }, [editor, slashStart, closeSlash])

  const insertMedia = useCallback((src: string, name: string) => {
    if (!editor || !mediaDialog) return
    editor.chain().focus().insertContent({
      type: 'mediaBlock', attrs: { mediaType: mediaDialog.mediaType, src, name },
    }).run()
    setMediaDialog(null)
  }, [editor, mediaDialog])

  const insertEmbed = useCallback((url: string) => {
    if (!editor || !url.trim()) return
    editor.chain().focus().insertContent({
      type: 'iframeBlock', attrs: { src: url.trim(), height: 400 },
    }).run()
    setEmbedDialog(false)
  }, [editor])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const x = e.clientX, y = e.clientY
    // Brief pause so the spellcheck:context IPC from main can arrive and
    // populate spellcheckRef before the menu is rendered.
    setTimeout(() => {
      setContextMenu({ x, y, spellcheck: spellcheckRef.current })
      spellcheckRef.current = null
    }, 30)
  }, [])

  if (!editor) return null
  const inTable = editor.isActive('table')

  return (
    <div ref={editorRef} style={{ position: 'relative' }}
      className={devMode ? 'editor-dev-mode' : ''} onContextMenu={handleContextMenu}>

      <BubbleMenu editor={editor} className="formatting-toolbar">
        <FormatButton onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive('paragraph')} title="Paragraph">
          <span style={{ fontSize: 11, fontWeight: 600 }}>P</span>
        </FormatButton>
        <FormatButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })} title="Heading 1">
          <span style={{ fontSize: 11, fontWeight: 700 }}>H1</span>
        </FormatButton>
        <FormatButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })} title="Heading 2">
          <span style={{ fontSize: 11, fontWeight: 700 }}>H2</span>
        </FormatButton>
        <div className="formatting-toolbar-sep" />
        <BubbleColorToggle
          icon={<span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'inherit',
            textDecoration: `underline 2px solid ${editor.getAttributes('textStyle').color || 'var(--text-primary)'}` }}>A</span>}
          label="Text color" active={!!editor.getAttributes('textStyle').color}>
          <ColorPanel type="text"
            onTextColor={c => { if (c) editor.chain().focus().setColor(c).run(); else editor.chain().focus().unsetColor().run() }}
            onHighlight={() => {}} currentTextColor={editor.getAttributes('textStyle').color} />
        </BubbleColorToggle>
        <div className="formatting-toolbar-sep" />
        <FormatButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold size={13} /></FormatButton>
        <FormatButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic size={13} /></FormatButton>
        <FormatButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><UnderlineIcon size={13} /></FormatButton>
        <FormatButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><Strikethrough size={13} /></FormatButton>
        <FormatButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code"><Code size={13} /></FormatButton>
        <div className="formatting-toolbar-sep" />
        <BubbleColorToggle icon={<Highlighter size={13} />} label="Highlight" active={editor.isActive('highlight')}>
          <ColorPanel type="highlight" onTextColor={() => {}}
            onHighlight={c => { if (c) editor.chain().focus().setHighlight({ color: c }).run(); else editor.chain().focus().unsetHighlight().run() }}
            currentHighlight={editor.getAttributes('highlight').color} />
        </BubbleColorToggle>
        <div className="formatting-toolbar-sep" />
        <FormatButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list"><AlignLeft size={13} /></FormatButton>
      </BubbleMenu>

      <EditorContent editor={editor} />

      {tableToolbar && inTable && (
        <div className="table-toolbar">
          <span className="table-toolbar-label"><Grid3X3 size={12} /> Table</span>
          <div className="table-toolbar-sep" />
          <button className="btn btn-ghost table-toolbar-btn" onMouseDown={e => { e.preventDefault(); editor.chain().focus().addColumnBefore().run() }}>
            <ChevronRight size={12} style={{ transform: 'scaleX(-1)' }} /><Plus size={10} /> Col left
          </button>
          <button className="btn btn-ghost table-toolbar-btn" onMouseDown={e => { e.preventDefault(); editor.chain().focus().addColumnAfter().run() }}>
            <Plus size={10} /><ChevronRight size={12} /> Col right
          </button>
          <button className="btn btn-ghost table-toolbar-btn" onMouseDown={e => { e.preventDefault(); editor.chain().focus().addRowBefore().run() }}>
            <ChevronRight size={12} style={{ transform: 'rotate(-90deg)' }} /><Plus size={10} /> Row above
          </button>
          <button className="btn btn-ghost table-toolbar-btn" onMouseDown={e => { e.preventDefault(); editor.chain().focus().addRowAfter().run() }}>
            <Plus size={10} /><ChevronRight size={12} style={{ transform: 'rotate(90deg)' }} /> Row below
          </button>
          <div className="table-toolbar-sep" />
          <button className="btn btn-ghost table-toolbar-btn danger" onMouseDown={e => { e.preventDefault(); editor.chain().focus().deleteTable().run() }}>
            <Trash2 size={12} /> Delete table
          </button>
        </div>
      )}

      {slashMenu && (
        <SlashMenu
          x={slashMenu.x} y={slashMenu.y} query={slashMenu.query}
          onSelect={onSlashCommand} onClose={closeSlash}
        />
      )}

      {contextMenu && (
        <ContextMenu
          pos={contextMenu} editor={editor}
          onClose={() => setContextMenu(null)}
        />
      )}

      {mediaDialog && (
        <MediaDialog
          state={mediaDialog}
          onConfirm={insertMedia}
          onClose={() => setMediaDialog(null)}
        />
      )}

      {embedDialog && (
        <EmbedDialog
          onConfirm={insertEmbed}
          onClose={() => setEmbedDialog(false)}
        />
      )}
    </div>
  )
}

// ── Embed URL dialog ─────────────────────────────────────────
function EmbedDialog({ onConfirm, onClose }: { onConfirm: (url: string) => void; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="media-dialog-overlay" onClick={onClose}>
      <div className="media-dialog embed-dialog" onClick={e => e.stopPropagation()}>
        <div className="media-dialog-header">
          <span className="media-dialog-title">Embed a URL</span>
          <button className="btn btn-icon btn-ghost" onClick={onClose}><X size={14} /></button>
        </div>
        <div style={{ padding: '12px 16px 16px' }}>
          <input
            ref={inputRef}
            className="media-url-input"
            placeholder="https://example.com"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onConfirm(url) }}
          />
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={() => onConfirm(url)} disabled={!url.trim()}>
              Embed
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
