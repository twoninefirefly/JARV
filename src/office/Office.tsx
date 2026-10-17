import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { COMPANY, DEPARTMENTS } from './data'
import { useOffice } from './state'
import { needsLeitung } from './team'
import { agentTarget, approvalsTarget, waitingOwner } from './workspaces'
import { GRUPPE, GRUPPE_FREIGABE } from './gruppe'
import { HV_KUNDE, KUNDE } from './kunden'
import Panel from './Panel'
import Workspace from './Workspace'
import Setup from './Setup'
import Cockpit from './Cockpit'
import Alert from './Alert'
import Search from './Search'
import Lock, { Mark } from './Lock'
import { useComms } from './comms'
import { Guard } from './Guard'
import { MOBILE } from './mobile'
import MobileHome from './Mobile'
import Palette from './Palette'
import { GARDEN_DONE_MS } from './gardenTiming'
import './styles/shell.css'

/** One retry: a chunk request that fails once (a flaky connection) usually works the second time. */
const Scene = lazy(() => import('./Scene').catch(() => import('./Scene')))

/**
 * If the 3D view fails, rebuild it by itself — twice — and only then say so
 * and offer a button, instead of leaving a black screen.
 */
class SceneGuard extends Component<{ children: ReactNode; attempt: number; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error('[scene]', error)
    if (this.props.attempt < 2) setTimeout(this.props.onRetry, 300)
  }
  render() {
    if (!this.state.failed) return this.props.children
    if (this.props.attempt < 2) return <div className="loading">Büro wird aufgebaut …</div>
    return (
      <div className="loading loading--error">
        <p>Die 3D-Ansicht konnte nicht geladen werden.</p>
        <button className="btn btn--primary" onClick={this.props.onRetry}>
          Neu laden
        </button>
      </div>
    )
  }
}

/** A mouse or trackpad: the hints say "Klicke" there, and mention Esc. */
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches

/**
 * Focus a floor badge once it is back. The badges leave the page while their
 * floor is open and return a frame or two after the camera starts back, so
 * this looks a few times instead of once.
 */
function focusSoon(selector: string, tries = 8) {
  setTimeout(() => {
    const el = document.querySelector<HTMLElement>(selector)
    if (el) el.focus({ preventScroll: true })
    else if (tries > 1) focusSoon(selector, tries - 1)
  }, 60)
}

/** Online or not, live: the office works with the network, so say so when it's gone. */
function Net() {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return (
    <span className={`net${online ? '' : ' net--off'}`} role="status" title={online ? 'Verbunden' : 'Keine Internetverbindung'}>
      <i />
      {online ? 'Online' : 'Offline · kein Internet'}
    </span>
  )
}

export default function Office() {
  const view = useOffice((s) => s.view)
  const show = useOffice((s) => s.show)
  const [attempt, setAttempt] = useState(0)
  const locked = useOffice((s) => s.locked)
  const lock = useOffice((s) => s.lock)
  const showSetup = useOffice((s) => s.showSetup)
  const showCockpit = useOffice((s) => s.showCockpit)
  const user = useOffice((s) => s.user)
  const signOut = useOffice((s) => s.signOut)
  const garden = useOffice((s) => s.garden)
  const setGarden = useOffice((s) => s.setGarden)
  // The page turns pink only once the garden has finished growing, not at the first blade of grass.
  const [bloomed, setBloomed] = useState(false)
  useEffect(() => {
    if (!garden) {
      setBloomed(false)
      return
    }
    const t = setTimeout(() => setBloomed(true), GARDEN_DONE_MS)
    return () => clearTimeout(t)
  }, [garden])
  // The scene starts loading the moment the password is right, under the
  // loading bar, and is torn down again on lock so nothing stays on screen.
  const [started, setStarted] = useState(false)
  useEffect(() => {
    if (locked) setStarted(false)
  }, [locked])
  useComms(!locked)
  const showPalette = useOffice((s) => s.showPalette)

  // Presenter keys, for a keyboard or a clicker (clickers send PageUp/PageDown
  // or the arrows): 1–9 fly to a floor, the arrows step around the ring, Esc
  // goes up one level, 0 or Home back to the overview, g into the brain, f to
  // every approval. Shift+Space sends Soley, Adrian and Cookie running through
  // the office; the bare space bar used to, and a presenter hits it by
  // accident. On a phone: tap the logo three times.
  const startRomp = useOffice((s) => s.startRomp)
  const showSearch = useOffice((s) => s.showSearch)
  const open = useOffice((s) => s.open)
  useEffect(() => {
    if (locked) return
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = /INPUT|TEXTAREA|SELECT/.test(t.tagName) || t.isContentEditable
      // Ctrl/Cmd+K anywhere, or "/" outside a text field, opens the search.
      if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        showSearch(true)
        return
      }
      // A dialog owns the keyboard, Esc included: it closes the dialog, not the floor behind it.
      if (typing || e.ctrlKey || e.metaKey || e.altKey || useOffice.getState().search || document.querySelector('[aria-modal="true"]')) return
      const v = useOffice.getState().view
      if (e.key === 'Escape') {
        if (v.kind === 'overview') return
        e.preventDefault()
        if (v.kind === 'dept' && v.agent) show({ kind: 'dept', id: v.id })
        else if (v.kind === 'neural') show({ kind: 'brain' })
        else {
          show({ kind: 'overview' })
          // Back where the keyboard left off: on the badge of the floor just closed.
          focusSoon(v.kind === 'dept' ? `.floor-badge[data-dept="${v.id}"]` : '[data-dept="brain"], .floor-badge--brain')
        }
        return
      }
      if (e.code === 'Space') {
        // On a button the space bar presses it, as it should.
        if (e.shiftKey && t.tagName !== 'BUTTON') {
          e.preventDefault()
          startRomp()
        }
        return
      }
      // Holding a key down should not send the camera round and round.
      if (e.repeat) return
      const go = (view: Parameters<typeof show>[0]) => {
        e.preventDefault()
        show(view)
      }
      const k = e.key.toLowerCase()
      if (/^[1-9]$/.test(k)) {
        const d = DEPARTMENTS[Number(k) - 1]
        if (d) go({ kind: 'dept', id: d.id })
      } else if (k === '0' || k === 'home') {
        if (v.kind !== 'overview') go({ kind: 'overview' })
      } else if (k === 'g') go({ kind: 'brain' })
      else if (k === 'f') {
        e.preventDefault()
        open(approvalsTarget(null))
      } else {
        const step = k === 'arrowright' || k === 'pagedown' ? 1 : k === 'arrowleft' || k === 'pageup' ? -1 : 0
        if (!step) return
        // DEPARTMENTS is already in ring order; from the overview the first step goes to either end.
        const n = DEPARTMENTS.length
        const at = v.kind === 'dept' ? DEPARTMENTS.findIndex((d) => d.id === v.id) : -1
        const next = at < 0 ? (step > 0 ? 0 : n - 1) : (at + step + n) % n
        go({ kind: 'dept', id: DEPARTMENTS[next].id })
      }
    }
    // In the capture phase, so the check for an open dialog runs before that
    // dialog's own Esc handler has closed it.
    window.addEventListener('keydown', key, true)
    return () => window.removeEventListener('keydown', key, true)
  }, [locked, startRomp, showSearch, show, open])
  const taps = useRef<number[]>([])
  const tapLogo = () => {
    const now = performance.now()
    taps.current = [...taps.current.filter((t) => now - t < 900), now]
    if (taps.current.length >= 3) {
      taps.current = []
      startRomp()
    }
  }

  // Lock by itself after a while without a touch — there are figures in here.
  useEffect(() => {
    if (locked) return
    let t = setTimeout(lock, COMPANY.autoLockMinutes * 60_000)
    const reset = () => {
      clearTimeout(t)
      t = setTimeout(lock, COMPANY.autoLockMinutes * 60_000)
    }
    // Moving the mouse while presenting counts as being there.
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel'] as const
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    return () => {
      clearTimeout(t)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [locked, lock])

  const stage = (
    <div className="stage">
      <SceneGuard key={attempt} attempt={attempt} onRetry={() => setAttempt((n) => n + 1)}>
        <Suspense fallback={<div className="loading">Büro wird aufgebaut …</div>}>{started && <Scene />}</Suspense>
      </SceneGuard>
    </div>
  )

  // What waits for the management's own signature, the group's filing first —
  // counted the way the Leitung cockpit counts it.
  const approved = useOffice((s) => s.approved)
  const toSign =
    user?.role === 'leitung' && !locked
      ? DEPARTMENTS.flatMap((d) => d.waiting.map((w, i) => ({ d, w, i })))
          .filter(({ w }) => !approved.includes(w) && needsLeitung(w))
          .sort((a, b) => (GRUPPE ? Number(b.w === GRUPPE_FREIGABE) - Number(a.w === GRUPPE_FREIGABE) : 0))
      : []
  const signNext = () => {
    const { d, w, i } = toSign[0]
    show({ kind: 'dept', id: d.id })
    // The record opens once the camera has nearly arrived, as from the cockpit.
    setTimeout(() => open(agentTarget(d, waitingOwner(d, i), w)), 900)
  }
  const verb = FINE ? 'Klicke' : 'Tippe'

  return (
    // No native drag anywhere: holding and moving on a label used to pull out a ghost copy of it.
    <div className={`office${MOBILE ? ' office--m' : ''}${view.kind === 'overview' ? '' : ' is-open'}${bloomed ? ' is-garden' : ''}`} onDragStart={(e) => e.preventDefault()}>
      {/* The top bar comes first in the page, as it does on screen, so Tab reaches it before the 3D badges. Behind the lock it is out of reach. */}
      <header className="topbar" inert={locked}>
        {MOBILE && !locked && (
          <button className="m-search" onClick={() => showSearch(true)} aria-label="Suchen">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </button>
        )}
        {/* Co-branded: the customer's logo stands where our mark would, left of the product name. */}
        <span className="topbar__mark" onClick={tapLogo}>
          {COMPANY.logo ? <img className="topbar__brandlogo" src={COMPANY.logo} alt={COMPANY.name} draggable={false} /> : <Mark />}
        </span>
        <span className="topbar__sep" aria-hidden />
        <span className="topbar__title">
          <h1>Agenten-Büro</h1>
          <span className="topbar__meta">
            {COMPANY.name}
            {COMPANY.demo && ' · Demo'}
            <Net />
          </span>
        </span>
        <span className="topbar__actions">
          {!locked && (
            <button className="topbar__setup topbar__search" onClick={() => showSearch(true)} aria-label="Suchen" title="Suchen (Strg K)">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <span>Suchen</span>
              <kbd>Strg K</kbd>
            </button>
          )}
          {!locked && (
            <button className="topbar__setup" onClick={() => showSetup(true)} aria-label="Einrichtung" title="Einrichtung">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 6h16M4 12h10M4 18h6M17 15l2 2 4-4" />
              </svg>
              <span>Einrichtung</span>
            </button>
          )}
          {!locked && (
            <button className="topbar__setup topbar__palette" onClick={() => showPalette(true)} aria-label="Farbe des Büros" title="Farbe des Büros">
              <span className="topbar__dot" aria-hidden />
              <span>Farbe</span>
            </button>
          )}
          {!locked && user?.role === 'leitung' && (
            <button className="topbar__setup topbar__leitung" onClick={() => showCockpit(true)} aria-label="Leitung" title="Bereich der Leitung">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>Leitung</span>
            </button>
          )}
          {!locked && user && (
            <button className="topbar__user" onClick={signOut} title={`${user.name} · Abmelden / Person wechseln`} aria-label={`${user.name} abmelden`}>
              <span className={`avatar avatar--${user.role}`} aria-hidden>
                {user.initials}
              </span>
              <span className="topbar__username">
                <b>{user.name}</b>
                <small>Abmelden</small>
              </span>
            </button>
          )}
          {view.kind !== 'overview' && !MOBILE && (
            <button className="icon-btn icon-btn--lg" onClick={() => show({ kind: 'overview' })} aria-label="Zur Übersicht">
              ✕
            </button>
          )}
          <button className="icon-btn icon-btn--lg" onClick={lock} aria-label="Sperren" title="Sperren">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
          </button>
        </span>
      </header>

      {/* main stays position: static, so .stage still sits against .office and Scene finds it as before. */}
      {MOBILE ? (
        <main className="m-page" inert={locked}>
          <MobileHome stage={stage} />
        </main>
      ) : (
        <main className="office__main" aria-label="Büro – 3D-Übersicht" inert={locked}>
          {stage}
        </main>
      )}

      {/* For the management the pill points at what waits for their signature; otherwise it explains the office. */}
      <AnimatePresence>
        {!MOBILE && view.kind === 'overview' && toSign.length > 0 ? (
          <motion.button key="sign" type="button" className="hint hint--cta" onClick={signNext} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <span aria-hidden>✎ </span>
            {toSign.length === 1 ? '1 Unterschrift wartet' : `${toSign.length} Unterschriften warten`} · {toSign[0].d.short}
            <span aria-hidden> →</span>
          </motion.button>
        ) : (
          !MOBILE &&
          !locked &&
          (view.kind === 'overview' || view.kind === 'neural') && (
            <motion.div key={view.kind} className="hint" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {view.kind === 'neural'
                ? `Jeder Punkt ist ein Agent · ${FINE ? 'anklicken' : 'antippen'} öffnet ihn`
                : window.innerWidth < 600
                  ? `${verb} auf eine Abteilung oder das Gehirn`
                  : `${verb} auf eine Abteilung · Doppelklick aufs Gehirn zoomt hinein${FINE ? ' · Esc zurück' : ''}`}
            </motion.div>
          )
        )}
      </AnimatePresence>

      {/* A failure in a sheet or window resets to the overview instead of blanking the page. */}
      <Guard name="panel" onError={() => useOffice.setState({ ws: null, view: { kind: 'overview' } })}>
        {!locked && <Alert />}
      <AnimatePresence>
        {garden && !locked && (
          <motion.button
            className="garden-exit"
            onClick={() => setGarden(false)}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
          >
            <span aria-hidden>🌹</span>
            <span>
              <b>Secret Garden</b>
              <small>Modus beenden</small>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
      {!locked && !MOBILE && <Panel />}
      </Guard>
      <Guard name="window" onError={() => useOffice.setState({ ws: null })}>
        {!locked && <Workspace />}
      </Guard>
      <Guard name="setup" onError={() => useOffice.setState({ setup: false })}>
        {!locked && <Setup />}
      </Guard>
 <Guard name="search" onError={() => useOffice.setState({ search: false })}>
        {!locked && <Search />}
      </Guard>
      <Guard name="palette" onError={() => useOffice.setState({ palette: false })}>
        {!locked && <Palette />}
      </Guard>
      <Guard name="cockpit" onError={() => useOffice.setState({ cockpit: false })}>
        {!locked && user?.role === 'leitung' && <Cockpit />}
      </Guard>
      <Lock onStart={() => setStarted(true)} />
      {/* Part of the page, not of a wrapper, so it takes the theme and can step aside for other UI. It stands above the lock too. */}
      {COMPANY.demo && (KUNDE || HV_KUNDE) && (
        // A footer, so the note sits in a landmark of its own like the rest of the page.
        <footer className="demo-ribbon">
          <b>Demo</b>
          <span role="note">
            {GRUPPE
              ? `Vorschau für die ${COMPANY.name} · keine offizielle Seite · Registerdaten aus öffentlicher Recherche, alles andere erfunden`
              : `Vorschau · keine Seite der ${COMPANY.name} · Zahlen erfunden`}
          </span>
        </footer>
      )}
    </div>
  )
}
