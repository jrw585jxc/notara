import { useEffect, useRef, useState } from 'react'

interface SlashItem {
  id: string
  icon: string
  title: string
  desc: string
  group: string
  keywords: string[]
}

const ALL_ITEMS: SlashItem[] = [
  // Basic
  { id: 'h1',       icon: 'H1', title: 'Heading 1',    desc: 'Large section heading',        group: 'Basic',   keywords: ['heading', 'h1', 'title'] },
  { id: 'h2',       icon: 'H2', title: 'Heading 2',    desc: 'Medium section heading',       group: 'Basic',   keywords: ['heading', 'h2', 'subtitle'] },
  { id: 'h3',       icon: 'H3', title: 'Heading 3',    desc: 'Small section heading',        group: 'Basic',   keywords: ['heading', 'h3'] },
  { id: 'bullet',   icon: '•',  title: 'Bullet list',  desc: 'Create a simple list',         group: 'Basic',   keywords: ['list', 'bullet', 'ul', '-'] },
  { id: 'ordered',  icon: '1.', title: 'Numbered list', desc: 'List with numbering',         group: 'Basic',   keywords: ['list', 'numbered', 'ordered', 'ol'] },
  { id: 'todo',     icon: '☑',  title: 'To-do',        desc: 'Track tasks with checkboxes',  group: 'Basic',   keywords: ['todo', 'task', 'check', 'checkbox'] },
  { id: 'toggle',   icon: '▶',  title: 'Toggle',       desc: 'Collapsible block',            group: 'Basic',   keywords: ['toggle', 'collapse', 'fold', 'details', 'summary'] },
  { id: 'quote',    icon: '"',  title: 'Quote',        desc: 'Capture a quotation',          group: 'Basic',   keywords: ['quote', 'blockquote'] },
  { id: 'rule',     icon: '—',  title: 'Divider',      desc: 'Horizontal separator',         group: 'Basic',   keywords: ['divider', 'separator', 'hr', 'rule'] },

  // Media
  { id: 'image',    icon: '🖼', title: 'Image',        desc: 'Upload or embed an image',     group: 'Media',   keywords: ['image', 'photo', 'picture', 'img', 'png', 'jpg'] },
  { id: 'video',    icon: '🎬', title: 'Video',        desc: 'Embed a video file',           group: 'Media',   keywords: ['video', 'mp4', 'movie', 'film', 'clip'] },
  { id: 'audio',    icon: '🎵', title: 'Audio',        desc: 'Embed an audio file',          group: 'Media',   keywords: ['audio', 'music', 'sound', 'mp3', 'podcast'] },
  { id: 'file',     icon: '📎', title: 'File',         desc: 'Attach any file',              group: 'Media',   keywords: ['file', 'attachment', 'attach', 'upload', 'document'] },

  // Advanced
  { id: 'tabs',     icon: '📑', title: 'Tabs',         desc: 'Tabbed content sections',      group: 'Advanced', keywords: ['tabs', 'tab', 'tabbed', 'sections'] },
  { id: 'table',    icon: '⊞',  title: 'Table',        desc: 'Insert a 3×3 table',          group: 'Advanced', keywords: ['table', 'grid', 'database', 'spreadsheet', 'db'] },
  { id: 'code',     icon: '<>', title: 'Code block',   desc: 'Write code with syntax',       group: 'Advanced', keywords: ['code', 'codeblock', 'pre'] },
  { id: 'embed',    icon: '🌐', title: 'Embed',        desc: 'Paste a URL to embed inline',  group: 'Advanced', keywords: ['embed', 'iframe', 'url', 'website', 'link', 'web'] },
]

interface Props {
  x: number
  y: number
  query: string
  onSelect: (id: string) => void
  onClose: () => void
}

export function SlashMenu({ x, y, query, onSelect, onClose }: Props) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const filtered = ALL_ITEMS.filter(item => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      item.title.toLowerCase().includes(q) ||
      item.keywords.some(k => k.includes(q))
    )
  })

  // Group items
  const groups = Array.from(new Set(filtered.map(i => i.group)))

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault(); e.stopPropagation()
        setSelectedIndex(i => (i + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); e.stopPropagation()
        setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter') {
        e.preventDefault(); e.stopPropagation()
        if (filtered[selectedIndex]) onSelect(filtered[selectedIndex].id)
      } else if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [filtered, selectedIndex, onSelect, onClose])

  useEffect(() => { setSelectedIndex(0) }, [query])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  if (filtered.length === 0) {
    return (
      <div ref={menuRef} className="slash-menu" style={{ left: x, top: y }}>
        <div style={{ padding: '12px 16px', color: 'var(--text-tertiary)', fontSize: 13 }}>
          No results for "{query}"
        </div>
      </div>
    )
  }

  let flatIndex = 0

  const isEmoji = (s: string) => s.length <= 2 && /\p{Emoji}/u.test(s)

  return (
    <div ref={menuRef} className="slash-menu" style={{ left: x, top: y }}>
      {groups.map(group => {
        const groupItems = filtered.filter(i => i.group === group)
        return (
          <div key={group}>
            <div className="slash-menu-group-label">{group}</div>
            {groupItems.map(item => {
              const idx = flatIndex++
              const isSelected = idx === selectedIndex
              const emojiIcon = isEmoji(item.icon)
              return (
                <div
                  key={item.id}
                  className={`slash-menu-item${isSelected ? ' selected' : ''}`}
                  onMouseDown={e => { e.preventDefault(); onSelect(item.id) }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div
                    className="slash-menu-item-icon"
                    style={{
                      fontWeight: !emojiIcon ? 700 : 400,
                      fontSize: emojiIcon ? 18 : item.id.startsWith('h') ? 12 : 15,
                    }}
                  >
                    {item.icon}
                  </div>
                  <div className="slash-menu-item-info">
                    <div className="slash-menu-item-title">{item.title}</div>
                    <div className="slash-menu-item-desc">{item.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
