import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { BlockEditor } from './BlockEditor'
import { format } from 'date-fns'
import { X, Tag } from 'lucide-react'

const EMOJIS = ['📄','📝','📓','📔','📒','📕','📗','📘','📙','📚','📖','🗒️','🗓️','📅','📆',
  '💡','⭐','🌟','✨','🎯','🚀','💎','🔥','❤️','🎨','🎵','🎬','🏆','🌍','🌈',
  '🧠','💻','🔧','⚡','🌱','🦋','🎉','🍀','☕','🌙','☀️','🏠','🎭','📊','🔑']

export function PageView() {
  const { pages, activePageId, updatePage, saveStatus, devMode } = useStore()

  const page = pages.find(p => p.id === activePageId)

  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const tagInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (showTagInput) tagInputRef.current?.focus()
  }, [showTagInput])

  // Auto-resize title textarea
  useEffect(() => {
    if (!titleRef.current) return
    titleRef.current.style.height = 'auto'
    titleRef.current.style.height = titleRef.current.scrollHeight + 'px'
  }, [page?.title])

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!page) return
    updatePage(page.id, { title: e.target.value })
  }, [page, updatePage])

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      document.querySelector<HTMLElement>('.ProseMirror')?.focus()
    }
  }

  const handleContentChange = useCallback((html: string) => {
    if (!page) return
    updatePage(page.id, { content: html })
  }, [page, updatePage])

  const handleEmojiSelect = (emoji: string) => {
    if (!page) return
    updatePage(page.id, { emoji }, true)
    setShowEmojiPicker(false)
  }

  const handleAddTag = () => {
    if (!page || !tagInput.trim()) { setShowTagInput(false); setTagInput(''); return }
    const tag = tagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (!page.tags.includes(tag)) {
      updatePage(page.id, { tags: [...page.tags, tag] }, true)
    }
    setTagInput('')
    setShowTagInput(false)
  }

  const handleRemoveTag = (tag: string) => {
    if (!page) return
    updatePage(page.id, { tags: page.tags.filter(t => t !== tag) }, true)
  }

  if (!page) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🗒️</div>
        <div className="empty-state-title">No page selected</div>
        <div className="empty-state-desc">Select a page from the sidebar, or create a new one.</div>
      </div>
    )
  }

  if (page.kind === 'folder') {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📁</div>
        <div className="empty-state-title">{page.title}</div>
        <div className="empty-state-desc">
          This is a folder. Right-click it in the sidebar to add pages inside.
        </div>
      </div>
    )
  }

  if (page.kind === 'section') {
    return (
      <div className="empty-state">
        <div className="empty-state-icon" style={{ fontSize: 32 }}>—</div>
        <div className="empty-state-title">{page.title}</div>
        <div className="empty-state-desc">This is a section label for organising the sidebar.</div>
      </div>
    )
  }

  if (page.kind === 'sticky') {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🗒️</div>
        <div className="empty-state-title">{page.title}</div>
        <div className="empty-state-desc">This is a sticky note. Open it from the sidebar to edit it.</div>
      </div>
    )
  }

  const fontClass = `editor-font-${page.fontFamily || 'sans'}`

  return (
    <div className={`editor-area ${fontClass}`}>
      {/* Page header */}
      <div className={`page-header${page.fullWidth ? ' page-header-full' : ''}`}>
        {/* Dev mode: show .md filename at top */}
        {devMode && (
          <div className="dev-mode-file-header">
            <span className="dev-mode-filename">{page.filename}</span>
          </div>
        )}

        {/* Emoji selector — hidden in dev mode */}
        {!devMode && <div style={{ position: 'relative', display: 'inline-block' }}>
          <div
            className="page-emoji-button"
            onClick={() => setShowEmojiPicker(v => !v)}
            title="Change emoji"
          >
            {page.emoji}
          </div>

          {showEmojiPicker && (
            <>
              <div
                className="emoji-picker-overlay"
                onClick={() => setShowEmojiPicker(false)}
              />
              <div className="emoji-picker" style={{ top: 60, left: 0 }}>
                <div className="emoji-grid">
                  {EMOJIS.map(e => (
                    <div key={e} className="emoji-option" onClick={() => handleEmojiSelect(e)}>
                      {e}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>}

        {/* Title */}
        <textarea
          ref={titleRef}
          className="page-title-input"
          value={page.title}
          onChange={handleTitleChange}
          onKeyDown={handleTitleKeyDown}
          placeholder="Untitled"
          rows={1}
          spellCheck
        />

        {/* Tags */}
        <div className="page-tags">
          {page.tags.map(tag => (
            <span key={tag} className="tag" onClick={() => handleRemoveTag(tag)}>
              <Tag size={10} />
              {tag}
              <X size={10} />
            </span>
          ))}

          {showTagInput ? (
            <span className="tag tag-add">
              <Tag size={10} />
              <input
                ref={tagInputRef}
                className="tag-input"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onBlur={handleAddTag}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddTag()
                  if (e.key === 'Escape') { setShowTagInput(false); setTagInput('') }
                }}
                placeholder="tag name"
              />
            </span>
          ) : (
            <span className="tag tag-add" onClick={() => setShowTagInput(true)}>
              <Tag size={10} />
              Add tag
            </span>
          )}
        </div>

        {/* Meta */}
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', gap: 12 }}>
          <span>Created {format(new Date(page.created), 'MMM d, yyyy')}</span>
          <span>·</span>
          <span>Modified {format(new Date(page.modified), 'MMM d, h:mm a')}</span>
          {saveStatus === 'saving' && <span style={{ color: 'var(--accent)' }}>Saving…</span>}
          {saveStatus === 'saved' && <span style={{ color: 'var(--text-tertiary)' }}>Saved</span>}
          {saveStatus === 'error' && <span style={{ color: 'var(--danger)' }}>Save failed</span>}
        </div>
      </div>

      {/* Block editor */}
      <div className={`editor-content-wrap${page.fullWidth ? ' editor-content-wrap-full' : ''}`}>
        <BlockEditor
          key={page.id}
          content={page.content}
          onChange={handleContentChange}
          devMode={devMode}
        />
      </div>
    </div>
  )
}
