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
import {
  Bold, Italic, Strikethrough, Code, Highlighter, AlignLeft,
  Grid3X3, Plus, Trash2, ChevronRight, ChevronDown,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { SlashMenu } from './SlashMenu'

interface Props {
  content: string
  onChange: (html: string) => void
}

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

interface SlashState { x: number; y: number; query: string }

export function BlockEditor({ content, onChange }: Props) {
  const [slashMenu, setSlashMenu] = useState<SlashState | null>(null)
  const [slashStart, setSlashStart] = useState<number | null>(null)
  const [tableToolbar, setTableToolbar] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)

  const closeSlash = useCallback(() => {
    setSlashMenu(null)
    setSlashStart(null)
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
      Highlight.configure({ multicolor: false }),
      Link.configure({ openOnClick: false }),
      Typography,
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
    ],
    content,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML())

      // Table toolbar visibility
      setTableToolbar(ed.isActive('table'))

      // Slash command detection
      const { state } = ed
      const { selection } = state
      const { $from } = selection
      const lineText = $from.parent.textContent.slice(0, $from.parentOffset)
      const slashIdx = lineText.lastIndexOf('/')

      if (slashIdx === -1) { setSlashMenu(null); setSlashStart(null); return }

      const afterSlash = lineText.slice(slashIdx + 1)
      if (afterSlash.includes(' ') || afterSlash.length > 20) {
        setSlashMenu(null); setSlashStart(null); return
      }

      const domSel = window.getSelection()
      if (!domSel || domSel.rangeCount === 0) return
      const range = domSel.getRangeAt(0)
      const rect = range.getBoundingClientRect()
      const editorRect = editorRef.current?.getBoundingClientRect()
      if (!editorRect) return

      const absolutePos = $from.pos - afterSlash.length - 1
      setSlashStart(absolutePos)
      setSlashMenu({ x: rect.left - editorRect.left, y: rect.bottom - editorRect.top + 4, query: afterSlash })
    },
    onSelectionUpdate: ({ editor: ed }) => {
      setTableToolbar(ed.isActive('table'))
    },
    editorProps: { attributes: { class: 'ProseMirror', spellcheck: 'true' } },
  })

  // Sync content when page changes
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    const current = editor.getHTML()
    if (current !== content) {
      editor.commands.setContent(content)
    }
  }, [content]) // eslint-disable-line

  const onSlashCommand = useCallback((type: string) => {
    if (!editor || slashStart === null) return
    closeSlash()
    const { from } = editor.state.selection
    editor.chain().focus().deleteRange({ from: slashStart, to: from }).run()

    switch (type) {
      case 'h1': editor.chain().focus().toggleHeading({ level: 1 }).run(); break
      case 'h2': editor.chain().focus().toggleHeading({ level: 2 }).run(); break
      case 'h3': editor.chain().focus().toggleHeading({ level: 3 }).run(); break
      case 'bullet': editor.chain().focus().toggleBulletList().run(); break
      case 'ordered': editor.chain().focus().toggleOrderedList().run(); break
      case 'todo': editor.chain().focus().toggleTaskList().run(); break
      case 'quote': editor.chain().focus().toggleBlockquote().run(); break
      case 'code': editor.chain().focus().toggleCodeBlock().run(); break
      case 'rule': editor.chain().focus().setHorizontalRule().run(); break
      case 'table':
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        break
    }
  }, [editor, slashStart, closeSlash])

  if (!editor) return null

  const inTable = editor.isActive('table')

  return (
    <div ref={editorRef} style={{ position: 'relative' }}>
      <BubbleMenu editor={editor} className="formatting-toolbar">
        <FormatButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)">
          <Bold size={14} />
        </FormatButton>
        <FormatButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)">
          <Italic size={14} />
        </FormatButton>
        <FormatButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough">
          <Strikethrough size={14} />
        </FormatButton>
        <FormatButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Code">
          <Code size={14} />
        </FormatButton>
        <FormatButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight">
          <Highlighter size={14} />
        </FormatButton>
        <div className="formatting-toolbar-sep" />
        <FormatButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="H1">
          <span style={{ fontSize: 11, fontWeight: 700 }}>H1</span>
        </FormatButton>
        <FormatButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="H2">
          <span style={{ fontSize: 11, fontWeight: 700 }}>H2</span>
        </FormatButton>
        <div className="formatting-toolbar-sep" />
        <FormatButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="List">
          <AlignLeft size={14} />
        </FormatButton>
      </BubbleMenu>

      <EditorContent editor={editor} />

      {/* Table toolbar — shown when cursor is inside a table */}
      {tableToolbar && inTable && (
        <div className="table-toolbar">
          <span className="table-toolbar-label">
            <Grid3X3 size={12} /> Table
          </span>
          <div className="table-toolbar-sep" />
          <button
            className="btn btn-ghost table-toolbar-btn"
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().addColumnBefore().run() }}
            title="Insert column before"
          >
            <ChevronRight size={12} style={{ transform: 'scaleX(-1)' }} /><Plus size={10} /> Col left
          </button>
          <button
            className="btn btn-ghost table-toolbar-btn"
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().addColumnAfter().run() }}
            title="Insert column after"
          >
            <Plus size={10} /><ChevronRight size={12} /> Col right
          </button>
          <button
            className="btn btn-ghost table-toolbar-btn"
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().addRowBefore().run() }}
            title="Insert row above"
          >
            <ChevronDown size={12} style={{ transform: 'scaleY(-1)' }} /><Plus size={10} /> Row above
          </button>
          <button
            className="btn btn-ghost table-toolbar-btn"
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().addRowAfter().run() }}
            title="Insert row below"
          >
            <Plus size={10} /><ChevronDown size={12} /> Row below
          </button>
          <div className="table-toolbar-sep" />
          <button
            className="btn btn-ghost table-toolbar-btn table-toolbar-btn-danger"
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().deleteColumn().run() }}
            title="Delete column"
          >
            <Trash2 size={12} /> Del col
          </button>
          <button
            className="btn btn-ghost table-toolbar-btn table-toolbar-btn-danger"
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().deleteRow().run() }}
            title="Delete row"
          >
            <Trash2 size={12} /> Del row
          </button>
          <div className="table-toolbar-sep" />
          <button
            className="btn btn-ghost table-toolbar-btn table-toolbar-btn-danger"
            onMouseDown={e => { e.preventDefault(); editor.chain().focus().deleteTable().run() }}
            title="Delete table"
          >
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
    </div>
  )
}
