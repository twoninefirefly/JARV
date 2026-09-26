/**
 * The office's colour: every accent on screen and the glow of the brain, the
 * landing pad and the data trails. Each person picks their own; management
 * gets the Centurion look for presentations.
 */

export type ThemeId = 'orange' | 'pink' | 'blau' | 'gruen' | 'violett' | 'gelb' | 'gold' | 'silber' | 'platin' | 'centurion'

export type Theme = {
  id: ThemeId
  label: string
  /** Accent for buttons, rings and highlights. */
  accent: string
  /** A lighter tint of it, for text on dark and fine lines. */
  hi: string
  /** Deep shade, for embers and trails. */
  deep: string
  /** Cool, neutral surfaces instead of the warm brown ones. */
  cool?: boolean
  /** Metal: a sheen instead of a glow. */
  metal?: boolean
}

export const THEMES: Theme[] = [
  { id: 'orange', label: 'Pastell-Orange', accent: '#e8976c', hi: '#f6c3a4', deep: '#7a3a22' },
  { id: 'pink', label: 'Pink', accent: '#f06fa8', hi: '#f9b3d2', deep: '#7a2250' },
  { id: 'blau', label: 'Blau', accent: '#6fa3f0', hi: '#b3cff8', deep: '#1f3d7a', cool: true },
  { id: 'gruen', label: 'Grün', accent: '#72c98a', hi: '#b6e6c2', deep: '#1f5a33' },
  { id: 'violett', label: 'Violett', accent: '#a386f2', hi: '#d0c1fa', deep: '#3f2a7a', cool: true },
  { id: 'gelb', label: 'Gelb', accent: '#f0cf5e', hi: '#f8e6a6', deep: '#7a5f16' },
  { id: 'gold', label: 'Gold', accent: '#d4af37', hi: '#efd88f', deep: '#6b5212', metal: true },
  { id: 'silber', label: 'Silber', accent: '#b9c0c8', hi: '#e3e7ec', deep: '#4a5058', cool: true, metal: true },
  { id: 'platin', label: 'Platin', accent: '#dfe4ea', hi: '#ffffff', deep: '#5d6670', cool: true, metal: true },
  { id: 'centurion', label: 'Centurion', accent: '#a7aeb6', hi: '#e6e9ed', deep: '#2a2d31', cool: true, metal: true },
]

export const themeOf = (id: string | null | undefined): Theme => THEMES.find((t) => t.id === id) ?? THEMES[0]

/** What each person sees first: the boss presents in Centurion, Kim in pink. */
export function defaultTheme(userId: string | undefined): ThemeId {
  if (userId === 'leitung') return 'centurion'
  if (userId === 'leitung2') return 'pink'
  return 'orange'
}

/** The whole page follows: CSS variables on the root element. */
export function applyTheme(t: Theme) {
  const r = document.documentElement.style
  r.setProperty('--accent', t.accent)
  r.setProperty('--accent-hi', t.hi)
  r.setProperty('--accent-deep', t.deep)
  if (t.id === 'centurion') {
    // Black card: graphite, titanium and cool white.
    r.setProperty('--bg', '#08090a')
    r.setProperty('--surface', 'rgba(16, 17, 19, 0.96)')
    r.setProperty('--card', 'rgba(230, 236, 242, 0.035)')
    r.setProperty('--line', 'rgba(220, 228, 236, 0.1)')
    r.setProperty('--text', '#eef1f4')
    r.setProperty('--muted', '#8b929b')
  } else if (t.cool) {
    r.setProperty('--bg', '#0a0b0e')
    r.setProperty('--surface', 'rgba(18, 20, 25, 0.95)')
    r.setProperty('--card', 'rgba(225, 232, 245, 0.035)')
    r.setProperty('--line', 'rgba(215, 225, 240, 0.09)')
    r.setProperty('--text', '#edf0f5')
    r.setProperty('--muted', '#848c99')
  } else {
    for (const k of ['--bg', '--surface', '--card', '--line', '--text', '--muted']) r.removeProperty(k)
  }
  document.documentElement.dataset.officeTheme = t.id
}
