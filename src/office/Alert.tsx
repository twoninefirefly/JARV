import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useOffice } from './state'
import { deptOf } from './comms'
import { agentTarget } from './workspaces'
import { isMuted, setMuted } from './sound'

/** An urgent message slides in at the top; tap it to go straight to the case. */
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
        <motion.button
          key={alert.id}
          className={`alert${emergency ? ' alert--sos' : ''}`}
          onClick={go}
          initial={{ opacity: 0, y: -24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: 'spring', damping: 24, stiffness: 280 }}
        >
          <span className="alert__pulse" aria-hidden />
          <span className="alert__label">{emergency ? 'Notfall' : 'Dringend'}</span>
          <span className="alert__text">
            {alert.text}
            <small>
              {alert.from.agent} → {alert.to.agent} · {alert.filed}
            </small>
          </span>
          <span className="alert__go">Ansehen →</span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}

/** Sound on/off, remembered on this computer. */
export function SoundToggle() {
  const [off, setOff] = useState(isMuted())
  return (
    <button
      className="icon-btn icon-btn--lg"
      onClick={() => {
        setMuted(!off)
        setOff(!off)
      }}
      aria-label={off ? 'Ton an' : 'Ton aus'}
      title={off ? 'Ton an' : 'Ton aus'}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 9v6h4l5 4V5L8 9H4Z" />
        {off ? <path d="m17 9 5 6m0-6-5 6" /> : <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />}
      </svg>
    </button>
  )
}
