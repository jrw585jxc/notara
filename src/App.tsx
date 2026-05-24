import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { Layout } from './components/Layout'
import { VaultSetup } from './components/VaultSetup'
import { PinScreen } from './components/PinScreen'

export default function App() {
  const { vault, theme, isLoading, initVault, pinEnabled, pinLocked, createStickyNote, syncPageFromSticky } = useStore()

  useEffect(() => { initVault() }, []) // eslint-disable-line

  // Listen for menu-new-sticky from main process / tray
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).notara) return
    const off = (window as any).notara.on('menu-new-sticky', () => { createStickyNote() })
    return () => off?.()
  }, [createStickyNote])

  // Sync sticky note changes (title / color / content) back from sticky windows
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).notara) return
    const off = (window as any).notara.on('sticky:pageUpdated', (_event: any, page: any) => {
      syncPageFromSticky(page)
    })
    return () => off?.()
  }, [syncPageFromSticky])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark')
    } else if (theme === 'light') {
      root.setAttribute('data-theme', 'light')
    } else {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      root.setAttribute('data-theme', mq.matches ? 'dark' : 'light')
      const handler = (e: MediaQueryListEvent) => {
        root.setAttribute('data-theme', e.matches ? 'dark' : 'light')
      }
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  if (isLoading) {
    return (
      <div className="nt-splash">
        {/* Animated Notara mark */}
        <div className="nt-splash-mark">
          <svg viewBox="0 0 32 32" width="38" height="38" xmlns="http://www.w3.org/2000/svg">
            {/* The N stroke draws itself in */}
            <path
              className="nt-stroke"
              d="M7 25 L7 7 L25 25 L25 7"
              stroke="#f5f1e8"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              opacity="0.55"
            />
            {/* Five dots pop on sequentially */}
            <circle className="nt-dot nt-dot-1" cx="7"  cy="25" r="2.6" fill="#f5f1e8" />
            <circle className="nt-dot nt-dot-2" cx="7"  cy="7"  r="2.6" fill="#f5f1e8" />
            <circle className="nt-dot nt-dot-3" cx="25" cy="25" r="2.6" fill="#f5f1e8" />
            <circle className="nt-dot nt-dot-4" cx="25" cy="7"  r="2.6" fill="#f5f1e8" />
            <circle className="nt-dot nt-dot-5" cx="16" cy="16" r="3.0" fill="#f5f1e8" />
          </svg>
        </div>

        {/* Wordmark fades up */}
        <span className="nt-splash-wordmark">Notara</span>

        {/* Pulsing dots */}
        <div className="nt-splash-dots">
          <span /><span /><span />
        </div>
      </div>
    )
  }

  if (!vault) return <VaultSetup />

  // Show PIN unlock screen
  if (pinEnabled && pinLocked) {
    return <PinScreen mode="unlock" />
  }

  return <Layout />
}
