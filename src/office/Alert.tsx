import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useOffice } from './state'
import { deptOf } from './comms'
import { agentTarget } from './workspaces'

/**
 * An urgent message pops in at the top right, like a message on a phone:
 * who it is from, what happened, "jetzt". Tap it to go straight to the case.
 */
export default function Alert() {
  const alert = useOffice((s) => s.alert)
  const raise = useOffice((s) => s.raise)
  const show = useOffice((s) => s.show)
  const open = useOffice((s) => s.open)

  useEffect(() => {
    if (!alert) return
    const t = setTimeout(() => raise(null), 9000)
    return () => clearTimeout(t)
  }, [alert, raise])

  const go = () => {
    if (!alert) return
    const d = deptOf(alert.to.dept)
    if (d) {
      const a = d.agents.find((x) => x.name === alert.to.agent) ?? d.agents[0]
      show({ kind: 'dept', id: d.id, agent: a.id })
      open(agentTarget(d, a, alert.text))
    }
    raise(null)
  }

  const emergency = alert?.urgency === 2
  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          key={alert.id}
          className={`notice${emergency ? ' notice--sos' : ''}`}
          role="alert"
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
                <time>jetzt</time>
              </span>
              <span className="notice__text">{alert.text}</span>
              <span className="notice__sub">
                {alert.filed} · an {alert.to.agent} · tippen zum Öffnen
              </span>
            </span>
          </button>
          <button className="notice__close" onClick={() => raise(null)} aria-label="Benachrichtigung schließen">
            ✕
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
