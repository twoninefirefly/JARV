import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { COMPANY } from './data'
import { useOffice } from './state'
import { BRANCHE, BRANCHEN, setBranche } from './branche'
import { KUNDE } from './kunden'

/**
 * The lock screen: logo, clock, password, then a loading bar while the office
 * is actually fetched and built.
 *
 * The password is a front door for demos, not security — it ships inside the
 * page. Real customer data has to sit behind a server-side login.
 */

const STEPS = ['Identität geprüft', 'Verbinde mit dem Gehirn', 'Lade Abteilungen', 'Agenten melden sich an', 'Büro wird aufgebaut']

export function Mark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M19 7.5A8 8 0 1 0 20 13h-7" stroke="#d98a62" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/** Slow drifting dots behind the lock — a 2D canvas, cheap enough for any phone. */
function Drift() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current!
    const g = cv.getContext('2d')!
    const dots = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.4, s: Math.random() * 0.00025 + 0.00008 }))
    let raf = 0
    const draw = (t: number) => {
      const w = (cv.width = cv.clientWidth * devicePixelRatio)
      const h = (cv.height = cv.clientHeight * devicePixelRatio)
      g.clearRect(0, 0, w, h)
      for (const d of dots) {
        const y = (d.y - t * d.s) % 1
        const yy = (y < 0 ? y + 1 : y) * h
        const a = 0.25 + 0.35 * Math.sin(t / 900 + d.x * 20)
        g.fillStyle = `rgba(217,138,98,${a})`
        g.beginPath()
        g.arc(d.x * w, yy, d.r * devicePixelRatio, 0, Math.PI * 2)
        g.fill()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])
  return <canvas ref={ref} className="lock__drift" aria-hidden />
}

function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

export default function Lock({ onStart }: { onStart: () => void }) {
  const locked = useOffice((s) => s.locked)
  const unlock = useOffice((s) => s.unlock)
  const now = useClock()
  const [pw, setPw] = useState('')
  const [wrong, setWrong] = useState(0)
  const [progress, setProgress] = useState<number | null>(null)

  // A fresh lock clears whatever was typed last time.
  useEffect(() => {
    if (locked) {
      setPw('')
      setProgress(null)
    }
  }, [locked])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pw !== COMPANY.password) {
      setWrong((n) => n + 1)
      setPw('')
      return
    }
    onStart()
    const t0 = performance.now()
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 2600)
      setProgress(k)
      if (k < 1) requestAnimationFrame(tick)
      else setTimeout(unlock, 250)
    }
    requestAnimationFrame(tick)
  }

  const step = progress === null ? -1 : Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length))

  return (
    <AnimatePresence>
      {locked && (
        <motion.div className="lock" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.7 }}>
          <Drift />
          <div className="lock__glow" />
          <div className="lock__inner">
            <div className="lock__time">
              {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div className="lock__date">{now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>

            <div className="lock__brand">
              {/* A customer logo carries its own name; the text name only goes with our mark. */}
              {COMPANY.logo ? (
                <img src={COMPANY.logo} alt={COMPANY.name} className="lock__logo" />
              ) : (
                <>
                  <Mark size={64} />
                  <div className="lock__name">{COMPANY.name}</div>
                </>
              )}
              <div className="eyebrow">Agenten-Büro · geschützter Bereich</div>
            </div>

            {progress === null && !KUNDE && (
              <div className="lock__branche" role="group" aria-label="Branche der Demo">
                {BRANCHEN.map((b) => (
                  <button key={b.id} type="button" aria-pressed={b.id === BRANCHE} onClick={() => b.id !== BRANCHE && setBranche(b.id)}>
                    {b.label}
                  </button>
                ))}
              </div>
            )}

            {progress === null ? (
              <motion.form key={wrong} className="lock__form" onSubmit={submit} animate={wrong ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }}>
                <input
                  id="lock-password"
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  placeholder="Passwort"
                  aria-label="Passwort"
                  autoComplete="current-password"
                  autoFocus
                />
                <button type="submit" disabled={!pw}>
                  Entsperren
                </button>
                {wrong > 0 && <p className="lock__error">Passwort falsch. Bitte erneut versuchen.</p>}
              </motion.form>
            ) : (
              <div className="lock__load" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="lock__bar">
                  <div style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="lock__steps">
                  <span>{STEPS[step]}</span>
                  <span>{Math.round(progress * 100)} %</span>
                </div>
              </div>
            )}
          </div>
          <div className="lock__foot">🔒 Verschlüsselte Verbindung · automatische Sperre nach {COMPANY.autoLockMinutes} Min.</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
