import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

/**
 * Management's signature: drawn once, kept on this computer like the
 * password, and after that only confirmed.
 *
 * In the demo the image stays in this browser. In the real system it is
 * stored on the server, and every use is logged with who, what and when.
 */

/** Draw a signature with mouse, pen or finger. */
export function SignaturePad({ onSave, onCancel }: { onSave: (png: string) => void; onCancel: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<[number, number] | null>(null)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const c = canvas.current
    if (!c) return
    const r = window.devicePixelRatio || 1
    c.width = c.clientWidth * r
    c.height = c.clientHeight * r
    const g = c.getContext('2d')!
    g.scale(r, r)
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.strokeStyle = '#1d2a55'
  }, [])

  const at = (e: React.PointerEvent): [number, number] => {
    const b = canvas.current!.getBoundingClientRect()
    return [e.clientX - b.left, e.clientY - b.top]
  }
  const down = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    last.current = at(e)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current || !last.current) return
    const g = canvas.current!.getContext('2d')!
    const p = at(e)
    // Faster strokes come out thinner, like ink.
    const d = Math.hypot(p[0] - last.current[0], p[1] - last.current[1])
    g.lineWidth = Math.max(1.2, 3.2 - d * 0.08)
    g.beginPath()
    g.moveTo(...last.current)
    g.quadraticCurveTo(last.current[0], last.current[1], (last.current[0] + p[0]) / 2, (last.current[1] + p[1]) / 2)
    g.lineTo(...p)
    g.stroke()
    last.current = p
    setEmpty(false)
  }
  const up = () => {
    drawing.current = false
    last.current = null
  }
  const clear = () => {
    const c = canvas.current!
    c.getContext('2d')!.clearRect(0, 0, c.width, c.height)
    setEmpty(true)
  }

  return (
    <Modal onCancel={onCancel}>
      <h3>Unterschrift hinterlegen</h3>
      <p className="sig__lead">Einmal unterschreiben – danach bestätigen Sie nur noch. Die Unterschrift bleibt auf diesem Computer gespeichert.</p>
      <div className="sig__pad">
        <canvas ref={canvas} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label="Unterschriftenfeld" />
        <span className="sig__line" aria-hidden />
        {empty && <span className="sig__hint">Hier unterschreiben</span>}
      </div>
      <div className="sig__actions">
        <button className="btn" onClick={clear} disabled={empty}>
          Löschen
        </button>
        <span />
        <button className="btn" onClick={onCancel}>
          Abbrechen
        </button>
        <button className="btn btn--primary" disabled={empty} onClick={() => onSave(canvas.current!.toDataURL('image/png'))}>
          Speichern
        </button>
      </div>
    </Modal>
  )
}

/**
 * Every decision is confirmed by the person signed in: their name, their
 * password (already filled in if they asked to be remembered) and one more
 * press. Management additionally sees the signature that will go out.
 */
export function ConfirmDecision({
  name,
  title,
  initials,
  role,
  action,
  what,
  savedPassword,
  png,
  check,
  onConfirm,
  onCancel,
}: {
  name: string
  title: string
  initials: string
  role: 'team' | 'leitung'
  action: string
  what: string
  savedPassword?: string
  png?: string
  check: (pw: string) => boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const [pw, setPw] = useState(savedPassword ?? '')
  const [wrong, setWrong] = useState(0)
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!check(pw)) {
      setWrong((n) => n + 1)
      setPw('')
      return
    }
    onConfirm()
  }
  return (
    <Modal onCancel={onCancel}>
      <h3>{action} bestätigen</h3>
      <p className="sig__lead">{what}</p>
      <div className="confirm__who">
        <span className={`avatar avatar--${role}`} aria-hidden>
          {initials}
        </span>
        <span>
          <b>{name}</b>
          <small>{title}</small>
        </span>
      </div>
      {png && (
        <div className="sig__pad sig__pad--saved sig__pad--small">
          <img src={png} alt={`Unterschrift ${name}`} />
          <span className="sig__line" aria-hidden />
          <span className="sig__name">{name}</span>
        </div>
      )}
      <motion.form key={wrong} onSubmit={submit} className="confirm__form" animate={wrong ? { x: [0, -8, 8, -5, 5, 0] } : {}} transition={{ duration: 0.35 }}>
        <input
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Ihr Passwort"
          aria-label="Passwort"
          autoComplete="current-password"
          autoFocus={!savedPassword}
        />
        {savedPassword && <small className="confirm__saved">Gespeichertes Passwort – nur noch bestätigen</small>}
        {wrong > 0 && <small className="confirm__wrong">Passwort falsch.</small>}
        <div className="sig__actions">
          <span />
          <span />
          <button type="button" className="btn" onClick={onCancel}>
            Abbrechen
          </button>
          <button type="submit" className="btn btn--primary" disabled={!pw} autoFocus={!!savedPassword}>
            {action}
          </button>
        </div>
      </motion.form>
    </Modal>
  )
}

function Modal({ children, onCancel }: { children: React.ReactNode; onCancel: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCancel])
  return (
    <div className="sig" role="dialog" aria-modal="true">
      <motion.div className="sig__backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onCancel} />
      <motion.div className="sig__card" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }}>
        {children}
      </motion.div>
    </div>
  )
}
