import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import {
  Lock, Unlock, FileDown, FileUp,
  FileText, Globe, FileImage, ChevronRight, Shield, Maximize2,
} from 'lucide-react'
import { PinSetupModal, PinDisableModal } from './PinScreen'

interface Props {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  onClose: () => void
}

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

  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    }
  }, [anchorRef])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  if (!page) return null

  const fonts = [
    { key: 'sans' as const, label: 'Default', sample: 'Ag', fontStyle: { fontFamily: 'var(--font-sans)' } },
    { key: 'serif' as const, label: 'Serif', sample: 'Ag', fontStyle: { fontFamily: 'Georgia, serif' } },
    { key: 'mono' as const, label: 'Mono', sample: 'Ag', fontStyle: { fontFamily: 'var(--font-mono)' } },
  ]

  return (
    <>
      <div
        ref={menuRef}
        className="page-menu"
        style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 600 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Font family */}
        <div className="page-menu-section-label">Font</div>
        <div className="page-menu-fonts">
          {fonts.map(f => (
            <button
              key={f.key}
              className={`page-menu-font-btn ${page.fontFamily === f.key ? 'active' : ''}`}
              onClick={() => setPageFont(page.id, f.key)}
            >
              <span className="page-menu-font-sample" style={f.fontStyle}>{f.sample}</span>
              <span className="page-menu-font-label">{f.label}</span>
            </button>
          ))}
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
          <span>Import file…</span>
          <span className="page-menu-item-hint">.md .txt .html</span>
        </div>

        {/* Export submenu */}
        <div
          className="page-menu-item"
          onClick={() => setExportOpen(v => !v)}
        >
          <FileDown size={14} />
          <span>Export as…</span>
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
              <Unlock size={14} /> Disable PIN Lock
            </div>
          </>
        ) : (
          <div className="page-menu-item" onClick={() => setShowPinSetup(true)}>
            <Shield size={14} /> Enable PIN Lock
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
