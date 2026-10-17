import { useEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import './styles/brain.css'
import {
  AGENT_COUNT,
  BRAIN,
  COMPANY,
  DEPARTMENTS,
  brainProtocol,
  deptProtocol,
  fmt,
  split,
  type Agent,
  type Department,
} from './data'
import { useOffice, type View } from './state'
import { Icon, Spark } from './Icon'
import { answer, brainMode, type Turn, type Who } from './chat'
import { mayDecide, needsLeitung } from './team'
import { deptOf } from './comms'
import { GRUPPE } from './gruppe'
import GroupGraph from './GroupGraph'
import { agentTarget, approvalsTarget, brainTarget, kpiOwner, logTarget, waitingOwner } from './workspaces'

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

/** A number that rolls in from above when it changes, so 6 → 5 is seen and not just swapped. */
function Roll({ n }: { n: number | string }) {
  return (
    <motion.span key={n} className="roll" initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
      {n}
    </motion.span>
  )
}

function Stat({
  value,
  label,
  tone,
  roll,
  onClick,
}: {
  value: number | string
  label: string
  tone?: 'ok' | 'info' | 'warn'
  roll?: boolean
  onClick?: () => void
}) {
  const shown = typeof value === 'number' ? fmt(value) : value
  return (
    <button className="stat stat--link" data-tone={tone} onClick={onClick}>
      <span className="stat__value">{roll ? <Roll n={shown} /> : shown}</span>
      <span className="stat__label">{label}</span>
      <span className="stat__go" aria-hidden>
        →
      </span>
    </button>
  )
}

/**
 * The status an agent shows. Someone set to 'wartet' only waits while one of
 * their own items is still open; once it is approved or signed they are back
 * at work. The same rule drives the desks and tags in the 3D office.
 */
function statusOf(dept: Department, a: Agent, approved: string[]) {
  const owned = dept.waiting.filter((_, i) => waitingOwner(dept, i).id === a.id)
  return a.status === 'wartet' && owned.length > 0 && owned.every((w) => approved.includes(w)) ? 'arbeitet' : a.status
}

/** The 12px lock from the top bar, for items this person may only look at. */
function LockIcon() {
  return (
    <svg className="waiting__lock" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" role="img" aria-label="nur ansehen">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function Runs({ runs, color, title, now, onClick }: { runs: number[]; color: string; title: string; now: Date; onClick: () => void }) {
  const { done, total, hour } = split(runs, now)
  const max = Math.max(...runs)
  return (
    <button className="card card--link" onClick={onClick}>
      <div className="card__row">
        <span className="eyebrow">{title} →</span>
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
    </button>
  )
}

function AgentCard({
  name,
  sub,
  about,
  chips,
  onChip,
  onOpen,
}: {
  name: string
  sub: string
  about: string
  chips: string[]
  onChip: (q: string) => void
  onOpen?: () => void
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
      {onOpen && (
        <button className="open-ws" onClick={onOpen}>
          Arbeitsbereich öffnen →
        </button>
      )}
    </div>
  )
}

function Protocol({ items, onPick }: { items: Array<{ time: string; text: string; done: boolean }>; onPick: (text: string) => void }) {
  return (
    <ul className="protocol">
      {items.map((p, i) => (
        <li key={i} className={p.done ? '' : 'is-planned'}>
          <button onClick={() => onPick(p.text)}>
            <span className="protocol__mark">{p.done ? '✓' : '○'}</span>
            <span className="protocol__time">{p.time}</span>
            {p.text}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** Agents talking to each other through the brain, newest first. */
export function Feed({ dept, limit }: { dept?: string; limit: number }) {
  const feed = useOffice((s) => s.feed)
  const open = useOffice((s) => s.open)
  const items = (dept ? feed.filter((m) => m.from.dept === dept || m.to.dept === dept) : feed).slice(0, limit)
  return (
    <ul className="feed">
      <AnimatePresence initial={false}>
        {items.map((m) => {
          const from = deptOf(m.from.dept)
          const to = deptOf(m.to.dept)
          if (!from || !to) return null
          const agent = to.agents.find((a) => a.name === m.to.agent) ?? to.agents[0]
          return (
            <motion.li key={m.id} layout initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <button onClick={() => open(agentTarget(to, agent, m.text))}>
                <span className="feed__route">
                  <i style={{ background: from.color }} />
                  {m.from.agent}
                  <span className="feed__arrow">→ Gehirn →</span>
                  <i style={{ background: to.color }} />
                  {m.to.agent}
                  <time>{m.time}</time>
                </span>
                <span className="feed__text">{m.text}</span>
                <span className="feed__filed">✓ {m.filed}</span>
              </button>
            </motion.li>
          )
        })}
      </AnimatePresence>
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

/** `note` marks a line the page wrote itself, which is not sent back as history. */
type Msg = { from: 'me' | 'them'; text: string; note?: boolean }

/**
 * Threads per floor, kept for the whole visit: leaving the Holding and coming
 * back finds the conversation where it was. Module-level, because the sheet
 * that shows a thread unmounts whenever the floor changes.
 */
const threads = new Map<string, Msg[]>()
const NONE: Msg[] = []

function useChat(who: Who | null) {
  const key = who ? (who.kind === 'brain' ? 'brain' : who.dept.id) : ''
  const [, redraw] = useReducer((n: number) => n + 1, 0)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const ctl = useRef<AbortController | null>(null)
  // An answer still running when the panel goes away for good is stopped.
  useEffect(() => () => ctl.current?.abort(), [])

  const write = (k: string, change: (m: Msg[]) => Msg[]) => {
    threads.set(k, change(threads.get(k) ?? NONE))
    redraw()
  }
  // Answers are written into the thread they were asked in, even after the floor changed.
  const setLast = (k: string, change: (text: string) => string) =>
    write(k, (m) => {
      const copy = m.slice()
      const last = copy[copy.length - 1]
      if (last?.from === 'them') copy[copy.length - 1] = { ...last, text: change(last.text) }
      return copy
    })

  const send = async (text: string) => {
    const q = text.trim()
    if (!q || !who || busyKey === key) return
    // One answer at a time: asking on another floor stops the one still running there, and its text stays.
    ctl.current?.abort()
    const mine = new AbortController()
    ctl.current = mine
    const k = key
    const history: Turn[] = (threads.get(k) ?? NONE)
      .filter((m) => !m.note)
      .slice(-8)
      .map((m) => ({ role: m.from === 'me' ? 'user' : 'assistant', content: m.text }))
    write(k, (m) => [...m, { from: 'me', text: q }, { from: 'them', text: '' }])
    setBusyKey(k)
    try {
      await answer(q, who, history, {
        signal: mine.signal,
        onText: (delta) => setLast(k, (t) => t + delta),
        onSet: (all) => setLast(k, () => all),
      })
    } finally {
      // Stopped before the first word: say so instead of leaving an empty bubble.
      write(k, (m) => {
        const last = m[m.length - 1]
        return last?.from === 'them' && !last.text ? [...m.slice(0, -1), { ...last, text: 'Gestoppt.', note: true }] : m
      })
      if (ctl.current === mine) {
        ctl.current = null
        setBusyKey(null)
      }
    }
  }
  const stop = () => ctl.current?.abort()
  return { msgs: threads.get(key) ?? NONE, busy: busyKey === key, send, stop }
}

const MODE_LABEL = {
  bridge: 'Live · Jarvis-Bridge',
  claude: 'Live · Claude über Ihr Konto',
  demo: 'Demo-Antworten aus den Büro-Daten',
}

/**
 * The conversation, right under the questions that start it. The log is always
 * in the page so a screen reader knows it before the first answer; aria-busy
 * makes it read the finished answer once instead of every streamed piece.
 */
function Thread({ msgs, busy }: { msgs: Msg[]; busy: boolean }) {
  const end = useRef<HTMLDivElement>(null)
  const mounted = useRef(false)
  useEffect(() => {
    // Coming back to a floor keeps the sheet at the top; only new text scrolls.
    if (!mounted.current) {
      mounted.current = true
      return
    }
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [msgs])
  const mode = brainMode()
  return (
    <div className="thread" role="log" aria-live="polite" aria-busy={busy} aria-label="Unterhaltung">
      {msgs.length > 0 && (
        <>
          {msgs.map((m, i) => (
            <div key={i} className={`bubble bubble--${m.from}`}>
              {m.text || (busy && i === msgs.length - 1 ? <span className="thread__thinking">Denkt nach …</span> : '')}
            </div>
          ))}
          <div className={`thread__mode${mode === 'demo' ? '' : ' is-live'}`}>{MODE_LABEL[mode]}</div>
          <div ref={end} />
        </>
      )}
    </div>
  )
}

function Composer({ placeholder, busy, onSend, onStop }: { placeholder: string; busy: boolean; onSend: (q: string) => void; onStop: () => void }) {
  const [text, setText] = useState('')
  const field = useRef<HTMLTextAreaElement>(null)
  // The field grows with the text, up to a few lines.
  useEffect(() => {
    const t = field.current
    if (!t) return
    t.style.height = 'auto'
    t.style.height = `${Math.min(t.scrollHeight, 160)}px`
  }, [text])
  const submit = () => {
    if (busy || !text.trim()) return
    onSend(text)
    setText('')
  }
  return (
    <form
      className="composer"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="composer__box">
        <textarea
          ref={field}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter starts a new line.
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          placeholder={placeholder}
          aria-label={placeholder}
          enterKeyHint="send"
        />
        {busy ? (
          // While an answer is written, the send button stops it; what was written stays.
          <button type="button" className="composer__stop" onClick={onStop} aria-label="Antwort stoppen">
            ■
          </button>
        ) : (
          <button type="submit" disabled={!text.trim()} aria-label="Senden">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        )}
      </div>
      <small className="composer__hint">Enter senden · Shift+Enter neue Zeile</small>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

function Header({ icon, title, sub, color, onClose }: { icon: Parameters<typeof Icon>[0]['name']; title: string; sub: string; color: string; onClose: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null)
  // The floor badge that opened this sheet unmounts as the camera flies in, and
  // focus would fall back to the page. Catch it on the heading instead, so the
  // next Tab continues in the sheet; focus that is still somewhere is left alone.
  useEffect(() => {
    const now = document.activeElement
    if (!now || now === document.body) heading.current?.focus({ preventScroll: true })
  }, [title])
  return (
    <header className="sheet__head" style={{ ['--c' as string]: color }}>
      <span className="sheet__icon">
        <Icon name={icon} size={22} />
      </span>
      <div>
        <h2 id="sheet-title" className="sheet__title" ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <div className="eyebrow">{sub}</div>
      </div>
      <button className="icon-btn" onClick={onClose} aria-label="Schließen">
        ✕
      </button>
    </header>
  )
}

function BrainSheet({ now, send, thread }: { now: Date; send: (q: string) => void; thread: ReactNode }) {
  const show = useOffice((s) => s.show)
  const inside = useOffice((s) => s.view.kind === 'neural')
  const open = useOffice((s) => s.open)
  return (
    <>
      <p className="body body--lead">{BRAIN.about}</p>
      <Section title="Live · Agenten sprechen miteinander" aside="durchs Gehirn">
        <Feed limit={5} />
      </Section>
      <div className="stats stats--3">
        {BRAIN.stats.map((s) => (
          <Stat key={s.label} {...s} onClick={() => open(brainTarget(s.label))} />
        ))}
      </div>
      <Runs runs={BRAIN.runs} color="var(--accent)" title="Was heute hereinkam" now={now} onClick={() => open(logTarget(null))} />
      <AgentCard
        name={COMPANY.assistant}
        sub={`Verbunden mit ${DEPARTMENTS.length} Abteilungen · ${AGENT_COUNT} Agenten`}
        about={BRAIN.jarvis}
        chips={
          GRUPPE
            ? ['Wie ist die Gruppe aufgebaut?', 'Was muss ich heute unterschreiben?', 'Was kam heute herein?']
            : ['Was kam heute herein?', 'Wie viel weißt du?', 'Wartet etwas auf mich?']
        }
        onChip={send}
        onOpen={() => open(brainTarget('Dokumente'))}
      />
      {thread}
      <button className="open-ws open-ws--brain" onClick={() => show(inside ? { kind: 'brain' } : { kind: 'neural' })}>
        {inside ? '← Zurück zum ganzen Gehirn' : 'Ins Gehirn hineinzoomen →'}
      </button>
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
        <Protocol items={brainProtocol(now).slice(0, 10)} onPick={(text) => open(logTarget(null, undefined, text))} />
      </Section>
    </>
  )
}

function DeptSheet({ dept, agentId, now, send, thread }: { dept: Department; agentId?: string; now: Date; send: (q: string) => void; thread: ReactNode }) {
  const show = useOffice((s) => s.show)
  const open = useOffice((s) => s.open)
  const approved = useOffice((s) => s.approved)
  const user = useOffice((s) => s.user)
  const s = split(dept.runs, now)
  const agent = dept.agents.find((a) => a.id === agentId)
  const lead = dept.agents.find((a) => a.lead) ?? dept.agents[0]
  const waiting = dept.waiting.map((w, i) => ({ w, i })).filter(({ w }) => !approved.includes(w))
  const group = GRUPPE && dept.id === 'holding' ? GRUPPE : null
  const chips = group
    ? ['Wie ist die Gruppe aufgebaut?', 'Welche Fristen kommen?', 'Wartet etwas auf mich?']
    : ['Was lief heute?', 'Was kommt als Nächstes?', 'Wartet etwas auf mich?']
  const companies = dept.agents.find((a) => a.name === 'Gesellschaften')
  const pickAgent = (id: string) => {
    show({ kind: 'dept', id: dept.id, agent: id })
    open(agentTarget(dept, dept.agents.find((a) => a.id === id)!))
  }
  return (
    <>
      <div className="stats stats--2">
        {dept.kpis.map((k, i) => (
          <Stat key={k.label} {...k} onClick={() => open(agentTarget(dept, kpiOwner(dept, i)))} />
        ))}
      </div>
      <div className="stats stats--3">
        <Stat value={s.done} label="Heute erledigt" tone="ok" onClick={() => open(logTarget(dept, 'done'))} />
        <Stat value={dept.runs[(s.hour + 1) % 24]} label="Nächste Stunde" tone="info" onClick={() => open(logTarget(dept, 'planned'))} />
        <Stat
          value={waiting.length ? waiting.filter(({ w }) => mayDecide(user, dept.id, w).ok).length : '✓'}
          label={waiting.length ? 'Wartet auf Sie' : 'Alles erledigt'}
          tone={waiting.length ? 'warn' : 'ok'}
          roll
          onClick={() => open(approvalsTarget(dept))}
        />
      </div>
      {group && companies && group.gesellschaften.length > 0 && (
        <Section title="Struktur der Gruppe" aside={`${group.gesellschaften.length} Gesellschaften`}>
          <GroupGraph gesellschaften={group.gesellschaften} color={dept.color} onPick={(g) => open(agentTarget(dept, companies, g.name))} />
        </Section>
      )}
      <Runs runs={dept.runs} color={dept.color} title="Läufe heute" now={now} onClick={() => open(logTarget(dept))} />
      {agent && !agent.lead ? (
        <AgentCard
          name={agent.name}
          sub={`${agent.role} · ${statusOf(dept, agent, approved)}`}
          about={`${agent.doing[0].toUpperCase()}${agent.doing.slice(1)}. Berichtet an den ${dept.lead.title}.`}
          chips={[`Was macht ${agent.name}?`, ...chips.slice(0, 2)]}
          onChip={send}
          onOpen={() => open(agentTarget(dept, agent))}
        />
      ) : (
        <AgentCard
          name={dept.lead.title}
          sub={`Lead · ${dept.short}`}
          about={dept.lead.about}
          chips={chips}
          onChip={send}
          onOpen={() => open(agentTarget(dept, lead))}
        />
      )}
      {thread}
      <Section title="Funk mit anderen Abteilungen" aside="live">
        <Feed dept={dept.id} limit={3} />
      </Section>
      {waiting.length > 0 && (
        <Section title="Wartet auf Freigabe" aside={`${waiting.length}`}>
          <ul className="waiting">
            {waiting.map(({ w, i }) => (
              <li key={w}>
                <button onClick={() => open(agentTarget(dept, waitingOwner(dept, i), w))}>
                  {mayDecide(user, dept.id, w).ok ? <span className="status status--wartet waiting__mark" role="img" aria-label="wartet auf Sie" /> : <LockIcon />}
                  {w}
                  {needsLeitung(w) && <span className="badge badge--sign">Leitung</span>}
                  <span className="waiting__go">→</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Team" aside={`${dept.agents.length} Agenten`}>
        <div className="team">
          {dept.agents.map((a) => {
            const status = statusOf(dept, a, approved)
            return (
              <button key={a.id} className={`team__row${a.id === agentId ? ' is-chosen' : ''}`} onClick={() => pickAgent(a.id)}>
                <span className={`status status--${status}`} role="img" aria-label={`Status: ${status}`} />
                <span>
                  <b>
                    {a.lead && <Spark size={10} />} {a.name}
                  </b>
                  {/* Their item was signed or approved, so the old "waiting" line would be stale. */}
                  <small>{status === a.status ? a.doing : 'Freigabe erhalten, wird ausgeführt'}</small>
                </span>
                <span className="eyebrow">Öffnen →</span>
              </button>
            )
          })}
        </div>
      </Section>
      <Section title="Protokoll heute">
        <Protocol items={deptProtocol(dept, now).slice(0, 10)} onPick={(text) => open(logTarget(dept, undefined, text))} />
      </Section>
    </>
  )
}

/** The collapsed card in the overview: what's waiting across the office. */
function OverviewSheet({ now }: { now: Date }) {
  const [expanded, setExpanded] = useState(false)
  const open = useOffice((s) => s.open)
  const approved = useOffice((s) => s.approved)
  const waiting = DEPARTMENTS.flatMap((d) => d.waiting.map((w, i) => ({ d, w, i }))).filter(({ w }) => !approved.includes(w))
  const done = DEPARTMENTS.reduce((n, d) => n + split(d.runs, now).done, 0)
  return (
    <div className="overview" role="region" aria-label="Aufgaben">
      <button className="overview__tasks" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span>
          <b>Aufgaben</b>
          <span className="eyebrow">Ganzes Büro · {fmt(done)} heute erledigt</span>
        </span>
        {waiting.length ? (
          <span className="pill">
            <i /> <Roll n={waiting.length} /> warten {expanded ? '▾' : '▸'}
          </span>
        ) : (
          <span className="pill pill--done">✓ Alles erledigt {expanded ? '▾' : '▸'}</span>
        )}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.ul
            className="waiting waiting--overview"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            {waiting.length === 0 && (
              <li className="waiting__empty">
                <span>✓</span> Nichts wartet auf eine Freigabe – alles für heute erledigt.
              </li>
            )}
            {waiting.map(({ d, w, i }) => (
              <li key={w} style={{ ['--c' as string]: d.color }}>
                <button onClick={() => open(agentTarget(d, waitingOwner(d, i), w))}>
                  <span className="dot" />
                  <b>{d.short}</b> {w}
                  <span className="waiting__go">→</span>
                </button>
              </li>
            ))}
            <li>
              <button onClick={() => open(approvalsTarget(null))}>
                <b>Alle Freigaben öffnen</b>
                <span className="waiting__go">→</span>
              </button>
            </li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  )
}

function whoFor(view: View): Who | null {
  if (view.kind === 'brain' || view.kind === 'neural') return { kind: 'brain' }
  if (view.kind === 'dept') return { kind: 'dept', dept: DEPARTMENTS.find((d) => d.id === view.id)! }
  return null
}

export default function Panel() {
  const view = useOffice((s) => s.view)
  const show = useOffice((s) => s.show)
  const now = useNow()
  const who = whoFor(view)
  const { msgs, busy, send, stop } = useChat(who)
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
          aria-labelledby="sheet-title"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
        >
          {who.kind === 'brain' ? (
            <Header icon="brain" title="Das Gehirn" sub="Zentrale · Agenten-Funk" color="var(--accent)" onClose={close} />
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
              <BrainSheet now={now} send={send} thread={<Thread msgs={msgs} busy={busy} />} />
            ) : (
              <DeptSheet
                dept={who.dept}
                agentId={view.kind === 'dept' ? view.agent : undefined}
                now={now}
                send={send}
                thread={<Thread msgs={msgs} busy={busy} />}
              />
            )}
          </div>
          <Composer
            busy={busy}
            onSend={send}
            onStop={stop}
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
