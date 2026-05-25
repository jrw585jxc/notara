// ── Accent colour palette ─────────────────────────────────────
// Each entry has light-mode and dark-mode variants chosen to
// match the saturation / depth of the original Notara orange.

export interface AccentColor {
  id: string
  label: string
  /** Representative swatch hex (light-mode value shown in the picker) */
  swatch: string
  light: { accent: string; hover: string; light: string }
  dark:  { accent: string; hover: string; light: string }
}

export const ACCENT_PALETTE: AccentColor[] = [
  {
    id: 'orange', label: 'Orange', swatch: '#c2610a',
    light: { accent: '#c2610a', hover: '#a34f06', light: 'rgba(194,97,10,0.10)' },
    dark:  { accent: '#e8943a', hover: '#f5a84d', light: 'rgba(232,148,58,0.14)' },
  },
  {
    id: 'red', label: 'Red', swatch: '#c0291a',
    light: { accent: '#c0291a', hover: '#a01f12', light: 'rgba(192,41,26,0.10)' },
    dark:  { accent: '#e85a42', hover: '#f07060', light: 'rgba(232,90,66,0.14)' },
  },
  {
    id: 'amber', label: 'Amber', swatch: '#b07d10',
    light: { accent: '#b07d10', hover: '#906508', light: 'rgba(176,125,16,0.10)' },
    dark:  { accent: '#d4a830', hover: '#e8c048', light: 'rgba(212,168,48,0.14)' },
  },
  {
    id: 'green', label: 'Green', swatch: '#1a7840',
    light: { accent: '#1a7840', hover: '#146030', light: 'rgba(26,120,64,0.10)' },
    dark:  { accent: '#4ab870', hover: '#60d088', light: 'rgba(74,184,112,0.14)' },
  },
  {
    id: 'teal', label: 'Teal', swatch: '#0d7878',
    light: { accent: '#0d7878', hover: '#086060', light: 'rgba(13,120,120,0.10)' },
    dark:  { accent: '#30c0c0', hover: '#48d8d8', light: 'rgba(48,192,192,0.14)' },
  },
  {
    id: 'blue', label: 'Blue', swatch: '#1060b8',
    light: { accent: '#1060b8', hover: '#0850a0', light: 'rgba(16,96,184,0.10)' },
    dark:  { accent: '#4a8ae0', hover: '#60a0f0', light: 'rgba(74,138,224,0.14)' },
  },
  {
    id: 'purple', label: 'Purple', swatch: '#7820c2',
    light: { accent: '#7820c2', hover: '#6010a8', light: 'rgba(120,32,194,0.10)' },
    dark:  { accent: '#a855f0', hover: '#c070ff', light: 'rgba(168,85,240,0.14)' },
  },
  {
    id: 'pink', label: 'Pink', swatch: '#be186a',
    light: { accent: '#be186a', hover: '#a00f58', light: 'rgba(190,24,106,0.10)' },
    dark:  { accent: '#e855a0', hover: '#f070b8', light: 'rgba(232,85,160,0.14)' },
  },
]

export function applyAccentColor(colorId: string, resolvedTheme: 'light' | 'dark') {
  const color = ACCENT_PALETTE.find(c => c.id === colorId) ?? ACCENT_PALETTE[0]
  const vars = resolvedTheme === 'dark' ? color.dark : color.light
  const root = document.documentElement
  root.style.setProperty('--accent',       vars.accent)
  root.style.setProperty('--accent-hover', vars.hover)
  root.style.setProperty('--accent-light', vars.light)
}
