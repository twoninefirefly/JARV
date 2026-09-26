import { useEffect, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BRAIN, COMPANY, DEPARTMENTS, fmt, split } from './data'
import { useOffice } from './state'
import { Icon } from './Icon'
import { Feed } from './Panel'
import { agentTarget, approvalsTarget, logTarget, waitingOwner } from './workspaces'
import { mayDecide } from './team'

/**
 * The office on a phone, as one page in portrait: a greeting and what waits,
 * the 3D office as a card, then everything else stacked to scroll — decisions,
 * departments, the live traffic between the agents, and the shortcuts.
 * Every tap opens the same full-screen windows as on the big screen.
 */

function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}

const greeting = (d: Date) => {
  const h = d.getHours()
  return h >= 18 || h < 3 ? 'Guten Abend' : h < 12 ? 'Guten Morgen' : 'Guten Tag'
}

function Block({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="m-block">
      <div className="m-block__head">
        <h2>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** Under the 3D card: what is selected up there, with the next step one tap away. */
function Strip() {
  const view = useOffice((s) => s.view)
  const show = useOffice((s) => s.show)
  const open = useOffice((s) => s.open)
  const d = view.kind === 'dept' ? DEPARTMENTS.find((x) => x.id === view.id) : undefined
  return (
    <AnimatePresence mode="wait" initial={false}>
      {d ? (
        <motion.div key={d.id} className="m-strip" style={{ ['--c' as string]: d.color }} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
          <div className="m-strip__head">
            <span className="m-strip__icon">
              <Icon name={d.icon} size={16} />
            </span>
            <span>
              <b>{d.name}</b>
              <small>
                {d.agents.length} Agenten · {d.tagline}
              </small>
            </span>
            <button className="m-strip__close" onClick={() => show({ kind: 'overview' })} aria-label="Zur Übersicht">
              ✕
            </button>
          </div>
          <div className="m-chips">
            {d.agents.map((a) => (
              <button
                key={a.id}
                className={a.lead ? 'is-lead' : undefined}
                onClick={() => {
                  show({ kind: 'dept', id: d.id, agent: a.id })
                  open(agentTarget(d, a))
                }}
              >
                <i className={`m-dot m-dot--${a.status}`} />
                {a.name}
              </button>
            ))}
          </div>
          <button className="m-go" onClick={() => open(agentTarget(d, d.agents.find((a) => a.lead) ?? d.agents[0]))}>
            Arbeitsbereich öffnen →
          </button>
        </motion.div>
      ) : view.kind === 'brain' || view.kind === 'neural' ? (
        <motion.div key="brain" className="m-strip" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
          <div className="m-strip__head">
            <span className="m-strip__icon">
              <Icon name="brain" size={16} />
            </span>
            <span>
              <b>Das Gehirn</b>
              <small>{fmt(BRAIN.stats[0].value)} Dokumente · das Gedächtnis des Büros</small>
            </span>
            <button className="m-strip__close" onClick={() => show({ kind: 'overview' })} aria-label="Zur Übersicht">
              ✕
            </button>
          </div>
          <div className="m-strip__actions">
            <button className="m-go" onClick={() => show({ kind: view.kind === 'neural' ? 'brain' : 'neural' })}>
              {view.kind === 'neural' ? 'Zurück zum Gehirn' : 'Ins Gehirn zoomen'}
            </button>
            <button className="m-go" onClick={() => open(logTarget(null))}>
              Protokoll →
            </button>
          </div>
        </motion.div>
      ) : (
        <motion.p key="hint" className="m-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          Tippe auf eine Abteilung oder das Gehirn · mit zwei Fingern drehen und zoomen
        </motion.p>
      )}
    </AnimatePresence>
  )
}

export default function MobileHome({ stage }: { stage: ReactNode }) {
  const now = useNow()
  const user = useOffice((s) => s.user)
  const locked = useOffice((s) => s.locked)
  const approved = useOffice((s) => s.approved)
  const show = useOffice((s) => s.show)
  const open = useOffice((s) => s.open)
  const showSearch = useOffice((s) => s.showSearch)
  const showSetup = useOffice((s) => s.showSetup)
  const showCockpit = useOffice((s) => s.showCockpit)
  const signOut = useOffice((s) => s.signOut)

  const waiting = DEPARTMENTS.flatMap((d) => d.waiting.map((w, i) => ({ d, w, i }))).filter(({ w }) => !approved.includes(w))
  const mine = waiting.filter(({ d, w }) => mayDecide(user, d.id, w).ok)
  const done = DEPARTMENTS.reduce((n, d) => n + split(d.runs, now).done, 0)
  const agents = DEPARTMENTS.reduce((n, d) => n + d.agents.length, 0)
  const working = DEPARTMENTS.reduce((n, d) => n + d.agents.filter((a) => a.status === 'arbeitet').length, 0)

  const toStage = () => document.querySelector('.m-stage')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <>
      {!locked && user && (
        <section className="m-hello">
          <div className="eyebrow">{now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h2>
            {greeting(now)}, {user.name.split(' ')[0]}
          </h2>
          <div className="m-kpis">
            <button onClick={() => open(approvalsTarget(null))} className={waiting.length ? 'is-warn' : 'is-ok'}>
              <b>{waiting.length ? mine.length : '✓'}</b>
              <small>{waiting.length ? 'warten auf Sie' : 'alles erledigt'}</small>
            </button>
            <button onClick={() => open(logTarget(null, 'done'))}>
              <b>{fmt(done)}</b>
              <small>heute erledigt</small>
            </button>
            <button onClick={toStage}>
              <b>
                {working}/{agents}
              </b>
              <small>Agenten aktiv</small>
            </button>
          </div>
        </section>
      )}

      <section className="m-stage">
        <div className="m-stage__view">{stage}</div>
        {!locked && <Strip />}
      </section>

      {!locked && (
        <>
          <Block
            title="Wartet auf Freigabe"
            aside={
              waiting.length ? (
                <span className="pill">
                  <i /> {waiting.length}
                </span>
              ) : (
                <span className="pill pill--done">✓ Alles erledigt</span>
              )
            }
          >
            {waiting.length ? (
              <ul className="m-list">
                {waiting.map(({ d, w, i }) => (
                  <li key={w} style={{ ['--c' as string]: d.color }}>
                    <button onClick={() => open(agentTarget(d, waitingOwner(d, i), w))}>
                      <span className="m-list__bar" />
                      <span className="m-list__main">
                        <b>{w.replace(/ (freigeben|durchsehen)$/, '')}</b>
                        <small>
                          {d.short} · {waitingOwner(d, i).name}
                          {!mayDecide(user, d.id, w).ok && ' · nur ansehen'}
                        </small>
                      </span>
                      <span className="m-list__go">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-empty">✓ Nichts offen – alles für heute erledigt.</p>
            )}
          </Block>

          <Block title="Abteilungen" aside={<span className="m-aside">{DEPARTMENTS.length} Bereiche</span>}>
            <div className="m-depts">
              {DEPARTMENTS.map((d) => {
                const open = d.waiting.filter((w) => !approved.includes(w)).length
                return (
                  <button
                    key={d.id}
                    className="m-dept"
                    style={{ ['--c' as string]: d.color }}
                    onClick={() => {
                      show({ kind: 'dept', id: d.id })
                      toStage()
                    }}
                  >
                    <span className="m-dept__top">
                      <span className="m-strip__icon">
                        <Icon name={d.icon} size={15} />
                      </span>
                      {open > 0 && <span className="m-dept__badge">{open}</span>}
                    </span>
                    <b>{d.short}</b>
                    <small>{d.tagline}</small>
                    <span className="m-dept__kpi">
                      <b>{fmt(d.kpis[0].value)}</b> {d.kpis[0].label}
                    </span>
                  </button>
                )
              })}
            </div>
          </Block>

          <Block
            title="Live-Funk"
            aside={
              <span className="m-aside m-live">
                <i /> live
              </span>
            }
          >
            <Feed limit={6} />
          </Block>

          <Block title="Schnellzugriff">
            <div className="m-quick">
              <button onClick={() => showSearch(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                Suchen
              </button>
              <button onClick={() => open(approvalsTarget(null))}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="m5 12 4 4 10-10" />
                </svg>
                Alle Freigaben
              </button>
              <button onClick={() => showSetup(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 6h16M4 12h10M4 18h6M17 15l2 2 4-4" />
                </svg>
                Einrichtung
              </button>
              {user?.role === 'leitung' && (
                <button onClick={() => showCockpit(true)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                  Leitung
                </button>
              )}
              <button onClick={signOut}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" />
                </svg>
                Abmelden
              </button>
            </div>
          </Block>

          <footer className="m-foot">
            {COMPANY.name}
            {COMPANY.demo && ' · Demo'} · Agenten-Büro
          </footer>
        </>
      )}
    </>
  )
}
