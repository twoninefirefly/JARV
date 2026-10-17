import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { COMPANY } from './data'
import { useOffice } from './state'
import { BRANCHE, BRANCHEN, setBranche } from './branche'
import { HV_KUNDE, KUNDE } from './kunden'
import { GRUPPE } from './gruppe'
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
      <path d="M19 7.5A8 8 0 1 0 20 13h-7" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/**
 * The customer's logo, alive: it breathes with a soft glow, a sheen runs over
 * it now and then, it tilts towards the pointer and answers a tap with a pulse.
 */
function LiveLogo({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pulse, setPulse] = useState(0)
  const tilt = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width - 0.5
    const y = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--rx', `${(-y * 16).toFixed(2)}deg`)
    el.style.setProperty('--ry', `${(x * 18).toFixed(2)}deg`)
  }
  const rest = () => {
    ref.current?.style.setProperty('--rx', '0deg')
    ref.current?.style.setProperty('--ry', '0deg')
  }
  return (
    <div ref={ref} className="live-logo" onPointerMove={tilt} onPointerLeave={rest} onClick={() => setPulse((n) => n + 1)} style={{ ['--logo' as string]: `url("${src}")` }}>
      <img src={src} alt={alt} className="lock__logo" draggable={false} />
      <span className="live-logo__sheen" aria-hidden />
      {pulse > 0 && <span key={pulse} className="live-logo__ring" aria-hidden />}
    </div>
  )
}

/** The dots' twinkle, 0.25 ± 0.35 on a sine, cut off below zero: one period sampled in twelve steps. */
const TWINKLE = Array.from({ length: 13 }, (_, k) => ({ opacity: Math.max(0, 0.25 + 0.35 * Math.sin((k / 12) * Math.PI * 2)) }))
/** One twinkle period in ms: the sine ran on t / 900. */
const TWINKLE_MS = 900 * Math.PI * 2

/**
 * Slow drifting dots behind the lock.
 *
 * They used to be a full-screen 2D canvas cleared and redrawn sixty times a
 * second, which cost more main-thread time than the whole rest of the lock
 * screen, mostly in handing the big bitmap over every frame. Now each dot is a
 * tiny element moved and faded by the compositor (transform and opacity only),
 * so the main thread does nothing while they drift. The motion is the same:
 * each dot rises at its own speed, wraps at the top and twinkles on a sine.
 * Under reduced motion they stand still where they are; they rest while the
 * office loads, so the build gets the time; and a hidden tab runs no
 * compositor animations anyway.
 */
function Drift({ paused }: { paused: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const anims = useRef<Animation[]>([])
  // The dots outlive a pause, so the picture does not change when it starts again.
  const [dots] = useState(() => Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.4, s: Math.random() * 0.00025 + 0.00008 })))
  // The dots take the office's colour.
  const [tint] = useState(() => {
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#d98a62'
    const m = /^#?([0-9a-f]{6})$/i.exec(accent)
    const n = m ? parseInt(m[1], 16) : 0xd98a62
    return `rgb(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255})`
  })

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const els = [...ref.current!.children] as HTMLElement[]
    anims.current = dots.flatMap((d, k) => {
      const rise = 1 / d.s
      // Negative delays start every dot where the old canvas had it at time zero.
      return [
        els[k].animate([{ transform: 'translateY(100vh)' }, { transform: 'translateY(0)' }], { duration: rise, delay: -(1 - d.y) * rise, iterations: Infinity, easing: 'linear' }),
        els[k].animate(TWINKLE, { duration: TWINKLE_MS, delay: -(((d.x * 20) % (Math.PI * 2)) / (Math.PI * 2)) * TWINKLE_MS, iterations: Infinity, easing: 'linear' }),
      ]
    })
    return () => {
      anims.current.forEach((a) => a.cancel())
      anims.current = []
    }
  }, [dots])

  useEffect(() => {
    anims.current.forEach((a) => (paused ? a.pause() : a.play()))
  }, [paused])

  return (
    <div ref={ref} className="lock__drift" style={{ overflow: 'hidden', pointerEvents: 'none' }} aria-hidden>
      {dots.map((d, k) => (
        <i
          key={k}
          style={{
            position: 'absolute',
            left: `${d.x * 100}%`,
            top: -d.r,
            width: d.r * 2,
            height: d.r * 2,
            marginLeft: -d.r,
            borderRadius: '50%',
            background: tint,
            // Where the dot stands without motion: its place and brightness at time zero.
            transform: `translateY(${d.y * 100}vh)`,
            opacity: Math.max(0, 0.25 + 0.35 * Math.sin(d.x * 20)),
          }}
        />
      ))}
    </div>
  )
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
  const team = USERS.filter((x) => x.role === 'team')
  const leitung = USERS.filter((x) => x.role === 'leitung')
  // A customer demo is shown as the customer's management, so it opens there;
  // the neutral office keeps starting with the team.
  const pitch = !!(KUNDE || HV_KUNDE)
  const [area, setArea] = useState<Role>(pitch ? 'leitung' : 'team')
  const [chosen, setChosen] = useState<User>(pitch ? leitung[0] : team[0])
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

  // Picking a person is the step before the password, so the cursor goes there.
  const pickPerson = (x: User) => {
    setChosen(x)
    document.getElementById('lock-password')?.focus()
  }

  const step = progress === null ? -1 : Math.min(STEPS.length - 1, Math.floor(progress * STEPS.length))
  const pct = progress === null ? 0 : Math.round(progress * 100)
  const welcome = remembered && !switching

  return (
    <AnimatePresence>
      {locked && (
        <motion.div className="lock" role="region" aria-label="Anmeldung" initial={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.7 }}>
          <Drift paused={progress !== null} />
          <div className="lock__glow" />
          <div className="lock__inner">
            {/* Like a phone's lock screen: the date small on top, the time large beneath. */}
            <div className="lock__date">{now.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
            {/* The time behind glass: a frosted pane with a highlight along its top edge. */}
            <div className="lock__glass">
              <div className="lock__time">
                {String(now.getHours()).padStart(2, '0')}
                <span className="lock__colon">:</span>
                {String(now.getMinutes()).padStart(2, '0')}
              </div>
            </div>

            <div className="lock__brand">
              {/* A customer logo carries its own name; the text name only goes with our mark. */}
              {COMPANY.logo ? (
                <LiveLogo src={COMPANY.logo} alt={COMPANY.name} />
              ) : (
                <>
                  <Mark size={64} />
                  <div className="lock__name">{COMPANY.name}</div>
                </>
              )}
              <div className="eyebrow">Agenten-Büro · geschützter Bereich</div>
            </div>

            {progress !== null ? (
              <div
                className="lock__load"
                role="progressbar"
                aria-label="Büro wird geladen"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={`${STEPS[step]}, ${pct} Prozent`}
              >
                <div className="lock__hello">{greeting(now)}, {(current ?? chosen).name.split(' ')[0]}</div>
                <div className="lock__bar">
                  <div style={{ width: `${progress * 100}%` }} />
                </div>
                <div className="lock__steps">
                  <span>{STEPS[step]}</span>
                  <span>{pct} %</span>
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
                {/* Plain toggle buttons: a tablist or listbox would promise arrow keys and panels that are not there. */}
                <div className="lock__areas" role="group" aria-label="Anmeldebereich">
                  {(pitch ? (['leitung', 'team'] as const) : (['team', 'leitung'] as const)).map((r) => (
                    <button key={r} type="button" aria-pressed={area === r} onClick={() => pickArea(r)}>
                      {r === 'team' ? 'Team' : 'Leitung'}
                    </button>
                  ))}
                </div>
                <div className={`lock__people${area === 'leitung' && leitung.length === 1 ? ' lock__people--one' : ''}`} role="group" aria-label="Person wählen">
                  {(area === 'team' ? team : leitung).map((x) => (
                    <button key={x.id} type="button" aria-pressed={chosen.id === x.id} className="lock__person" onClick={() => pickPerson(x)}>
                      <Avatar user={x} />
                      <span>
                        <b>{x.name}</b>
                        <small>{x.title}</small>
                      </span>
                    </button>
                  ))}
                </div>
                <motion.form key={wrong} className="lock__form" onSubmit={submit} animate={wrong ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }}>
                  {/* The account a password manager files the password under; the person picked above. */}
                  <input type="text" name="username" autoComplete="username" value={chosen.id} readOnly hidden />
                  {/* The placeholder goes away while typing, so the field keeps a real name. */}
                  <label htmlFor="lock-password" className="sr-only">
                    Passwort für {chosen.name}
                  </label>
                  <input
                    id="lock-password"
                    type="password"
                    name="password"
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder={`Passwort für ${chosen.name}`}
                    aria-invalid={wrong > 0}
                    aria-describedby={wrong > 0 ? 'lock-error' : undefined}
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
                  {wrong > 0 && (
                    <p id="lock-error" className="lock__error" role="alert">
                      Passwort falsch. Bitte erneut versuchen.
                    </p>
                  )}
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
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  {GRUPPE ? 'Weitere Gesellschaft' : 'Holding · Erweiterung'}
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
                {GRUPPE
                  ? `Ihre Holding sitzt schon mit im Büro – eine eigene Etage für alle ${GRUPPE.gesellschaften.length} Gesellschaften. Kommt eine neue dazu, legt die Registerwache sie an; auf Wunsch bekommt sie ein eigenes Büro.`
                  : 'Hier kann Ihr nächstes Büro entstehen – zum Beispiel für Ihre Holding oder eine weitere Gesellschaft. Eigene Abteilungen, eigenes Team, ein gemeinsames Gehirn. Auf Wunsch schalten wir es dazu.'}
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
