import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { COMPANY } from './data'
import { useOffice } from './state'
import { BRANCHE, BRANCHEN, setBranche } from './branche'
import { HV_KUNDE, KUNDE } from './kunden'
import { DEMO_PASSWORD, USERS, type Role, type User } from './team'

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

function Avatar({ user, size = 34 }: { user: User; size?: number }) {
  return (
    <span className={`avatar avatar--${user.role}`} style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {user.initials}
    </span>
  )
}

/** 3:00–11:59 Guten Morgen, 12:00–17:59 Guten Tag, 18:00–2:59 Guten Abend. */
function greeting(d: Date) {
  const h = d.getHours()
  return h >= 18 || h < 3 ? 'Guten Abend' : h < 12 ? 'Guten Morgen' : 'Guten Tag'
}

export default function Lock({ onStart }: { onStart: () => void }) {
  const locked = useOffice((s) => s.locked)
  const unlock = useOffice((s) => s.unlock)
  const signIn = useOffice((s) => s.signIn)
  const remembered = useOffice((s) => s.remembered)
  const current = useOffice((s) => s.user)
  const now = useClock()
  const [pw, setPw] = useState('')
  const [wrong, setWrong] = useState(0)
  const [progress, setProgress] = useState<number | null>(null)
  const [area, setArea] = useState<Role>('team')
  const team = USERS.filter((x) => x.role === 'team')
  const leitung = USERS.filter((x) => x.role === 'leitung')
  const [chosen, setChosen] = useState<User>(team[0])
  const [remember, setRemember] = useState(true)
  // Someone who asked to stay signed in only needs one click; "Anderes Konto" shows the full login.
  const [switching, setSwitching] = useState(false)
  const [more, setMore] = useState(false)

  // A fresh lock clears whatever was typed last time and starts on the last person.
  useEffect(() => {
    if (locked) {
      setPw('')
      setProgress(null)
      setSwitching(false)
      const last = current ?? remembered
      if (last) {
        setArea(last.role)
        setChosen(last)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked])

  const start = (user: User, keep: boolean) => {
    signIn(user, keep)
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pw !== DEMO_PASSWORD) {
      setWrong((n) => n + 1)
      setPw('')
      return
    }
    start(chosen, remember)
  }

  const pickArea = (r: Role) => {
    setArea(r)
    setChosen(r === 'leitung' ? leitung[0] : team[0])
    setPw('')
  }

  const step = progress === null ? -1 : Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length))
  const welcome = remembered && !switching

  return (
    <AnimatePresence>
      {locked && (
        <motion.div className="lock" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.7 }}>
          <Drift />
          <div className="lock__glow" />
          <div className="lock__inner">
            {/* Like a phone's lock screen: the date small on top, the time large beneath. */}
            <div className="lock__date">{now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            <div className="lock__time">
              {now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </div>

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

            {progress !== null ? (
              <div className="lock__load" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="lock__hello">{greeting(now)}, {(current ?? chosen).name.split(' ')[0]}</div>
                <div className="lock__bar">
                  <div style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="lock__steps">
                  <span>{STEPS[step]}</span>
                  <span>{Math.round(progress * 100)} %</span>
                </div>
              </div>
            ) : welcome ? (
              <div className="lock__welcome">
                <Avatar user={remembered} size={52} />
                <div className="lock__who">
                  <span className="eyebrow">Willkommen zurück</span>
                  <b>{remembered.name}</b>
                  <small>
                    {remembered.role === 'leitung' ? 'Leitung · ' : ''}
                    {remembered.title}
                  </small>
                </div>
                <button type="button" className="lock__go" onClick={() => start(remembered, true)} autoFocus>
                  Weiter
                </button>
                <button type="button" className="lock__link" onClick={() => setSwitching(true)}>
                  Anderes Konto
                </button>
              </div>
            ) : (
              <>
                <div className="lock__areas" role="tablist" aria-label="Anmeldebereich">
                  {(['team', 'leitung'] as const).map((r) => (
                    <button key={r} type="button" role="tab" aria-selected={area === r} onClick={() => pickArea(r)}>
                      {r === 'team' ? 'Team' : 'Leitung'}
                    </button>
                  ))}
                </div>
                <div className={`lock__people${area === 'leitung' && leitung.length === 1 ? ' lock__people--one' : ''}`} role="listbox" aria-label="Person">
                  {(area === 'team' ? team : leitung).map((x) => (
                    <button key={x.id} type="button" role="option" aria-selected={chosen.id === x.id} className="lock__person" onClick={() => setChosen(x)}>
                      <Avatar user={x} />
                      <span>
                        <b>{x.name}</b>
                        <small>{x.title}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <motion.form key={wrong} className="lock__form" onSubmit={submit} animate={wrong ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }}>
                  <input
                    id="lock-password"
                    type="password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder={`Passwort für ${chosen.name}`}
                    aria-label="Passwort"
                    autoComplete="current-password"
                    autoFocus
                  />
                  <label className="lock__remember">
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                    Auf diesem Computer angemeldet bleiben
                  </label>
                  <button type="submit" disabled={!pw}>
                    Anmelden
                  </button>
                  {wrong > 0 && <p className="lock__error">Passwort falsch. Bitte erneut versuchen.</p>}
                </motion.form>
              </>
            )}
          </div>
          <div className="lock__foot">
            🔒 Verschlüsselte Verbindung · automatische Sperre nach {COMPANY.autoLockMinutes} Min.
            {(KUNDE || HV_KUNDE) && progress === null && (
              // For a customer the other office is not on offer — only a hint that it could be.
              <span className="lock__demo">
                <button type="button" className="lock__more" aria-expanded={more} onClick={() => setMore(!more)}>
                  + Holding · Erweiterung
                </button>
              </span>
            )}
            {!KUNDE && !HV_KUNDE && progress === null && (
              <span className="lock__demo" role="group" aria-label="Branche der Demo">
                Demo:
                {BRANCHEN.map((b) => (
                  <button key={b.id} type="button" aria-pressed={b.id === BRANCHE} onClick={() => b.id !== BRANCHE && setBranche(b.id)}>
                    {b.label}
                  </button>
                ))}
              </span>
            )}
            {more && (
              <span className="lock__morenote">
                Hier kann Ihr nächstes Büro entstehen – zum Beispiel für Ihre Holding oder eine weitere Gesellschaft. Eigene Abteilungen, eigenes Team,
                ein gemeinsames Gehirn. Auf Wunsch schalten wir es dazu.
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
