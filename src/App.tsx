import { useEffect } from 'react'
import { useStore } from './store/useStore'
import { Layout } from './components/Layout'
import { VaultSetup } from './components/VaultSetup'

export default function App() {
  const { vault, theme, isLoading, initVault } = useStore()

  useEffect(() => { initVault() }, []) // eslint-disable-line

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
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', color: 'var(--text-tertiary)', fontSize: 14, gap: 10,
      }}>
        <span style={{
          display: 'inline-block', width: 16, height: 16,
          border: '2px solid var(--border-default)', borderTopColor: 'var(--accent)',
          borderRadius: '50%', animation: 'spin 0.8s linear infinite',
        }} />
        Loading your notes…
      </div>
    )
  }

  if (!vault) return <VaultSetup />
  return <Layout />
}
