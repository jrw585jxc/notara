// ── Core types ────────────────────────────────────────────────

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
}

export type Theme = 'light' | 'dark' | 'system'

export interface SearchResult {
  page: Page
  snippet: string
  score: number
}

// Electron API exposed via preload
export interface NotaraAPI {
  vault: {
    select: () => Promise<string | null>
    get: () => Promise<string | null>
    set: (path: string) => Promise<boolean>
    openInExplorer: (path: string) => Promise<void>
  }
  pages: {
    readAll: (vaultPath: string) => Promise<Array<{ filename: string; content: string }>>
    readOne: (vaultPath: string, id: string) => Promise<string | null>
    write: (vaultPath: string, id: string, content: string) => Promise<{ ok: boolean; error?: string }>
    delete: (vaultPath: string, id: string) => Promise<{ ok: boolean; error?: string }>
  }
  on: (channel: string, callback: (...args: any[]) => void) => (() => void) | undefined
}

declare global {
  interface Window {
    notara: NotaraAPI
  }
}
