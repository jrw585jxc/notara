import { useEffect, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useStore } from '../store/useStore'
import { searchPages } from '../lib/pageUtils'

export function SearchModal() {
  const { pages, setSearchOpen, setActivePage } = useStore()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = searchPages(pages, query)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  const handleSelect = (pageId: string) => {
    setActivePage(pageId)
    setSearchOpen(false)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setSearchOpen(false); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIndex(i => (i + 1) % Math.max(1, results.length)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIndex(i => (i - 1 + results.length) % Math.max(1, results.length)) }
      if (e.key === 'Enter') {
        if (results[selectedIndex]) handleSelect(results[selectedIndex].page.id)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [results, selectedIndex]) // eslint-disable-line

  // Highlight matching text
  function highlight(text: string, q: string) {
    if (!q) return text
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return text
    return (
      text.slice(0, idx) +
      `<mark style="background:rgba(255,212,0,0.3);border-radius:2px">${text.slice(idx, idx + q.length)}</mark>` +
      text.slice(idx + q.length)
    )
  }

  return (
    <div className="search-overlay" onClick={() => setSearchOpen(false)}>
      <div className="search-modal" onClick={e => e.stopPropagation()}>
        {/* Input */}
        <div className="search-input-wrap">
          <Search size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            className="search-input"
            placeholder="Search pages…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button className="btn btn-icon btn-ghost btn-icon-sm" onClick={() => setQuery('')}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="search-results">
          {!query && (
            <div className="search-empty">
              Type to search across all your pages
            </div>
          )}

          {query && results.length === 0 && (
            <div className="search-empty">
              No pages match "{query}"
            </div>
          )}

          {results.map((r, i) => (
            <div
              key={r.page.id}
              className={`search-result-item${i === selectedIndex ? ' selected' : ''}`}
              onClick={() => handleSelect(r.page.id)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="search-result-emoji">{r.page.emoji}</span>
              <div className="search-result-body">
                <div
                  className="search-result-title"
                  dangerouslySetInnerHTML={{ __html: highlight(r.page.title, query) }}
                />
                {r.snippet && (
                  <div
                    className="search-result-snippet"
                    dangerouslySetInnerHTML={{ __html: highlight(r.snippet, query) }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Hint bar */}
        <div className="search-hint">
          <span><kbd>↑↓</kbd> Navigate</span>
          <span><kbd>↵</kbd> Open</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
