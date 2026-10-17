import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Paper, type Signed } from './LetterPaper'
import type { Letter } from './letters'

/**
 * Sending by post: every letter of an approved mail merge goes to the
 * office printer in one go, each with its own recipient.
 *
 * In the demo the printer is simulated; where the browser allows it, the
 * real print dialog opens with one page per letter. Connected to the
 * customer's network, the job goes straight to the chosen printer.
 */

const PRINTERS = [
  { id: 'buero', name: 'Büro 2. OG', model: 'Kyocera TASKalfa 3554ci', note: 'Farbe · Briefpapier in Fach 2' },
  { id: 'empfang', name: 'Empfang', model: 'HP LaserJet M507', note: 'Schwarzweiß · schnell' },
]

export type PrintJob = { text: string; count: number; printer: string; at: string; name: string }

/** Printing is blocked inside a sandboxed frame (the hosted demo). */
const canPrint = (() => {
  try {
    return window.self === window.top
  } catch {
    return false
  }
})()

export function PrintDialog({
  letters,
  what,
  signed,
  by,
  onDone,
  onCancel,
}: {
  letters: Letter[]
  what: string
  signed?: Signed
  by: string
  onDone: (job: Omit<PrintJob, 'text'>) => void
  onCancel: () => void
}) {
  const [printer, setPrinter] = useState(PRINTERS[0].id)
  const [duplex, setDuplex] = useState(true)
  const [letterhead, setLetterhead] = useState(true)
  const [attachments, setAttachments] = useState(true)
  const [phase, setPhase] = useState<'setup' | 'printing' | 'done'>('setup')
  const [n, setN] = useState(0)
  const [sheets, setSheets] = useState(false)
  const chosen = PRINTERS.find((p) => p.id === printer)!

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && phase !== 'printing' && onCancel()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onCancel, phase])

  // The job runs letter by letter, so you see it go out.
  useEffect(() => {
    if (phase !== 'printing') return
    if (n >= letters.length) {
      setPhase('done')
      const now = new Date()
      onDone({ count: letters.length, printer: chosen.name, at: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, name: by })
      return
    }
    const t = setTimeout(() => setN((k) => k + 1), 180)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, n])

  // The browser's own print dialog, one page per letter.
  const preview = () => {
    setSheets(true)
    document.body.classList.add('printing-letters')
    const done = () => {
      document.body.classList.remove('printing-letters')
      setSheets(false)
      window.removeEventListener('afterprint', done)
    }
    window.addEventListener('afterprint', done)
    setTimeout(() => window.print(), 50)
  }

  const pages = letters.length * (attachments && letters[0].attachments ? 1 + letters[0].attachments.length : 1)

  return (
    <div className="sig" role="dialog" aria-modal="true" aria-label="Drucken">
      <motion.div className="sig__backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => phase !== 'printing' && onCancel()} />
      <motion.div className="sig__card print" initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', damping: 26, stiffness: 300 }}>
        <h3>Postversand drucken</h3>
        <p className="sig__lead">
          {what} · <b>{letters.length} {letters.length === 1 ? 'Brief' : 'Briefe'}</b>, jeder mit eigenem Empfänger
        </p>

        {phase === 'setup' && (
          <>
            <div className="print__printers" role="radiogroup" aria-label="Drucker">
              {PRINTERS.map((p) => (
                <button key={p.id} type="button" role="radio" aria-checked={printer === p.id} className="print__printer" onClick={() => setPrinter(p.id)}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
                    <path d="M7 8V3h10v5M7 17H4v-7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v7h-3M7 14h10v7H7z" />
                  </svg>
                  <span>
                    <b>{p.name}</b>
                    <small>
                      {p.model} · {p.note}
                    </small>
                  </span>
                  <i className="print__online">bereit</i>
                </button>
              ))}
            </div>
            <div className="print__opts">
              <label>
                <input type="checkbox" checked={duplex} onChange={(e) => setDuplex(e.target.checked)} /> Beidseitig
              </label>
              <label>
                <input type="checkbox" checked={letterhead} onChange={(e) => setLetterhead(e.target.checked)} /> Auf Briefpapier (Fach 2)
              </label>
              <label>
                <input type="checkbox" checked={attachments} onChange={(e) => setAttachments(e.target.checked)} /> Anlagen mitdrucken
              </label>
            </div>
            <div className="print__list">
              {letters.map((l, i) => (
                <div key={i}>
                  <span>{i + 1}</span>
                  <b>{l.to[0]}</b>
                  <small>{l.to[1]}</small>
                </div>
              ))}
            </div>
            <p className="ws-note">
              Etwa {pages} Seiten{duplex ? `, beidseitig ${Math.ceil(pages / 2)} Blatt` : ''}. Danach nur noch kuvertieren – die Adresse steht im Fenster.
            </p>
            <div className="sig__actions">
              {canPrint ? (
                <button type="button" className="btn" onClick={preview}>
                  Druckvorschau
                </button>
              ) : (
                <span />
              )}
              <span />
              <button type="button" className="btn" onClick={onCancel}>
                Abbrechen
              </button>
              <button type="button" className="btn btn--primary" onClick={() => setPhase('printing')} autoFocus>
                {letters.length} {letters.length === 1 ? 'Brief' : 'Briefe'} drucken
              </button>
            </div>
          </>
        )}

        {phase !== 'setup' && (
          <div className="print__run">
            <div className="lock__bar">
              <div style={{ width: `${(Math.min(n, letters.length) / letters.length) * 100}%` }} />
            </div>
            <div className="print__status">
              {phase === 'printing' ? (
                <>
                  Brief {Math.min(n + 1, letters.length)} von {letters.length} an „{chosen.name}“ · {letters[Math.min(n, letters.length - 1)].to[0]}
                </>
              ) : (
                <>
                  ✓ {letters.length} {letters.length === 1 ? 'Brief' : 'Briefe'} an „{chosen.name}“ gesendet · in der Demo simuliert
                </>
              )}
            </div>
            {phase === 'done' && (
              <div className="sig__actions">
                <span />
                <span />
                <span />
                <button type="button" className="btn btn--primary" onClick={onCancel}>
                  Fertig
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>
      {sheets && <PrintSheets letters={letters} signed={signed} />}
    </div>
  )
}

/** One page per letter, only visible to the printer. */
function PrintSheets({ letters, signed }: { letters: Letter[]; signed?: Signed }) {
  const host = useRef(document.body)
  return createPortal(
    <div className="print-batch">
      {letters.map((l, i) => (
        <Paper key={i} letter={l} signed={signed} plain />
      ))}
    </div>,
    host.current,
  )
}
