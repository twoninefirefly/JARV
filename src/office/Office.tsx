import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { COMPANY } from './data'
import { useOffice } from './state'
import Panel from './Panel'
import Workspace from './Workspace'
import Setup from './Setup'
import Lock, { Mark } from './Lock'
import { useComms } from './comms'
import { Guard } from './Guard'

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

export default function Office() {
  const view = useOffice((s) => s.view)
  const show = useOffice((s) => s.show)
  const [attempt, setAttempt] = useState(0)
  const locked = useOffice((s) => s.locked)
  const lock = useOffice((s) => s.lock)
  const showSetup = useOffice((s) => s.showSetup)
  // The scene starts loading the moment the password is right, under the
  // loading bar, and is torn down again on lock so nothing stays on screen.
  const [started, setStarted] = useState(false)
  useEffect(() => {
    if (locked) setStarted(false)
  }, [locked])
  useComms(!locked)

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

  return (
    <div className={`office${view.kind === 'overview' ? '' : ' is-open'}`}>
      <div className="stage">
        <SceneGuard key={attempt} attempt={attempt} onRetry={() => setAttempt((n) => n + 1)}>
          <Suspense fallback={<div className="loading">Büro wird aufgebaut …</div>}>{started && <Scene />}</Suspense>
        </SceneGuard>
      </div>

      <header className="topbar">
        <Mark />
        <h1>Agenten-Büro</h1>
        <span className="topbar__meta">
          <i />
          {COMPANY.name}
          {COMPANY.demo && ' · Demo'}
        </span>
        <span className="topbar__actions">
          {COMPANY.logo && !locked && <img className="topbar__logo" src={COMPANY.logo} alt={COMPANY.name} />}
          {!locked && (
            <button className="topbar__setup" onClick={() => showSetup(true)} aria-label="Einrichtung" title="Einrichtung">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M4 6h16M4 12h10M4 18h6M17 15l2 2 4-4" />
              </svg>
              <span>Einrichtung</span>
            </button>
          )}
          {view.kind !== 'overview' && (
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
        {(view.kind === 'overview' || view.kind === 'neural') && (
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
        {!locked && <Panel />}
      </Guard>
      <Guard name="window" onError={() => useOffice.setState({ ws: null })}>
        {!locked && <Workspace />}
      </Guard>
      <Guard name="setup" onError={() => useOffice.setState({ setup: false })}>
        {!locked && <Setup />}
      </Guard>
      <Lock onStart={() => setStarted(true)} />
    </div>
  )
}
