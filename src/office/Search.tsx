import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { DEPARTMENTS, type Agent, type Department } from './data'
import { useOffice } from './state'
import { Icon } from './Icon'
import { SOURCES, agentTarget, itemsFor, kindOf, waitingOwner } from './workspaces'
import { useModal } from './modal'
import { Empty } from './Workspace'

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

/**
 * The typed words, marked where they occur. Matching itself ignores umlaut
 * spellings ('mueller' finds 'Müller'); the mark only shows exact spellings,
 * which is the common case and never marks the wrong letters.
 */
function hl(text: string, words: string[]) {
  if (!words.length) return text
  const re = new RegExp(`(${words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig')
  return text.split(re).map((part, i) =>
    i % 2 ? (
      <mark key={i} className="search__mark">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

export default function Search() {
  const open = useOffice((s) => s.search)
  return <AnimatePresence>{open && <Finder key="search" />}</AnimatePresence>
}

function Finder() {
  const setOpen = useOffice((s) => s.showSearch)
  const show = useOffice((s) => s.show)
  const openWs = useOffice((s) => s.open)
  const approved = useOffice((s) => s.approved)
  const setGarden = useOffice((s) => s.setGarden)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const list = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  useModal(root, () => setOpen(false))

  // Built once per opening: the search mounts with every opening.
  const index = useMemo(() => buildIndex(approved), [approved])
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

  // The secret: "secret garden" in the search — and only for Kim Bormann.
  const user = useOffice((s) => s.user)
  const secret = user?.id === 'leitung2' && /^secret\s*garden:?$/.test(norm(q).trim())
  const bloom = () => {
    setOpen(false)
    show({ kind: 'overview' })
    setGarden(true)
  }

  useEffect(() => setSel(0), [q])
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
    } else if (e.key === 'Home' && results.length) {
      e.preventDefault()
      setSel(0)
    } else if (e.key === 'End' && results.length) {
      e.preventDefault()
      setSel(results.length - 1)
    } else if (e.key === 'Enter') {
      // Handled here; the Enter must not go on to press whatever has focus once the search is gone.
      e.preventDefault()
      if (secret) bloom()
      else if (results[sel]) go(results[sel])
    }
  }

  const rawWords = q.trim().split(/\s+/).filter(Boolean)
  const counts: Partial<Record<Hit['group'], number>> = {}
  for (const h of results) counts[h.group] = (counts[h.group] ?? 0) + 1
  // The results in their groups, each group a labelled set of options.
  const groups = ORDER.map((g) => ({ g, hits: results.map((h, i) => ({ h, i })).filter(({ h }) => h.group === g) })).filter((x) => x.hits.length)
  const active = secret ? 'hit-secret' : results[sel] ? `hit-${results[sel].key}` : undefined

  return (
    <div className="search" role="dialog" aria-modal="true" aria-label="Suchen" ref={root}>
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
            aria-controls="search-list"
            aria-autocomplete="list"
            aria-expanded={results.length > 0 || secret}
            aria-activedescendant={active}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="search__list" ref={list} role="listbox" id="search-list" aria-label="Suchergebnisse">
          {secret && (
            <button id="hit-secret" role="option" tabIndex={-1} className="search__hit search__secret" aria-selected onMouseDown={(e) => e.preventDefault()} onClick={bloom}>
              <span className="search__icon">🌹</span>
              <span className="search__text">
                <b>Secret Garden</b>
                <small>Rasen und Rosen unter dem ganzen Büro</small>
              </span>
              <span className="search__go">Erblühen lassen →</span>
            </button>
          )}
          {!secret && results.length === 0 && (
            <Empty
              title={`Kein Treffer für „${q.trim()}“`}
              hint="Andere Schreibweise oder weniger Wörter versuchen."
              action={
                <button className="btn btn--small" onMouseDown={(e) => e.preventDefault()} onClick={() => setQ('')}>
                  Suche zurücksetzen
                </button>
              }
            />
          )}
          {groups.map(({ g, hits }) => (
            <div key={g} role="group" aria-labelledby={`grp-${g}`}>
              <div className="search__group" id={`grp-${g}`}>
                {g} <span className="search__count">{counts[g]}</span>
              </div>
              {hits.map(({ h, i }) => (
                <button
                  key={h.key}
                  id={`hit-${h.key}`}
                  role="option"
                  tabIndex={-1}
                  aria-selected={i === sel}
                  className="search__hit"
                  style={{ ['--c' as string]: h.dept.color }}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setSel(i)}
                  onClick={() => go(h)}
                >
                  <span className="search__icon">
                    <Icon name={h.dept.icon} size={15} />
                  </span>
                  <span className="search__text">
                    <b>{hl(h.title, rawWords)}</b>
                    <small>{hl(h.sub, rawWords)}</small>
                  </span>
                  <span className="search__go">{h.agent ? 'Hinfliegen →' : 'Zur Abteilung →'}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <p className="sr-only" role="status">
          {secret ? '1 Treffer' : `${results.length} Treffer`}
        </p>
        <div className="search__foot">
          <kbd>↑</kbd>
          <kbd>↓</kbd> auswählen · <kbd>Enter</kbd> hinfliegen · <kbd>Strg K</kbd> überall
        </div>
      </motion.div>
    </div>
  )
}
