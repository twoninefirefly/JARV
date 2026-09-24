import { Suspense, lazy } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { COMPANY } from './data'
import { useOffice } from './state'
import Panel from './Panel'
import Workspace from './Workspace'

const Scene = lazy(() => import('./Scene'))

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
  return (
    <div className={`office${view.kind === 'overview' ? '' : ' is-open'}`}>
      <div className="stage">
        <Suspense fallback={<div className="loading">Büro wird aufgebaut …</div>}>
          <Scene />
        </Suspense>
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
