import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { COMPANY, DEPARTMENTS, deptProtocol, fmt, split } from './data'
import { useOffice } from './state'
import { Icon, Spark } from './Icon'
import { day, signature, type Letter } from './letters'
import {
  LAYOUT,
  SOURCES,
  agentTarget,
  approvalsTarget,
  itemsFor,
  kindOf,
  logTarget,
  type WsItem,
  type WsTarget,
} from './workspaces'

/**
 * The work window: what one agent is working on, from the system it works in.
 *
 * Every window has the same frame — who, which data source, search, the
 * records, one record in detail — so a customer learns it once. Only the
 * middle changes with the kind of work: a list for a mailbox, a board for a
 * pipeline, a table for invoices, an agenda for a calendar.
 */

const useWide = () => {
  const [wide, setWide] = useState(() => window.innerWidth >= 900)
  useEffect(() => {
    const on = () => setWide(window.innerWidth >= 900)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return wide
}

function Badge({ badge }: { badge?: WsItem['badge'] }) {
  if (!badge) return null
  return <span className={`badge badge--${badge.tone}`}>{badge.text}</span>
}

// ---------------------------------------------------------------------------
// Record views
// ---------------------------------------------------------------------------

function List({ items, chosen, pick, agenda }: { items: WsItem[]; chosen?: string; pick: (i: WsItem) => void; agenda?: boolean }) {
  return (
    <ul className={`ws-list${agenda ? ' ws-list--agenda' : ''}`}>
      {items.map((it) => (
        <li key={it.id}>
          <button className={`ws-row${chosen === it.id ? ' is-chosen' : ''}${it.approval ? ' is-approval' : ''}`} onClick={() => pick(it)}>
            {agenda && <span className="ws-row__time">{it.meta}</span>}
            <span className="ws-row__main">
              <b>{it.title}</b>
              {it.sub && <small>{it.sub}</small>}
            </span>
            <span className="ws-row__side">
              {!agenda && it.meta && <span className="ws-row__meta">{it.meta}</span>}
              <Badge badge={it.badge} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Board({ items, columns, chosen, pick }: { items: WsItem[]; columns: string[]; chosen?: string; pick: (i: WsItem) => void }) {
  return (
    <div className="ws-board">
      {columns.map((c) => {
        const cards = items.filter((i) => i.col === c)
        return (
          <div key={c} className="ws-col">
            <div className="ws-col__head">
              <span className="eyebrow">{c}</span>
              <span className="eyebrow">{cards.length}</span>
            </div>
            {cards.map((it) => (
              <button key={it.id} className={`ws-card${chosen === it.id ? ' is-chosen' : ''}${it.approval ? ' is-approval' : ''}`} onClick={() => pick(it)}>
                <b>{it.title}</b>
                {it.sub && <small>{it.sub}</small>}
                <span className="ws-card__foot">
                  {it.meta && <span className="ws-row__meta">{it.meta}</span>}
                  <Badge badge={it.badge} />
                </span>
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}

function Table({ items, columns, chosen, pick }: { items: WsItem[]; columns: string[]; chosen?: string; pick: (i: WsItem) => void }) {
  return (
    <div className="ws-table-wrap">
      <table className="ws-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className={`${chosen === it.id ? 'is-chosen' : ''}${it.approval ? ' is-approval' : ''}`} onClick={() => pick(it)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && pick(it)}>
              {(it.cells ?? [it.title]).map((c, i) => (
                <td key={i}>{i === (it.cells?.length ?? 1) - 1 && it.badge ? <Badge badge={it.badge} /> : c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** `[[field]]` → a highlighted field, so you see exactly what the agent filled in. */
function Filled({ text }: { text: string }) {
  const parts = text.split(/\[\[(.+?)\]\]/g)
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : p))}</>
}

/** A letter or mail exactly as it goes out after approval. */
function LetterView({ letter }: { letter: Letter }) {
  const mail = letter.channel !== 'Brief'
  return (
    <div className="letter">
      <div className="letter__meta">
        <span className="badge badge--info">{letter.channel}</span>
        <span>Vorlage: {letter.template}</span>
        <span className="letter__legend">
          <mark>markiert</mark> = vom Agenten eingesetzt
        </span>
      </div>
      <article className={`paper${mail ? ' paper--mail' : ''}`}>
        {mail ? (
          <dl className="paper__mailhead">
            <div>
              <dt>Von</dt>
              <dd>{signature(letter)}</dd>
            </div>
            <div>
              <dt>An</dt>
              <dd>
                <Filled text={`[[${letter.to.join(', ')}]]`} />
              </dd>
            </div>
            <div>
              <dt>Betreff</dt>
              <dd>
                <b>
                  <Filled text={letter.subject} />
                </b>
              </dd>
            </div>
            {letter.attachments && (
              <div>
                <dt>Anhang</dt>
                <dd>{letter.attachments.map((a) => `📎 ${a}`).join('  ')}</dd>
              </div>
            )}
          </dl>
        ) : (
          <>
            <header className="paper__head">
              {COMPANY.logo ? <img src={COMPANY.logo} alt={COMPANY.name} /> : <b>{COMPANY.name}</b>}
            </header>
            <div className="paper__sender">{signature(letter)}</div>
            <address className="paper__to">
              {letter.to.map((l, i) => (
                <div key={i}>
                  <Filled text={`[[${l}]]`} />
                </div>
              ))}
            </address>
            <div className="paper__date">
              Musterstadt, <Filled text={`[[${day()}]]`} />
            </div>
            <p className="paper__subject">
              <Filled text={letter.subject} />
            </p>
          </>
        )}
        <p>
          <Filled text={letter.salutation} />
        </p>
        {letter.body.map((b, i) => (
          <p key={i}>
            <Filled text={b} />
          </p>
        ))}
        <p>
          Mit freundlichen Grüßen
          <br />
          {COMPANY.name}
          <br />
          <span className="paper__dept">{letter.from}</span>
        </p>
        {!mail && letter.attachments && <p className="paper__attach">Anlagen: {letter.attachments.join(', ')}</p>}
      </article>
      {letter.basis && <p className="ws-note">Rechtsgrundlage der Vorlage: {letter.basis}. Die Vorlagen werden bei der Einrichtung durch Ihre eigenen ersetzt und einmal juristisch geprüft.</p>}
    </div>
  )
}

function Detail({
  item,
  columns,
  done,
  act,
  back,
}: {
  item: WsItem
  columns?: string[]
  done?: string
  act: (item: WsItem, action: string) => void
  back?: () => void
}) {
  return (
    <div className="ws-detail">
      {back && (
        <button className="ws-back" onClick={back}>
          ← Zurück zur Liste
        </button>
      )}
      <div className="ws-detail__head">
        <h3>{item.title}</h3>
        <Badge badge={done ? { text: done, tone: 'ok' } : item.badge} />
      </div>
      {(item.sub || item.meta) && (
        <div className="eyebrow">
          {[item.sub, item.meta].filter(Boolean).join(' · ')}
        </div>
      )}
      {item.cells && !item.body && (
        <dl className="ws-fields">
          {(columns ?? []).map((c, i) => (
            <div key={c}>
              <dt>{c}</dt>
              <dd>{item.cells![i]}</dd>
            </div>
          ))}
        </dl>
      )}
      {item.body && <p className="ws-detail__body">{item.body}</p>}
      {item.fields && (
        <dl className="ws-fields">
          {item.fields.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {item.letter && <LetterView letter={item.letter} />}
      {!done && item.actions && item.actions.length > 0 && (
        <div className={`ws-actions${item.letter ? ' ws-actions--sticky' : ''}`}>
          {item.actions.map((a, i) => (
            <button key={a} className={i === 0 ? 'btn btn--primary' : 'btn'} onClick={() => act(item, a)}>
              {a}
            </button>
          ))}
        </div>
      )}
      {done && <p className="ws-note">✓ {done} — in der Demo nur vorgemerkt.</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lead overview
// ---------------------------------------------------------------------------

function LeadOverview({ target, go }: { target: WsTarget; go: (t: WsTarget) => void }) {
  const dept = DEPARTMENTS.find((d) => d.id === target.deptId)!
  const approved = useOffice((s) => s.approved)
  const now = new Date()
  const s = split(dept.runs, now)
  const open = dept.waiting.filter((w) => !approved.includes(w))
  const log = deptProtocol(dept, now).filter((p) => p.done).slice(0, 5)
  return (
    <div className="ws-overview">
      <p className="body body--lead">{dept.lead.about}</p>
      <div className="stats stats--3">
        <button className="stat stat--link" onClick={() => go(logTarget(dept, 'done'))}>
          <div className="stat__value">{fmt(s.done)}</div>
          <div className="stat__label">Heute erledigt</div>
        </button>
        <button className="stat stat--link" onClick={() => go(logTarget(dept, 'planned'))}>
          <div className="stat__value">{fmt(s.total - s.done)}</div>
          <div className="stat__label">Noch geplant</div>
        </button>
        <button className="stat stat--link" onClick={() => go(approvalsTarget(dept))}>
          <div className="stat__value" style={{ color: '#e8c170' }}>
            {open.length}
          </div>
          <div className="stat__label">Wartet auf Sie</div>
        </button>
      </div>
      <div className="section">
        <span className="eyebrow">Team · jeder Agent öffnet seinen Arbeitsbereich</span>
        <div className="team">
          {dept.agents
            .filter((a) => !a.lead)
            .map((a) => (
              <button key={a.id} className="team__row" onClick={() => go(agentTarget(dept, a))}>
                <span className={`status status--${a.status}`} />
                <span>
                  <b>{a.name}</b>
                  <small>
                    {SOURCES[kindOf(a)].system} · {a.doing}
                  </small>
                </span>
                <span className="eyebrow">Öffnen →</span>
              </button>
            ))}
        </div>
      </div>
      <div className="section">
        <span className="eyebrow">Zuletzt erledigt</span>
        <div className="team">
          {log.map((p, i) => (
            <button key={i} className="team__row" onClick={() => go(logTarget(dept, undefined, p.text))}>
              <span className="protocol__time">{p.time}</span>
              <span>
                <b>{p.text}</b>
              </span>
              <span className="eyebrow">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// The window
// ---------------------------------------------------------------------------

/**
 * One AnimatePresence that outlives every window, with the window as its only
 * child. The window used to return its own AnimatePresence, early, when
 * closed — which left the exiting backdrop mounted over the page, invisible
 * but still catching taps, so the next window never opened and the office
 * sat there dimmed.
 */
export default function Workspace() {
  const ws = useOffice((s) => s.ws)
  return <AnimatePresence>{ws && <Window key="window" ws={ws} />}</AnimatePresence>
}

function Window({ ws }: { ws: WsTarget }) {
  const openWs = useOffice((s) => s.open)
  const closeWs = useOffice((s) => s.close)
  const approved = useOffice((s) => s.approved)
  const approve = useOffice((s) => s.approve)
  const showSetup = useOffice((s) => s.showSetup)
  const wide = useWide()

  const [stack, setStack] = useState<WsTarget[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'alle' | 'done' | 'planned'>('alle')
  const [chosen, setChosen] = useState<string | undefined>()
  const [done, setDone] = useState<Record<string, string>>({})
  const [toast, setToast] = useState<string | null>(null)
  const [plug, setPlug] = useState(false)

  const key = `${ws.kind}:${ws.deptId}:${ws.agentId}:${ws.title}`
  const layout = LAYOUT[ws.kind]
  const all = useMemo(() => itemsFor(ws, approved), [ws, approved])

  // A new window starts clean, on the record it was opened for.
  useEffect(() => {
    setQuery('')
    setPlug(false)
    setFilter(ws.filter ?? 'alle')
    const focus = ws.focus ? all.find((i) => i.title === ws.focus || i.approval === ws.focus) : undefined
    setChosen(focus?.id ?? (wide && layout?.layout !== 'overview' ? all[0]?.id : undefined))
    // Only on a new window: re-running on every approval would jump the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && closeWs()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [ws, closeWs])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  const source = SOURCES[ws.kind]
  const q = query.trim().toLowerCase()
  const items = all.filter(
    (i) =>
      (filter === 'alle' || (filter === 'planned' ? i.planned : !i.planned)) &&
      (!q || [i.title, i.sub, i.meta, i.body, ...(i.cells ?? [])].some((x) => x?.toLowerCase().includes(q))),
  )
  const item = all.find((i) => i.id === chosen)

  const go = (t: WsTarget) => {
    setStack((s) => [...s, ws])
    openWs(t)
  }
  const back = () => {
    const prev = stack[stack.length - 1]
    setStack((s) => s.slice(0, -1))
    if (prev) openWs(prev)
  }

  const act = (it: WsItem, action: string) => {
    if (it.approval && /Freigeben|Beauftragen|Ablehnen/.test(action)) approve(it.approval)
    const sends = it.letter && /^(Freigeben|Beauftragen)/.test(action)
    const label = sends
      ? `Freigegeben – ${it.letter!.channel === 'Brief' ? 'Brief geht in den Versand' : 'Mail wird gesendet'}`
      : action === 'Freigeben'
        ? 'Freigegeben'
        : action === 'Ablehnen'
          ? 'Abgelehnt'
          : action === 'Erledigt'
            ? 'Erledigt'
            : `${action} vorgemerkt`
    setDone((d) => ({ ...d, [`${key}/${it.id}`]: label }))
    setToast(
      sends
        ? `${label}: ${it.title}. In der Demo nur vorgemerkt – nach der Einrichtung geht es wirklich raus.`
        : `${label}: ${it.title}. Nach der Anbindung an „${source.system}“ passiert das wirklich.`,
    )
  }

  const showDetail = item && (wide || layout.layout !== 'overview')
  const narrowDetail = !wide && item

  let records: ReactNode
  if (layout.layout === 'overview') records = <LeadOverview target={ws} go={go} />
  else if (layout.layout === 'board') records = <Board items={items} columns={layout.columns!} chosen={chosen} pick={(i) => setChosen(i.id)} />
  else if (layout.layout === 'table') records = <Table items={items} columns={layout.columns!} chosen={chosen} pick={(i) => setChosen(i.id)} />
  else records = <List items={items} chosen={chosen} pick={(i) => setChosen(i.id)} agenda={layout.layout === 'calendar'} />

  const detail = item ? (
    <Detail item={item} columns={layout.layout === 'table' ? layout.columns : undefined} done={done[`${key}/${item.id}`]} act={act} back={wide ? undefined : () => setChosen(undefined)} />
  ) : null

  return (
    <>
      <motion.div
        className="ws-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, pointerEvents: 'none' }}
        transition={{ duration: 0.2 }}
        onClick={closeWs}
      />
      <motion.section
        className="ws"
        role="dialog"
        aria-modal="true"
        aria-label={ws.title}
        style={{ ['--c' as string]: ws.color }}
        initial={{ opacity: 0, y: 30, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 30, pointerEvents: 'none', transition: { duration: 0.18 } }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        <header className="ws-head">
          {stack.length > 0 && (
            <button className="icon-btn" onClick={back} aria-label="Zurück">
              ←
            </button>
          )}
          <span className="sheet__icon">{ws.kind === 'lead' ? <Spark size={18} /> : <Icon name={iconFor(ws)} size={20} />}</span>
          <div className="ws-head__title">
            <h2>{ws.title}</h2>
            <div className="eyebrow">{ws.sub}</div>
          </div>
          <button className="icon-btn" onClick={closeWs} aria-label="Fenster schließen">
            ✕
          </button>
        </header>

        <div className="ws-source">
          <span className="ws-source__dot" />
          <span className="ws-source__text">
            <b>{source.system}</b> · {source.account}
          </span>
          <span className="badge badge--muted">Platzhalter</span>
          <button className="btn btn--small" onClick={() => setPlug(!plug)} aria-expanded={plug}>
            {plug ? 'Schließen' : 'Anbinden'}
          </button>
        </div>
        <AnimatePresence>
          {plug && (
            <motion.div className="ws-plug" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
              <div className="ws-plug__inner">
                <p>
                  Dieser Bereich wird bei der Einrichtung mit dem System von <b>{COMPANY.name}</b> verbunden. Typisch:{' '}
                  {source.examples}.
                </p>
                <ul>
                  {source.does.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
                <p className="ws-note">Zugangsdaten werden nicht hier eingegeben, sondern sicher bei der Einrichtung hinterlegt.</p>
                <button className="btn btn--small" onClick={() => showSetup(true)}>
                  So läuft die Einrichtung →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {layout.layout !== 'overview' && (
          <div className="ws-tools">
            <input
              id="ws-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`In „${ws.title}“ suchen …`}
              aria-label="Suchen"
            />
            {ws.kind === 'log' && (
              <div className="ws-filter" role="group" aria-label="Filter">
                {(['alle', 'done', 'planned'] as const).map((f) => (
                  <button key={f} className={filter === f ? 'is-on' : ''} onClick={() => setFilter(f)}>
                    {f === 'alle' ? 'Alle' : f === 'done' ? 'Erledigt' : 'Geplant'}
                  </button>
                ))}
              </div>
            )}
            <span className="eyebrow">{items.length} Einträge</span>
          </div>
        )}

        <div className={`ws-body${showDetail && wide ? ' ws-body--split' : ''}`}>
          {narrowDetail ? (
            detail
          ) : (
            <>
              <div className="ws-records">
                {items.length || layout.layout === 'overview' ? records : <p className="ws-empty">Nichts gefunden.</p>}
              </div>
              {wide && showDetail && detail}
            </>
          )}
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div className="ws-toast" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>
    </>
  )
}

function iconFor(t: WsTarget) {
  const d = DEPARTMENTS.find((x) => x.id === t.deptId)
  if (d) return d.icon
  return 'brain' as const
}
