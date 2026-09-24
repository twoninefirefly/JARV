import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AGENT_COUNT,
  BRAIN,
  COMPANY,
  DEPARTMENTS,
  brainProtocol,
  deptProtocol,
  fmt,
  split,
  type Department,
} from './data'
import { useOffice, type View } from './state'
import { Icon, Spark } from './Icon'
import { answer, liveMode, type Who } from './chat'

/** Re-render on the minute, so charts and logs follow the clock. */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(t)
  }, [])
  return now
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function Stat({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div className="stat">
      <div className="stat__value" style={tone ? { color: tone } : undefined}>
        {fmt(value)}
      </div>
      <div className="stat__label">{label}</div>
    </div>
  )
}

function Runs({ runs, color, title, now }: { runs: number[]; color: string; title: string; now: Date }) {
  const { done, total, hour } = split(runs, now)
  const max = Math.max(...runs)
  return (
    <div className="card">
      <div className="card__row">
        <span className="eyebrow">{title}</span>
        <span className="eyebrow eyebrow--strong">
          {fmt(done)} erledigt · {fmt(total)} geplant
        </span>
      </div>
      <div className="runs" role="img" aria-label={`${done} von ${total} Läufen erledigt`}>
        {runs.map((r, h) => (
          <div
            key={h}
            className={`runs__bar${h < hour ? ' is-done' : h === hour ? ' is-now' : ''}`}
            style={{ ['--c' as string]: color, height: `${18 + (r / max) * 82}%` }}
            title={`${h}:00 · ${r} Läufe`}
          />
        ))}
      </div>
      <div className="runs__axis">
        <span>0</span>
        <span>6</span>
        <span>12</span>
        <span>18</span>
        <span>24 Uhr</span>
      </div>
    </div>
  )
}

function AgentCard({
  name,
  sub,
  about,
  chips,
  onChip,
}: {
  name: string
  sub: string
  about: string
  chips: string[]
  onChip: (q: string) => void
}) {
  return (
    <div className="card">
      <div className="agent-card__name">
        <span className="accent">
          <Spark size={16} />
        </span>
        {name}
      </div>
      <div className="eyebrow">{sub}</div>
      <p className="body">{about}</p>
      <div className="chips">
        {chips.map((c) => (
          <button key={c} className="chip" onClick={() => onChip(c)}>
            {c}
          </button>
        ))}
      </div>
    </div>
  )
}

function Protocol({ items }: { items: Array<{ time: string; text: string; done: boolean }> }) {
  return (
    <ul className="protocol">
      {items.map((p, i) => (
        <li key={i} className={p.done ? '' : 'is-planned'}>
          <span className="protocol__mark">{p.done ? '✓' : '○'}</span>
          <span className="protocol__time">{p.time}</span>
          {p.text}
        </li>
      ))}
    </ul>
  )
}

function Section({ title, aside, children }: { title: string; aside?: string; children: ReactNode }) {
  return (
    <section className="section">
      <div className="card__row">
        <span className="eyebrow">{title}</span>
        {aside && <span className="eyebrow">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

type Msg = { from: 'me' | 'them'; text: string }

function useChat(who: Who | null) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [busy, setBusy] = useState(false)
  const key = who ? (who.kind === 'brain' ? 'brain' : who.dept.id) : ''
  useEffect(() => setMsgs([]), [key])

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || !who || busy) return
    setBusy(true)
    setMsgs((m) => [...m, { from: 'me', text: q }, { from: 'them', text: '' }])
    try {
      await answer(q, who, (delta) =>
        setMsgs((m) => {
          const copy = m.slice()
          const last = copy[copy.length - 1]
          copy[copy.length - 1] = { ...last, text: last.text + delta }
          return copy
        }),
      )
    } finally {
      setBusy(false)
    }
  }
  return { msgs, busy, send }
}

function Thread({ msgs, busy }: { msgs: Msg[]; busy: boolean }) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), [msgs])
  if (!msgs.length) return null
  return (
    <div className="thread">
      {msgs.map((m, i) => (
        <div key={i} className={`bubble bubble--${m.from}`}>
          {m.text || (busy && i === msgs.length - 1 ? <span className="typing">···</span> : '')}
        </div>
      ))}
      <div className="thread__mode">{liveMode() ? 'Live über Jarvis' : 'Demo-Antworten aus den Büro-Daten'}</div>
      <div ref={end} />
    </div>
  )
}

function Composer({ placeholder, busy, onSend }: { placeholder: string; busy: boolean; onSend: (q: string) => void }) {
  const [text, setText] = useState('')
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault()
        onSend(text)
        setText('')
      }}
    >
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        enterKeyHint="send"
      />
      <button type="submit" disabled={busy || !text.trim()}>
        Senden
      </button>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

function Header({ icon, title, sub, color, onClose }: { icon: Parameters<typeof Icon>[0]['name']; title: string; sub: string; color: string; onClose: () => void }) {
  return (
    <header className="sheet__head" style={{ ['--c' as string]: color }}>
      <span className="sheet__icon">
        <Icon name={icon} size={22} />
      </span>
      <div>
        <h2>{title}</h2>
        <div className="eyebrow">{sub}</div>
      </div>
      <button className="icon-btn" onClick={onClose} aria-label="Schließen">
        ✕
      </button>
    </header>
  )
}

function BrainSheet({ now, send }: { now: Date; send: (q: string) => void }) {
  const show = useOffice((s) => s.show)
  return (
    <>
      <p className="body body--lead">{BRAIN.about}</p>
      <div className="stats stats--3">
        {BRAIN.stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </div>
      <Runs runs={BRAIN.runs} color="#d98a62" title="Was heute hereinkam" now={now} />
      <AgentCard
        name={COMPANY.assistant}
        sub={`Verbunden mit ${DEPARTMENTS.length} Abteilungen · ${AGENT_COUNT} Agenten`}
        about={BRAIN.jarvis}
        chips={['Was kam heute herein?', 'Wie viel weißt du?', 'Wartet etwas auf mich?']}
        onChip={send}
      />
      <Section title="Abteilungen" aside={`${DEPARTMENTS.length}`}>
        <div className="dept-list">
          {DEPARTMENTS.map((d) => (
            <button key={d.id} className="dept-row" style={{ ['--c' as string]: d.color }} onClick={() => show({ kind: 'dept', id: d.id })}>
              <span className="sheet__icon sheet__icon--sm">
                <Icon name={d.icon} size={17} />
              </span>
              <span>
                <b>{d.name}</b>
                <small>
                  {d.agents.length} Agenten · {d.tagline}
                </small>
              </span>
              <span className="dept-row__count">
                <i />
                {split(d.runs, now).done}
              </span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Protokoll heute">
        <Protocol items={brainProtocol(now).slice(0, 10)} />
      </Section>
    </>
  )
}

function DeptSheet({ dept, agentId, now, send }: { dept: Department; agentId?: string; now: Date; send: (q: string) => void }) {
  const show = useOffice((s) => s.show)
  const s = split(dept.runs, now)
  const agent = dept.agents.find((a) => a.id === agentId)
  const chips = ['Was lief heute?', 'Was kommt als Nächstes?', 'Wartet etwas auf mich?']
  return (
    <>
      <div className="stats stats--2">
        {dept.kpis.map((k) => (
          <Stat key={k.label} {...k} />
        ))}
      </div>
      <div className="stats stats--3">
        <Stat value={s.done} label="Heute erledigt" tone="#b7cf85" />
        <Stat value={dept.runs[(s.hour + 1) % 24]} label="Nächste Stunde" tone="#9db8d6" />
        <Stat value={dept.waiting.length} label="Wartet auf Sie" tone="#e8c170" />
      </div>
      <Runs runs={dept.runs} color={dept.color} title="Läufe heute" now={now} />
      {agent && !agent.lead ? (
        <AgentCard
          name={agent.name}
          sub={`${agent.role} · ${agent.status}`}
          about={`${agent.doing[0].toUpperCase()}${agent.doing.slice(1)}. Berichtet an den ${dept.lead.title}.`}
          chips={[`Was macht ${agent.name}?`, ...chips.slice(0, 2)]}
          onChip={send}
        />
      ) : (
        <AgentCard name={dept.lead.title} sub={`Lead · ${dept.short}`} about={dept.lead.about} chips={chips} onChip={send} />
      )}
      {dept.waiting.length > 0 && (
        <Section title="Wartet auf Sie" aside={`${dept.waiting.length}`}>
          <ul className="waiting">
            {dept.waiting.map((w) => (
              <li key={w}>
                <span>⚠</span>
                {w}
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Team" aside={`${dept.agents.length} Agenten`}>
        <div className="team">
          {dept.agents.map((a) => (
            <button
              key={a.id}
              className={`team__row${a.id === agentId ? ' is-chosen' : ''}`}
              onClick={() => show({ kind: 'dept', id: dept.id, agent: a.id })}
            >
              <span className={`status status--${a.status}`} />
              <span>
                <b>
                  {a.lead && <Spark size={10} />} {a.name}
                </b>
                <small>{a.doing}</small>
              </span>
              <span className="eyebrow">{a.status}</span>
            </button>
          ))}
        </div>
      </Section>
      <Section title="Protokoll heute">
        <Protocol items={deptProtocol(dept, now).slice(0, 10)} />
      </Section>
    </>
  )
}

/** The collapsed card in the overview: what's waiting, and the call to action. */
function OverviewSheet({ now }: { now: Date }) {
  const [open, setOpen] = useState(false)
  const show = useOffice((s) => s.show)
  const waiting = DEPARTMENTS.flatMap((d) => d.waiting.map((w) => ({ d, w })))
  const done = DEPARTMENTS.reduce((n, d) => n + split(d.runs, now).done, 0)
  return (
    <div className="overview">
      <button className="overview__tasks" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>
          <b>Aufgaben</b>
          <span className="eyebrow">Ganzes Büro · {fmt(done)} heute erledigt</span>
        </span>
        <span className="pill">
          <i /> {waiting.length} warten {open ? '▾' : '▸'}
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            className="waiting waiting--overview"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {waiting.map(({ d, w }) => (
              <li key={w} onClick={() => show({ kind: 'dept', id: d.id })} style={{ ['--c' as string]: d.color }}>
                <span className="dot" />
                <b>{d.short}</b> {w}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      <a className="cta" href={COMPANY.contact}>
        Du willst das auch? →
      </a>
    </div>
  )
}

function whoFor(view: View): Who | null {
  if (view.kind === 'brain') return { kind: 'brain' }
  if (view.kind === 'dept') return { kind: 'dept', dept: DEPARTMENTS.find((d) => d.id === view.id)! }
  return null
}

export default function Panel() {
  const view = useOffice((s) => s.view)
  const show = useOffice((s) => s.show)
  const now = useNow()
  const who = whoFor(view)
  const { msgs, busy, send } = useChat(who)
  const scroller = useRef<HTMLDivElement>(null)

  // New subject, back to the top of the sheet.
  const subject = view.kind === 'dept' ? `${view.id}/${view.agent ?? ''}` : view.kind
  useEffect(() => scroller.current?.scrollTo({ top: 0, behavior: 'smooth' }), [subject])

  const close = () => show({ kind: 'overview' })
  const dept = who?.kind === 'dept' ? who.dept : null
  const agent = dept && view.kind === 'dept' ? dept.agents.find((a) => a.id === view.agent) : undefined

  return (
    <AnimatePresence mode="wait">
      {!who ? (
        <motion.div
          key="overview"
          className="sheet sheet--mini"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
        >
          <OverviewSheet now={now} />
        </motion.div>
      ) : (
        <motion.aside
          key={who.kind === 'brain' ? 'brain' : who.dept.id}
          className="sheet"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
        >
          {who.kind === 'brain' ? (
            <Header icon="brain" title="Das Gehirn" sub={`Alles, was ${COMPANY.assistant} weiß`} color="#d98a62" onClose={close} />
          ) : (
            <Header
              icon={who.dept.icon}
              title={who.dept.name}
              sub={`${who.dept.agents.length} Agenten · ${who.dept.tagline}`}
              color={who.dept.color}
              onClose={close}
            />
          )}
          <div className="sheet__body" ref={scroller}>
            {who.kind === 'brain' ? (
              <BrainSheet now={now} send={send} />
            ) : (
              <DeptSheet dept={who.dept} agentId={view.kind === 'dept' ? view.agent : undefined} now={now} send={send} />
            )}
            <Thread msgs={msgs} busy={busy} />
          </div>
          <Composer
            busy={busy}
            onSend={send}
            placeholder={
              who.kind === 'brain'
                ? `Frage an ${COMPANY.assistant} …`
                : `Nachricht an ${agent && !agent.lead ? agent.name : who.dept.lead.title} …`
            }
          />
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
