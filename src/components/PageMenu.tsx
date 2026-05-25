import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import {
  Lock, Unlock, FileDown, FileUp,
  FileText, Globe, FileImage, ChevronRight, Shield, Maximize2,
  ChevronLeft as ArrowLeft, ChevronRight as ArrowRight,
} from 'lucide-react'
import { PinSetupModal, PinDisableModal } from './PinScreen'
import { type FontFamily } from '../types'

interface Props {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
}

// All available fonts in display order
const FONTS: { key: FontFamily; label: string; stack: string }[] = [
  { key: 'sans',      label: 'Default',   stack: 'system-ui, -apple-system, sans-serif' },
  { key: 'humanist',  label: 'Humanist',  stack: 'Optima, Candara, sans-serif' },
  { key: 'rounded',   label: 'Rounded',   stack: 'ui-rounded, Nunito, sans-serif' },
  { key: 'trebuchet', label: 'Trebuchet', stack: "'Trebuchet MS', Helvetica, sans-serif" },
  { key: 'tahoma',    label: 'Tahoma',    stack: 'Tahoma, Geneva, sans-serif' },
  { key: 'serif',     label: 'Serif',     stack: 'Georgia, serif' },
  { key: 'palatino',  label: 'Palatino',  stack: 'Palatino, "Book Antiqua", serif' },
  { key: 'cambria',   label: 'Cambria',   stack: 'Cambria, "Hoefler Text", serif' },
  { key: 'garamond',  label: 'Garamond',  stack: 'Garamond, "EB Garamond", serif' },
  { key: 'times',     label: 'Times',     stack: '"Times New Roman", Times, serif' },
  { key: 'slab',      label: 'Slab',      stack: 'Rockwell, "Roboto Slab", serif' },
  { key: 'mono',      label: 'Mono',      stack: "'SF Mono', Consolas, monospace" },
  { key: 'courier',   label: 'Courier',   stack: '"Courier New", Courier, monospace' },
  { key: 'menlo',     label: 'Menlo',     stack: 'Menlo, Monaco, "Lucida Console", monospace' },
]

export function PageMenu({ anchorRef, onClose }: Props) {
  const {
    pages, activePageId, setPageFont,
    pinEnabled,
    importPage, exportCurrentMd, exportCurrentHtml, exportCurrentPdf,
    lockApp, toggleFullWidth,
  } = useStore()

  const page = pages.find(p => p.id === activePageId)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const [showPinSetup, setShowPinSetup] = useState(false)
  const [showPinDisable, setShowPinDisable] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const PAGE_SIZE = 3
  const totalPages = Math.ceil(FONTS.length / PAGE_SIZE)

  // Start on the page that contains the active font
  const getInitialPage = () => {
    if (!page) return 0
    const idx = FONTS.findIndex(f => f.key === (page.fontFamily || 'sans'))
    return Math.floor(Math.max(0, idx) / PAGE_SIZE)
  }
  const [fontPage, setFontPage] = useState(getInitialPage)

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
  }, [anchorRef])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showPinSetup || showPinDisable) return
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose, showPinSetup, showPinDisable])

  if (!page) return null

  return (
    <>
      <div
        ref={menuRef}
        className="page-menu"
        style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 600 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Font family — paged 3-at-a-time */}
        <div className="page-menu-section-label">Font</div>
        <div className="font-picker-row">
          <button
            className="font-picker-arrow"
            onClick={() => setFontPage(p => Math.max(0, p - 1))}
            disabled={fontPage === 0}
            title="Previous fonts"
          >
            <ArrowLeft size={13} />
          </button>

          <div className="font-picker-page">
            {FONTS.slice(fontPage * PAGE_SIZE, fontPage * PAGE_SIZE + PAGE_SIZE).map(f => (
              <button
                key={f.key}
                className={`font-picker-btn${(page.fontFamily || 'sans') === f.key ? ' active' : ''}`}
                onClick={() => setPageFont(page.id, f.key)}
                title={f.label}
              >
                <span className="font-picker-sample" style={{ fontFamily: f.stack }}>Ag</span>
                <span className="font-picker-label">{f.label}</span>
              </button>
            ))}
          </div>

          <button
            className="font-picker-arrow"
            onClick={() => setFontPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={fontPage >= totalPages - 1}
            title="Next fonts"
          >
            <ArrowRight size={13} />
          </button>
        </div>

        <div className="page-menu-sep" />

        {/* Full width */}
        <div
          className="page-menu-item"
          onClick={() => { toggleFullWidth(page.id); onClose() }}
        >
          <Maximize2 size={14} />
          <span>Full width</span>
          <div className={`page-menu-toggle ${page.fullWidth ? 'page-menu-toggle-on' : ''}`} />
        </div>

        <div className="page-menu-sep" />

        {/* Import */}
        <div
          className="page-menu-item"
          onClick={async () => { onClose(); await importPage() }}
        >
          <FileUp size={14} />
          <span>Import file&hellip;</span>
          <span className="page-menu-item-hint">.md .txt .html</span>
        </div>

        {/* Export submenu */}
        <div
          className="page-menu-item"
          onClick={() => setExportOpen(v => !v)}
        >
          <FileDown size={14} />
          <span>Export as&hellip;</span>
          <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.5, transform: exportOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
        </div>
        {exportOpen && (
          <div className="page-menu-sub">
            <div className="page-menu-item page-menu-item-sub" onClick={async () => { onClose(); await exportCurrentMd() }}>
              <FileText size={13} /> Markdown (.md)
            </div>
            <div className="page-menu-item page-menu-item-sub" onClick={async () => { onClose(); await exportCurrentHtml() }}>
              <Globe size={13} /> HTML (.html)
            </div>
            <div className="page-menu-item page-menu-item-sub" onClick={async () => { onClose(); await exportCurrentPdf() }}>
              <FileImage size={13} /> PDF (.pdf)
            </div>
          </div>
        )}

        <div className="page-menu-sep" />

        {/* PIN lock */}
        {pinEnabled ? (
          <>
            <div className="page-menu-item" onClick={() => { onClose(); lockApp() }}>
              <Lock size={14} /> Lock now
            </div>
            <div className="page-menu-item" onClick={() => setShowPinDisable(true)}>
              <Unlock size={14} /> Disable Encryption
            </div>
          </>
        ) : (
          <div className="page-menu-item" onClick={() => setShowPinSetup(true)}>
            <Shield size={14} /> Enable Encryption
          </div>
        )}
      </div>

      {showPinSetup && (
        <PinSetupModal onClose={() => { setShowPinSetup(false); onClose() }} />
      )}
      {showPinDisable && (
        <PinDisableModal
          onClose={() => setShowPinDisable(false)}
          onDisabled={() => { setShowPinDisable(false); onClose() }}
        />
      )}
    </>
  )
}
