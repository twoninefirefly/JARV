import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { setStill, useOffice } from './state'
import { THEMES, type Theme, type ThemeId } from './themes'
import { useModal } from './modal'

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
  return <AnimatePresence>{open && <Picker key="palette" />}</AnimatePresence>
}

function Picker() {
  const close = useOffice((s) => s.showPalette)
  const theme = useOffice((s) => s.theme)
  const setTheme = useOffice((s) => s.setTheme)
  const user = useOffice((s) => s.user)
  const root = useRef<HTMLDivElement>(null)
  useModal(root, () => close(false))
  const [calm, setCalm] = useState(() => document.documentElement.dataset.still === '1')

  /**
   * The new colour grows as a circle out of the swatch that was picked, over
   * the whole page — the 3D office re-tints inside it. Where the browser
   * cannot do that, or motion is turned down, it simply switches.
   */
  const pick = (e: React.MouseEvent<HTMLElement>, id: ThemeId) => {
    const r = e.currentTarget.querySelector('.palette__swatch')?.getBoundingClientRect() ?? e.currentTarget.getBoundingClientRect()
    const page = document.documentElement
    page.style.setProperty('--vt-x', `${r.left + r.width / 2}px`)
    page.style.setProperty('--vt-y', `${r.top + r.height / 2}px`)
    if (id === theme || !('startViewTransition' in document) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTheme(id)
      return
    }
    document.startViewTransition(() => flushSync(() => setTheme(id)))
  }

  const toggleCalm = () => {
    setStill(!calm)
    setCalm(!calm)
  }

  return (
    <div className="sig" role="dialog" aria-modal="true" aria-label="Farbe des Büros" ref={root}>
      <motion.div className="sig__backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => close(false)} />
      <motion.div className="sig__card palette" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }}>
        <h3>Farbe des Büros</h3>
        <p className="sig__lead">Gilt für {user ? user.name.split(' ')[0] : 'Sie'} auf diesem Gerät – Knöpfe, Gehirn, Landeplatz und Datenströme.</p>
        <div className="palette__grid" role="radiogroup" aria-label="Farbe">
          {THEMES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} className="palette__item" onClick={(e) => pick(e, t.id)}>
              <span className="palette__swatch" style={{ background: swatch(t) }}>
                {theme === t.id && <span aria-hidden>✓</span>}
              </span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <button type="button" role="switch" aria-checked={calm} className="palette__calm" onClick={toggleCalm}>
          <span className="palette__track" aria-hidden>
            <span />
          </span>
          <span>
            <b>Ruhige Ansicht</b> – Büro dreht sich nicht
          </span>
        </button>
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
  )
}
