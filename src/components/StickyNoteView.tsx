import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { Pin, PinOff, X, Bold, Italic, List, ListOrdered } from 'lucide-react'
import { markdownToPage, pageToMarkdown } from '../lib/pageUtils'
import { type Page, type StickyColor } from '../types'

const isElectron = typeof window !== 'undefined' && typeof (window as any).notara !== 'undefined'

const COLORS: { value: StickyColor; label: string; bg: string; header: string; text: string }[] = [
  { value: 'yellow', label: 'Yellow', bg: '#fef9c3', header: '#fde047', text: '#713f12' },
  { value: 'blue',   label: 'Blue',   bg: '#dbeafe', header: '#93c5fd', text: '#1e3a5f' },
  { value: 'green',  label: 'Green',  bg: '#dcfce7', header: '#86efac', text: '#14532d' },
  { value: 'pink',   label: 'Pink',   bg: '#fce7f3', header: '#f9a8d4', text: '#831843' },
  { value: 'purple', label: 'Purple', bg: '#ede9fe', header: '#c4b5fd', text: '#3b0764' },
  { value: 'black',  label: 'Dark',   bg: '#191919', header: '#202020', text: '#e8e8e4' },
  { value: 'white',  label: 'Light',  bg: '#ffffff', header: '#f7f7f5', text: '#37352f' },
]

function colorTheme(color: StickyColor) {
  return COLORS.find(c => c.value === color) ?? COLORS[0]
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

interface StickyNoteViewProps {
  noteId: string
}

export function StickyNoteView({ noteId }: StickyNoteViewProps) {
  const [page, setPage] = useState<Page | null>(null)
  const [vault, setVault] = useState<string | null>(null)
  const [alwaysOnTop, setAlwaysOnTop] = useState(false)
  const [color, setColor] = useState<StickyColor>('yellow')
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [loading, setLoading] = useState(true)
  const pageRef = useRef<Page | null>(null)
  const vaultRef = useRef<string | null>(null)

  // Keep refs in sync so save callbacks always have fresh data
  useEffect(() => { pageRef.current = page }, [page])
  useEffect(() => { vaultRef.current = vault }, [vault])

  // Apply theme to document root
  const theme = colorTheme(color)
  useEffect(() => {
    document.documentElement.style.setProperty('--sticky-bg', theme.bg)
    document.documentElement.style.setProperty('--sticky-header', theme.header)
    document.documentElement.style.setProperty('--sticky-text', theme.text)
    document.body.style.background = theme.bg
  }, [theme])

  // Load page from vault on mount
  useEffect(() => {
    async function load() {
      if (!isElectron) return
      try {
        const v = await (window as any).notara.vault.get() as string | null
        setVault(v)
        vaultRef.current = v
        if (!v) return

        const files = await (window as any).notara.pages.readAll(v) as Array<{ filename: string; content: string }>
        for (const f of files) {
          const p = markdownToPage(f.content, f.filename)
          if (p?.id === noteId) {
            setPage(p)
            pageRef.current = p
            setColor(p.color ?? 'yellow')
            break
          }
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [noteId])

  // Save helper
  const savePage = useCallback(async (updates: Partial<Page>) => {
    const p = pageRef.current
    const v = vaultRef.current
    if (!p || !v || !isElectron) return
    const updated = { ...p, ...updates, modified: new Date().toISOString() }
    setPage(updated)
    pageRef.current = updated
    const md = pageToMarkdown(updated)
    await (window as any).notara.pages.write(v, updated.filename, md)
  }, [])

  const debouncedSave = useCallback((updates: Partial<Page>) => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => savePage(updates), 800)
  }, [savePage])

  // TipTap editor
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
      }),
      Placeholder.configure({ placeholder: 'Write something…' }),
    ],
    content: '',
    onUpdate({ editor }) {
      const html = editor.getHTML()
      if (pageRef.current && html !== pageRef.current.content) {
        debouncedSave({ content: html })
      }
    },
    editorProps: {
      attributes: {
        class: 'sticky-editor',
        spellcheck: 'true',
      },
    },
  })

  // Set initial content once page is loaded
  useEffect(() => {
    if (editor && page && !editor.isDestroyed) {
      const current = editor.getHTML()
      if (current !== page.content) {
        editor.commands.setContent(page.content, { emitUpdate: false })
      }
    }
  }, [editor, page?.id]) // eslint-disable-line

  // Title state
  const [title, setTitle] = useState('')
  useEffect(() => { if (page) setTitle(page.title) }, [page?.title]) // eslint-disable-line

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    debouncedSave({ title: e.target.value })
  }

  const handleTogglePin = async () => {
    const next = !alwaysOnTop
    setAlwaysOnTop(next)
    if (isElectron) await (window as any).notara.sticky.setAlwaysOnTop(next)
  }

  const handleClose = async () => {
    if (isElectron) await (window as any).notara.sticky.close()
    else window.close()
  }

  const handleColorChange = (c: StickyColor) => {
    setColor(c)
    setShowColorPicker(false)
    savePage({ color: c })
  }

  if (loading) {
    return (
      <div className="sticky-loading" style={{ background: theme.bg }}>
        <span className="sticky-loading-dot" />
      </div>
    )
  }

  if (!page) {
    return (
      <div className="sticky-error" style={{ background: theme.bg, color: theme.text }}>
        <p>Note not found.</p>
        <button onClick={handleClose}>Close</button>
      </div>
    )
  }

  return (
    <div className="sticky-window" style={{ '--sticky-bg': theme.bg, '--sticky-header': theme.header, '--sticky-text': theme.text } as React.CSSProperties}>
      {/* Header / titlebar */}
      <div className="sticky-header" style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
        {/* Left: color swatch button */}
        <div style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            className="sticky-color-btn"
            onClick={() => setShowColorPicker(v => !v)}
            title="Change color"
            style={{ background: theme.header }}
          />
          {showColorPicker && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 99 }}
                onClick={() => setShowColorPicker(false)}
              />
              <div className="sticky-color-picker">
                {COLORS.map(c => (
                  <button
                    key={c.value}
                    className={`sticky-color-dot${color === c.value ? ' active' : ''}`}
                    style={{ background: c.header }}
                    onClick={() => handleColorChange(c.value)}
                    title={c.label}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Title input */}
        <input
          className="sticky-title-input"
          value={title}
          onChange={handleTitleChange}
          placeholder="Note title"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
        />

        {/* Right: pin + close */}
        <div className="sticky-header-actions" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            className={`sticky-btn sticky-pin-btn${alwaysOnTop ? ' active' : ''}`}
            onClick={handleTogglePin}
            title={alwaysOnTop ? 'Unpin (always on top)' : 'Pin (always on top)'}
          >
            {alwaysOnTop ? <Pin size={13} /> : <PinOff size={13} />}
          </button>
          <button className="sticky-btn sticky-close-btn" onClick={handleClose} title="Close">
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="sticky-toolbar">
        <button
          className={`sticky-tool-btn${editor?.isActive('bold') ? ' active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleBold().run() }}
          title="Bold"
        >
          <Bold size={12} />
        </button>
        <button
          className={`sticky-tool-btn${editor?.isActive('italic') ? ' active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleItalic().run() }}
          title="Italic"
        >
          <Italic size={12} />
        </button>
        <div className="sticky-tool-sep" />
        <button
          className={`sticky-tool-btn${editor?.isActive('bulletList') ? ' active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleBulletList().run() }}
          title="Bullet list"
        >
          <List size={12} />
        </button>
        <button
          className={`sticky-tool-btn${editor?.isActive('orderedList') ? ' active' : ''}`}
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleOrderedList().run() }}
          title="Numbered list"
        >
          <ListOrdered size={12} />
        </button>
      </div>

      {/* Editor */}
      <div className="sticky-editor-wrap" onClick={() => editor?.commands.focus()}>
        <EditorContent editor={editor} />
      </div>

      {/* Footer */}
      <div className="sticky-footer">
        <span className="sticky-footer-date">
          {page.modified ? new Date(page.modified).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}
        </span>
      </div>
    </div>
  )
}
