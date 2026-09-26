import { Component, Suspense, lazy, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { COMPANY } from './data'
import { useOffice } from './state'
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
  // The scene starts loading the moment the password is right, under the
  // loading bar, and is torn down again on lock so nothing stays on screen.
  const [started, setStarted] = useState(false)
  useEffect(() => {
    if (locked) setStarted(false)
  }, [locked])
  useComms(!locked)

  // The space bar sends Soley, Adrian and Cookie running through the office
  // (not while typing). On a phone: tap the logo three times.
  const startRomp = useOffice((s) => s.startRomp)
  const showSearch = useOffice((s) => s.showSearch)
  useEffect(() => {
    if (locked) return
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      // Ctrl/Cmd+K anywhere, or "/" outside a text field, opens the search.
      if ((e.key.toLowerCase() === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !/INPUT|TEXTAREA/.test(t.tagName))) {
        e.preventDefault()
        showSearch(true)
        return
      }
      if (e.code !== 'Space' || /INPUT|TEXTAREA|SELECT|BUTTON/.test(t.tagName) || t.isContentEditable) return
      e.preventDefault()
      startRomp()
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [locked, startRomp, showSearch])
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

  return (
    // No native drag anywhere: holding and moving on a label used to pull out a ghost copy of it.
    <div className={`office${MOBILE ? ' office--m' : ''}${view.kind === 'overview' ? '' : ' is-open'}${garden ? ' is-garden' : ''}`} onDragStart={(e) => e.preventDefault()}>
      {MOBILE ? (
        <main className="m-page">
          <MobileHome stage={stage} />
        </main>
      ) : (
        stage
      )}

      <header className="topbar">
        <span className="topbar__mark" onClick={tapLogo}>
          <Mark />
        </span>
        <h1>Agenten-Büro</h1>
        <span className="topbar__meta">
          {COMPANY.name}
          {COMPANY.demo && ' · Demo'}
          <Net />
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
          {COMPANY.logo && !locked && <img className="topbar__logo" src={COMPANY.logo} alt={COMPANY.name} />}
          {!locked && (
            <button className="topbar__setup" onClick={() => showSetup(true)} aria-label="Einrichtung" title="Einrichtung">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 6h16M4 12h10M4 18h6M17 15l2 2 4-4" />
              </svg>
              <span>Einrichtung</span>
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

      <AnimatePresence>
        {!MOBILE && (view.kind === 'overview' || view.kind === 'neural') && (
          <motion.div key={view.kind} className="hint" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {view.kind === 'neural'
              ? 'Jeder Punkt ist ein Agent · antippen öffnet ihn'
              : window.innerWidth < 600
                ? 'Tippe auf eine Abteilung oder das Gehirn'
                : 'Tippe auf eine Abteilung · Doppelklick aufs Gehirn zoomt hinein'}
          </motion.div>
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
      <Guard name="cockpit" onError={() => useOffice.setState({ cockpit: false })}>
        {!locked && user?.role === 'leitung' && <Cockpit />}
      </Guard>
      <Lock onStart={() => setStarted(true)} />
    </div>
  )
}
