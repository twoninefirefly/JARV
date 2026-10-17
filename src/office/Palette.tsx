import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useOffice } from './state'
import { THEMES, type Theme } from './themes'

/** Metals get a sheen, the rest a soft glow — so the swatch looks like the result. */
const swatch = (t: Theme) =>
  t.id === 'centurion'
    ? 'linear-gradient(135deg, #2a2d31 0%, #0c0d0f 45%, #a7aeb6 100%)'
    : t.metal
      ? `linear-gradient(135deg, ${t.hi} 0%, ${t.accent} 45%, ${t.deep} 100%)`
      : `radial-gradient(circle at 35% 30%, ${t.hi}, ${t.accent} 60%, ${t.deep})`

/** Pick the office's colour: every accent, the brain, the landing pad and the trails follow. */
export default function Palette() {
  const open = useOffice((s) => s.palette)
  const close = useOffice((s) => s.showPalette)
  const theme = useOffice((s) => s.theme)
  const setTheme = useOffice((s) => s.setTheme)
  const user = useOffice((s) => s.user)

  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open, close])

  return (
    <AnimatePresence>
      {open && (
        <div className="sig" role="dialog" aria-modal="true" aria-label="Farbe des Büros">
          <motion.div className="sig__backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => close(false)} />
          <motion.div className="sig__card palette" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }}>
            <h3>Farbe des Büros</h3>
            <p className="sig__lead">Gilt für {user ? user.name.split(' ')[0] : 'Sie'} auf diesem Gerät – Knöpfe, Gehirn, Landeplatz und Datenströme.</p>
            <div className="palette__grid" role="radiogroup" aria-label="Farbe">
              {THEMES.map((t) => (
                <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} className="palette__item" onClick={() => setTheme(t.id)}>
                  <span className="palette__swatch" style={{ background: swatch(t) }}>
                    {theme === t.id && <span aria-hidden>✓</span>}
                  </span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
            <div className="sig__actions">
              <span />
              <span />
              <span />
              <button type="button" className="btn btn--primary" onClick={() => close(false)}>
                Fertig
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
