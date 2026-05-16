import { type Page, type PageKind, type StickyColor } from '../types'

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

export function slugifyFilename(title: string, id: string): string {
  const slug = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50) || 'untitled'
  const shortId = id.slice(0, 6)
  return `${slug}-${shortId}.md`
}

export function pageToMarkdown(page: Page): string {
  const lines = [
    '---',
    'id: "' + page.id + '"',
    'title: ' + JSON.stringify(page.title),
    'emoji: "' + page.emoji + '"',
    'parentId: ' + (page.parentId ? '"' + page.parentId + '"' : 'null'),
    'tags: [' + page.tags.map(t => JSON.stringify(t)).join(', ') + ']',
    'created: "' + page.created + '"',
    'modified: "' + page.modified + '"',
    'order: ' + String(page.order),
    'filename: "' + page.filename + '"',
    'fontFamily: "' + (page.fontFamily || 'sans') + '"',
    'fullWidth: ' + String(page.fullWidth ?? false),
    'kind: "' + (page.kind || 'page') + '"',
    ...(page.color ? ['color: "' + page.color + '"'] : []),
    '---',
    '',
  ]
  return lines.join('\n') + page.content
}

export function markdownToPage(raw: string, diskFilename?: string): Page | null {
  try {
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/)
    if (!fmMatch) return null
    const fmText = fmMatch[1]
    const content = raw.slice(fmMatch[0].length)

    const getStr = (key: string, def = '') => {
      const pat = new RegExp('^' + key + ':\\s*(.+)$', 'm')
      const m = fmText.match(pat)
      if (!m) return def
      return m[1].trim().replace(/^["']|["']$/g, '')
    }
    const getTags = () => {
      const m = fmText.match(/^tags:\s*\[(.*)\]$/m)
      if (!m || !m[1].trim()) return []
      return m[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean)
    }
    const getNum = (key: string, def = 0) => {
      const pat = new RegExp('^' + key + ':\\s*(\\d+)$', 'm')
      const m = fmText.match(pat)
      return m ? parseInt(m[1], 10) : def
    }

    const id = getStr('id')
    if (!id) return null
    const parentRaw = getStr('parentId', '')
    const fontFamilyRaw = getStr('fontFamily', 'sans')
    const fontFamily = ['sans', 'serif', 'mono'].includes(fontFamilyRaw)
      ? (fontFamilyRaw as 'sans' | 'serif' | 'mono')
      : 'sans'

    // Use filename from frontmatter if present, else from disk, else compute
    const title = getStr('title', 'Untitled')
    const fmFilename = getStr('filename', '')
    const filename = fmFilename || diskFilename || slugifyFilename(title, id)

    const fullWidthRaw = getStr('fullWidth', 'false')
    const kindRaw = getStr('kind', 'page')
    const kind: PageKind = ['page', 'folder', 'section', 'sticky'].includes(kindRaw)
      ? (kindRaw as PageKind) : 'page'
    const colorRaw = getStr('color', '')
    const color: StickyColor | undefined = ['yellow', 'blue', 'green', 'pink', 'purple', 'black', 'white'].includes(colorRaw)
      ? (colorRaw as StickyColor) : undefined

    return {
      id,
      title,
      emoji: getStr('emoji', '\u{1F4C4}'),
      parentId: parentRaw === 'null' || parentRaw === '' ? null : parentRaw,
      tags: getTags(),
      created: getStr('created', new Date().toISOString()),
      modified: getStr('modified', new Date().toISOString()),
      order: getNum('order'),
      content,
      filename,
      fontFamily,
      fullWidth: fullWidthRaw === 'true',
      kind,
      color,
    }
  } catch { return null }
}

export function buildTree(pages: Page[]): Page[] {
  return [...pages].filter(p => p.parentId === null).sort((a, b) => a.order - b.order)
}

export function getChildren(pages: Page[], parentId: string): Page[] {
  return pages.filter(p => p.parentId === parentId).sort((a, b) => a.order - b.order)
}

export function getAllDescendantIds(pages: Page[], pageId: string): string[] {
  const children = getChildren(pages, pageId)
  return children.flatMap(c => [c.id, ...getAllDescendantIds(pages, c.id)])
}

export function searchPages(pages: Page[], query: string, limit = 20) {
  if (!query.trim()) return []
  const q = query.toLowerCase()
  return pages.map(page => {
    const titleMatch = page.title.toLowerCase().includes(q)
    const contentText = page.content.replace(/<[^>]+>/g, ' ').toLowerCase()
    const contentMatch = contentText.includes(q)
    if (!titleMatch && !contentMatch) return null
    const score = (titleMatch ? 10 : 0) + (contentMatch ? 1 : 0)
    let snippet = ''
    if (contentMatch) {
      const idx = contentText.indexOf(q)
      const start = Math.max(0, idx - 40)
      const end = Math.min(contentText.length, idx + q.length + 80)
      snippet = (start > 0 ? '…' : '') + contentText.slice(start, end).trim() + (end < contentText.length ? '…' : '')
    }
    return { page, snippet, score }
  }).filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.score - a.score).slice(0, limit)
}

export function createNewPage(parentId: string | null = null, existingCount = 0, kind: PageKind = 'page'): Page {
  const now = new Date().toISOString()
  const id = generateId()
  const title = kind === 'folder' ? 'New Folder' : kind === 'section' ? 'New Section' : kind === 'sticky' ? 'New Sticky Note' : 'Untitled'
  return {
    id,
    title,
    emoji: kind === 'folder' ? '📁' : '\u{1F4C4}',
    parentId,
    tags: [],
    created: now,
    modified: now,
    order: existingCount,
    content: '<p></p>',
    filename: slugifyFilename(title, id),
    fontFamily: 'sans',
    fullWidth: false,
    kind,
    color: kind === 'sticky' ? 'yellow' : undefined,
  }
}
