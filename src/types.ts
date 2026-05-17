// ── Core types ────────────────────────────────────────────────

export type FontFamily = 'sans' | 'serif' | 'mono'
export type PageKind = 'page' | 'folder' | 'section' | 'sticky'
export type StickyColor = 'yellow' | 'blue' | 'green' | 'pink' | 'purple' | 'black' | 'white'

export interface Page {
  id: string
  title: string
  emoji: string
  parentId: string | null
  tags: string[]
  created: string      // ISO 8601
  modified: string     // ISO 8601
  order: number
  content: string      // HTML (TipTap output) stored inside the .md body
  filename: string     // disk filename e.g. "my-notes-k3x9f.md"
  fontFamily: FontFamily
  fullWidth: boolean
  kind: PageKind       // 'page' (default), 'folder', 'section', or 'sticky'
  color?: StickyColor  // sticky note color
}

export type Theme = 'light' | 'dark' | 'system'

export interface SearchResult {
  page: Page
  snippet: string
  score: number
}

// Encryption config stored in vault
export interface EncConfig {
  salt: string            // hex, for PBKDF2 master-key derivation
  verificationToken: string  // encrypted known string to verify master password
}

// Electron API exposed via preload
export interface NotaraAPI {
  vault: {
    select: () => Promise<string | null>
    get: () => Promise<string | null>
    set: (path: string) => Promise<boolean>
    openInExplorer: (path: string) => Promise<void>
    readEncConfig: (vaultPath: string) => Promise<EncConfig | null>
    writeEncConfig: (vaultPath: string, config: EncConfig) => Promise<{ ok: boolean; error?: string }>
  }
  pages: {
    readAll: (vaultPath: string) => Promise<Array<{ filename: string; content: string }>>
    readOne: (vaultPath: string, id: string) => Promise<string | null>
    write: (vaultPath: string, filename: string, content: string, oldFilename?: string) => Promise<{ ok: boolean; error?: string }>
    delete: (vaultPath: string, filename: string) => Promise<{ ok: boolean; error?: string }>
    importFile: (vaultPath: string) => Promise<{ filename: string; content: string; ext: string } | null>
    exportMd: (content: string, suggestedName: string) => Promise<boolean>
    exportHtml: (content: string, suggestedName: string) => Promise<boolean>
    exportPdf: (suggestedName: string) => Promise<boolean>
  }
  prefs: {
    getPinData: () => Promise<{ salt: string | null; verificationToken: string | null; wrappedMasterKey?: string | null }>
    setPinData: (data: { salt: string; verificationToken: string; wrappedMasterKey?: string }) => Promise<void>
    clearPinData: () => Promise<void>
  }
  media: {
    importFile: (vaultPath: string, fileType: 'image' | 'video' | 'audio' | 'file') => Promise<{ src: string; name: string; mimeType: string } | null>
    fetchBookmark: (url: string) => Promise<{ url: string; title: string; description: string; favicon: string }>
    saveBuffer: (vaultPath: string, filename: string, buffer: ArrayBuffer) => Promise<{ src: string; name: string; mimeType: string } | null>
  }
  sticky: {
    open: (id: string) => Promise<void>
    close: () => Promise<void>
    setAlwaysOnTop: (alwaysOnTop: boolean) => Promise<void>
    syncPage: (page: Page) => Promise<void>
  }
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<boolean>   // returns new isMaximized state
    close: () => Promise<void>
    isMaximized: () => Promise<boolean>
    platform: () => Promise<string>
  }
  on: (channel: string, callback: (...args: any[]) => void) => (() => void) | undefined
}

declare global {
  interface Window {
    notara: NotaraAPI
  }
}
