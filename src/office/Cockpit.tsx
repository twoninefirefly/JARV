import { useEffect, useState } from 'react'
import { SignaturePad } from './Signature'
import { AnimatePresence, motion } from 'framer-motion'
import { DEPARTMENTS } from './data'
import { useOffice } from './state'
import { HISTORY, SENSITIVE, USERS, deptName, mayDecide, needsLeitung } from './team'
import { agentTarget, waitingOwner } from './workspaces'

/**
 * Management's own area: figures nobody else sees, what waits for their
 * signature, and who in the team decided what today.
 *
 * Shown only to the management login. In the demo that check is in the
 * page; in the real system the server never sends this data to anyone else.
 */
export default function Cockpit() {
  const open = useOffice((s) => s.cockpit)
  const close = useOffice((s) => s.showCockpit)
  const openWs = useOffice((s) => s.open)
  const show = useOffice((s) => s.show)
  const user = useOffice((s) => s.user)
  const approved = useOffice((s) => s.approved)
  const decisions = useOffice((s) => s.decisions)
  const signature = useOffice((s) => s.signature)
  const setSignature = useOffice((s) => s.setSignature)
  const [pad, setPad] = useState(false)

  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open, close])

  const log = [...HISTORY, ...decisions].sort((a, b) => b.at.localeCompare(a.at))
  const waiting = DEPARTMENTS.flatMap((d) => d.waiting.map((w, i) => ({ d, w, i }))).filter(({ w }) => !approved.includes(w))
  const toSign = waiting.filter(({ w }) => needsLeitung(w))
  const team = USERS.filter((u) => u.role === 'team')

  const goTo = (d: (typeof DEPARTMENTS)[number], i: number, w: string) => {
    close(false)
    show({ kind: 'dept', id: d.id })
    openWs(agentTarget(d, waitingOwner(d, i), w))
  }

  return (
    <AnimatePresence>
      {open && user && (
        <>
          <motion.div key="cockpit-backdrop" className="ws-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => close(false)} />
          <motion.section
            key="cockpit"
            className="ws setup cockpit"
            role="dialog"
            aria-modal="true"
            aria-label="Bereich der Leitung"
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, pointerEvents: 'none', transition: { duration: 0.18 } }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <header className="ws-head">
              <span className="sheet__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              <div className="ws-head__title">
                <h2>Bereich der Leitung</h2>
                <div className="eyebrow">{user.name} · nur für die Leitung sichtbar</div>
              </div>
              <button className="icon-btn" onClick={() => close(false)} aria-label="Bereich der Leitung schließen">
                ✕
              </button>
            </header>

            <div className="setup__body">
              <h3 className="setup__h">Zahlen, die nur Sie sehen</h3>
              <div className="cockpit__figures">
                {SENSITIVE.map((f) => (
                  <div key={f.label} className="cockpit__figure">
                    <b>{f.value}</b>
                    <span>{f.label}</span>
                    <small>{f.note}</small>
                  </div>
                ))}
              </div>

              <h3 className="setup__h">
                Wartet auf Ihre Unterschrift <span className="eyebrow">{toSign.length}</span>
              </h3>
              {toSign.length ? (
                <ul className="cockpit__list">
                  {toSign.map(({ d, w, i }) => (
                    <li key={w}>
                      <button onClick={() => goTo(d, i, w)} style={{ ['--c' as string]: d.color }}>
                        <span className="dot" />
                        <b>{w}</b>
                        <small>{d.short}</small>
                        <span className="cockpit__go">Öffnen →</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="ws-note">Alles unterschrieben.</p>
              )}

              <h3 className="setup__h">Ihre Unterschrift</h3>
              <div className="cockpit__sig">
                {signature ? <img src={signature} alt={`Unterschrift ${user.name}`} /> : <span className="ws-note">Noch keine Unterschrift hinterlegt.</span>}
                <div>
                  <p className="ws-note">
                    Einmal hinterlegen, danach nur bestätigen: Verträge und Aufträge gehen mit Ihrer Unterschrift raus. Jede Verwendung steht im Protokoll.
                  </p>
                  <button className="btn btn--small" onClick={() => setPad(true)}>
                    {signature ? 'Neu hinterlegen' : 'Unterschrift hinterlegen'}
                  </button>
                  {signature && (
                    <button className="btn btn--small" onClick={() => setSignature(null)}>
                      Entfernen
                    </button>
                  )}
                </div>
              </div>

              <h3 className="setup__h">Wer hat heute was entschieden</h3>
              <div className="ws-table-wrap">
                <table className="ws-table cockpit__table">
                  <thead>
                    <tr>
                      <th>Zeit</th>
                      <th>Person</th>
                      <th>Vorgang</th>
                      <th>Abteilung</th>
                      <th>Ergebnis</th>
                    </tr>
                  </thead>
                  <tbody>
                    {log.map((x, k) => (
                      <tr key={`${x.at}-${k}`}>
                        <td>{x.at}</td>
                        <td>{x.name}</td>
                        <td>{x.text.replace(/ (freigeben|durchsehen)$/, '')}</td>
                        <td>{deptName(x.dept)}</td>
                        <td>
                          <span className={`badge badge--${x.result === 'Freigegeben' ? 'ok' : 'muted'}`}>{x.signed ? 'Unterschrieben' : x.result}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3 className="setup__h">Das Team heute</h3>
              <div className="cockpit__team">
                {team.map((u) => {
                  const mine = log.filter((x) => x.by === u.id)
                  const pending = waiting.filter(({ d, w }) => mayDecide(u, d.id, w).ok).length
                  return (
                    <div key={u.id} className="cockpit__member">
                      <span className="avatar" aria-hidden>
                        {u.initials}
                      </span>
                      <div>
                        <b>{u.name}</b>
                        <small>{u.title}</small>
                        <span>
                          {mine.length} entschieden{mine[0] ? ` · zuletzt ${mine[0].at}` : ''} · {pending} offen
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <h3 className="setup__h">Wer darf was freigeben</h3>
              <div className="ws-table-wrap">
                <table className="ws-table cockpit__rights">
                  <thead>
                    <tr>
                      <th>Person</th>
                      {DEPARTMENTS.map((d) => (
                        <th key={d.id}>{d.short}</th>
                      ))}
                      <th>Unterschrift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {USERS.map((u) => (
                      <tr key={u.id}>
                        <td>
                          {u.name}
                          {u.role === 'leitung' && <small> · Leitung</small>}
                        </td>
                        {DEPARTMENTS.map((d) => (
                          <td key={d.id} className={u.depts.includes(d.id) ? 'is-yes' : ''}>
                            {u.depts.includes(d.id) ? '✓' : '–'}
                          </td>
                        ))}
                        <td className={u.role === 'leitung' ? 'is-yes' : ''}>{u.role === 'leitung' ? '✓' : '–'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="ws-note">
                In der Demo läuft die Anmeldung im Browser. Im echten Betrieb prüft der Server jede Anmeldung und jedes Recht – diese Seite wird an niemanden
                außer der Leitung ausgeliefert.
              </p>
            </div>
            {pad && (
              <SignaturePad
                onSave={(png) => {
                  setSignature(png)
                  setPad(false)
                }}
                onCancel={() => setPad(false)}
              />
            )}
          </motion.section>
        </>
      )}
    </AnimatePresence>
  )
}
