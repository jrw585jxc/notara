import { useState } from 'react'
import { FolderOpen, Loader } from 'lucide-react'
import { useStore } from '../store/useStore'

export function VaultSetup() {
  const { selectVault } = useStore()
  const [loading, setLoading] = useState(false)

  const handleSelect = async () => {
    setLoading(true)
    await selectVault()
    setLoading(false)
  }

  return (
    <div className="vault-setup">
      <div className="vault-setup-card">
        <div className="vault-setup-logo">🗒️</div>
        <h1 className="vault-setup-title">Welcome to Notara</h1>
        <p className="vault-setup-subtitle">
          Your private, offline Notion. Choose a folder to store your notes —
          put it inside your Proton Drive folder and it syncs automatically to all your devices.
        </p>

        <div className="vault-setup-features">
          <div className="vault-setup-feature">
            <span>✍️</span>
            <span>Rich block editor — headings, lists, code, tasks</span>
          </div>
          <div className="vault-setup-feature">
            <span>📂</span>
            <span>Nested pages with unlimited depth</span>
          </div>
          <div className="vault-setup-feature">
            <span>🔍</span>
            <span>Full-text search across all pages</span>
          </div>
          <div className="vault-setup-feature">
            <span>📄</span>
            <span>Saved as plain .md files — always readable</span>
          </div>
          <div className="vault-setup-feature">
            <span>☁️</span>
            <span>Sync via Proton Drive, iCloud, or any folder</span>
          </div>
          <div className="vault-setup-feature">
            <span>🌙</span>
            <span>Light, dark, and system theme modes</span>
          </div>
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px', fontSize: 15 }}
          onClick={handleSelect}
          disabled={loading}
        >
          {loading ? (
            <><Loader size={16} className="spinner" /> Opening…</>
          ) : (
            <><FolderOpen size={16} /> Choose vault folder</>
          )}
        </button>

        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-tertiary)' }}>
          You can change your vault folder anytime from File → Choose Vault Folder
        </p>
      </div>
    </div>
  )
}
