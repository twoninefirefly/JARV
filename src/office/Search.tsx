import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DEPARTMENTS, type Agent, type Department } from './data'
import { useOffice } from './state'
import { Icon } from './Icon'
import { SOURCES, agentTarget, itemsFor, kindOf, waitingOwner } from './workspaces'

/**
 * Search everything in the office — departments, agents, every record in
 * their work areas, every decision — and fly there: the camera travels to
 * the department and on to the agent's desk, then the agent's window opens
 * on the record you picked.
 */

type Hit = {
  key: string
  group: 'Abteilungen' | 'Agenten' | 'Vorgänge' | 'Freigaben'
  title: string
  sub: string
  dept: Department
  agent?: Agent
  focus?: string
  hay: string
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')

/** Everything searchable, built once per opening. */
function buildIndex(approved: string[]): Hit[] {
  const hits: Hit[] = []
  for (const d of DEPARTMENTS) {
    hits.push({ key: `d-${d.id}`, group: 'Abteilungen', title: d.name, sub: `${d.agents.length} Agenten · ${d.tagline}`, dept: d, hay: norm(`${d.name} ${d.short} ${d.tagline}`) })
    for (const a of d.agents) {
      const src = SOURCES[kindOf(a)]
      hits.push({
        key: `a-${a.id}`,
        group: 'Agenten',
        title: a.name,
        sub: `${d.short} · ${a.role} · ${a.doing}`,
        dept: d,
        agent: a,
        hay: norm(`${a.name} ${a.role} ${a.doing} ${d.short} ${src.system} ${src.examples}`),
      })
      if (a.lead) continue
      for (const it of itemsFor(agentTarget(d, a), approved)) {
        if (it.approval) continue
        hits.push({
          key: `r-${a.id}-${it.id}`,
          group: 'Vorgänge',
          title: it.title,
          sub: `${a.name} · ${d.short}${it.sub ? ` · ${it.sub}` : ''}`,
          dept: d,
          agent: a,
          focus: it.title,
          hay: norm(`${it.title} ${it.sub ?? ''} ${it.meta ?? ''} ${(it.cells ?? []).join(' ')} ${it.body ?? ''} ${a.name}`),
        })
      }
    }
    d.waiting.forEach((w, i) => {
      const owner = waitingOwner(d, i)
      hits.push({
        key: `w-${d.id}-${i}`,
        group: 'Freigaben',
        title: w,
        sub: `${d.short} · ${owner.name}${approved.includes(w) ? ' · erledigt' : ' · wartet'}`,
        dept: d,
        agent: owner,
        focus: w,
        hay: norm(`${w} ${d.short} ${owner.name} freigabe`),
      })
    })
  }
  return hits
}

const ORDER: Hit['group'][] = ['Freigaben', 'Abteilungen', 'Agenten', 'Vorgänge']

export default function Search() {
  const open = useOffice((s) => s.search)
  const setOpen = useOffice((s) => s.showSearch)
  const show = useOffice((s) => s.show)
  const openWs = useOffice((s) => s.open)
  const approved = useOffice((s) => s.approved)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const list = useRef<HTMLDivElement>(null)

  const index = useMemo(() => (open ? buildIndex(approved) : []), [open, approved])
  const results = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean)
    const found = words.length ? index.filter((h) => words.every((w) => h.hay.includes(w))) : index.filter((h) => h.group === 'Abteilungen' || h.group === 'Freigaben')
    // Grouped, and within a group the titles that start with the query first.
    const first = words[0] ?? ''
    return found
      .map((h) => ({ h, s: ORDER.indexOf(h.group) * 10 + (norm(h.title).startsWith(first) ? 0 : 1) }))
      .sort((a, b) => a.s - b.s)
      .slice(0, 40)
      .map((x) => x.h)
  }, [q, index])

  useEffect(() => setSel(0), [q, open])
  useEffect(() => {
    if (open) setQ('')
  }, [open])
  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  const go = (h: Hit) => {
    setOpen(false)
    // The camera flies first — to the department, and on to the desk — then the window opens.
    show({ kind: 'dept', id: h.dept.id, agent: h.agent?.id })
    if (h.agent) setTimeout(() => openWs(agentTarget(h.dept, h.agent!, h.focus)), 1300)
  }

  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSel((s) => Math.min(results.length - 1, s + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSel((s) => Math.max(0, s - 1))
    } else if (e.key === 'Enter' && results[sel]) go(results[sel])
    else if (e.key === 'Escape') setOpen(false)
  }

  let lastGroup = ''
  return (
    <AnimatePresence>
      {open && (
        <div className="search" role="dialog" aria-modal="true" aria-label="Suchen">
          <motion.div className="sig__backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} />
          <motion.div className="search__card" initial={{ opacity: 0, y: -14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ type: 'spring', damping: 28, stiffness: 320 }}>
            <div className="search__field">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={key}
                placeholder="Suchen: Mieter, Schaden, Agent, Rechnung, Adresse …"
                aria-label="Suchen"
                role="combobox"
                aria-expanded
              />
              <kbd>Esc</kbd>
            </div>
            <div className="search__list" ref={list} role="listbox">
              {results.length === 0 && <p className="search__empty">Nichts gefunden.</p>}
              {results.map((h, i) => {
                const head = h.group !== lastGroup ? h.group : null
                lastGroup = h.group
                return (
                  <div key={h.key}>
                    {head && <div className="search__group">{head}</div>}
                    <button role="option" aria-selected={i === sel} className="search__hit" style={{ ['--c' as string]: h.dept.color }} onMouseEnter={() => setSel(i)} onClick={() => go(h)}>
                      <span className="search__icon">
                        <Icon name={h.dept.icon} size={15} />
                      </span>
                      <span className="search__text">
                        <b>{h.title}</b>
                        <small>{h.sub}</small>
                      </span>
                      <span className="search__go">{h.agent ? 'Hinfliegen →' : 'Zur Abteilung →'}</span>
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="search__foot">↑ ↓ auswählen · Enter hinfliegen · Strg K öffnet die Suche überall</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
