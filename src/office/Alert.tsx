import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useOffice } from './state'
import { deptOf } from './comms'
import { agentTarget, type Incident, type WsTarget } from './workspaces'

/**
 * An urgent message pops in at the top right, like a message on a phone:
 * who it is from, what happened, "jetzt". Tap it to go straight to the case.
 *
 * It waits while the presenter has a window, the search or a dialog open — the
 * alert stays queued in the store and slides in once the way is clear — and it
 * never disappears while the pointer or the focus rests on it.
 */
export default function Alert() {
  const alert = useOffice((s) => s.alert)
  const raise = useOffice((s) => s.raise)
  const show = useOffice((s) => s.show)
  const open = useOffice((s) => s.open)
  const busy = useOffice((s) => !!s.ws || s.cockpit || s.search || s.setup || s.palette)
  const [hold, setHold] = useState(false)

  const emergency = alert?.urgency === 2
  // An emergency stays long enough to be read out loud.
  const life = emergency ? 20000 : 9000

  // The clock only runs while the notice can be seen, and stops while it is held.
  useEffect(() => {
    if (!alert || busy || hold) return
    const t = setTimeout(() => raise(null), life)
    return () => clearTimeout(t)
  }, [alert, busy, hold, life, raise])

  // A notice that gets hidden under a window loses no pointer-leave or blur on
  // the way, so it comes back unheld and its clock starts afresh.
  useEffect(() => {
    if (busy) setHold(false)
  }, [busy])

  // Straight to the case: the camera flies to the department, then the case opens
  // with the fix one click away (commission a craftsman, reply, done).
  const go = () => {
    if (!alert) return
    const d = deptOf(alert.to.dept)
    if (d) {
      const a = d.agents.find((x) => x.name === 'Eskalation') ?? d.agents.find((x) => x.name === alert.to.agent && !x.lead) ?? d.agents.find((x) => !x.lead) ?? d.agents[0]
      const incident: Incident = { text: alert.text, from: alert.from.agent, to: alert.to.agent, filed: alert.filed, time: alert.time, urgency: alert.urgency ?? 1 }
      const target: WsTarget = { ...agentTarget(d, a, alert.text), kind: 'escalation', title: alert.urgency === 2 ? 'Notfall' : 'Dringend', incident }
      show({ kind: 'dept', id: d.id })
      setTimeout(() => open(target), 700)
    }
    setHold(false)
    raise(null)
  }

  const dismiss = () => {
    setHold(false)
    raise(null)
  }

  return (
    <AnimatePresence>
      {alert && !busy && (
        <motion.div
          key={alert.id}
          className={`notice${emergency ? ' notice--sos' : ''}`}
          // An emergency interrupts the screen reader; anything less waits for a pause.
          role={emergency ? 'alert' : 'status'}
          style={{ ['--life' as string]: `${life / 1000}s` }}
          onPointerEnter={() => setHold(true)}
          onPointerLeave={() => setHold(false)}
          onFocus={() => setHold(true)}
          // Moving between its two buttons keeps the hold.
          onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setHold(false)}
          initial={{ opacity: 0, x: 60, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 60 }}
          transition={{ type: 'spring', damping: 24, stiffness: 260 }}
        >
          <button className="notice__body" onClick={go}>
            <span className="notice__app" aria-hidden>
              {emergency ? '!' : '⚠'}
            </span>
            <span className="notice__main">
              <span className="notice__head">
                <b>{emergency ? 'Notfall' : 'Dringend'}</b> · {alert.from.agent}
                <time dateTime={new Date().toISOString()}>jetzt</time>
              </span>
              <span className="notice__text">{alert.text}</span>
              <span className="notice__sub">
                {alert.filed} · an {alert.to.agent} · öffnen
              </span>
            </span>
          </button>
          <button className="notice__close" onClick={dismiss} aria-label="Benachrichtigung schließen">
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
