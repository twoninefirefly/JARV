import { Component, Suspense, lazy, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { COMPANY } from './data'
import { useOffice } from './state'
import Panel from './Panel'
import Workspace from './Workspace'

/** One retry: a chunk request that fails once (a flaky connection) usually works the second time. */
const Scene = lazy(() => import('./Scene').catch(() => import('./Scene')))

/** If the 3D view cannot start, say so and offer a retry, instead of a black screen. */
class SceneGuard extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
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

/** The mark: a copper ring with a cut, drawn rather than borrowed. */
function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M19 7.5A8 8 0 1 0 20 13h-7" stroke="#d98a62" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

export default function Office() {
  const view = useOffice((s) => s.view)
  const show = useOffice((s) => s.show)
  const [attempt, setAttempt] = useState(0)
  return (
    <div className={`office${view.kind === 'overview' ? '' : ' is-open'}`}>
      <div className="stage">
        <SceneGuard key={attempt} onRetry={() => setAttempt((n) => n + 1)}>
          <Suspense fallback={<div className="loading">Büro wird aufgebaut …</div>}>
            <Scene />
          </Suspense>
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
        {view.kind !== 'overview' && (
          <button className="icon-btn icon-btn--lg" onClick={() => show({ kind: 'overview' })} aria-label="Zur Übersicht">
            ✕
          </button>
        )}
      </header>

      <AnimatePresence>
        {view.kind === 'overview' && (
          <motion.div className="hint" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            Tippe auf eine Abteilung · Ziehen dreht
          </motion.div>
        )}
      </AnimatePresence>

      <Panel />
      <Workspace />
    </div>
  )
}
