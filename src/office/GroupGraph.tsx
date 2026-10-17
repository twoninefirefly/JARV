import { useId } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { Gesellschaft } from './kunden'

/**
 * The group's structure as a small tree, drawn from each company's `mutter`.
 *
 * Companies without a parent are roots. Leaves take the next free column in
 * depth-first order and a parent sits over the middle of its children, so the
 * Hukic group comes out as two clusters in three columns and three rows. A link
 * is solid only where the research confirmed it in the register; everything
 * read off the network graph stays dashed, and nothing claims a share size.
 */

const COL = 132
const ROW = 84
const NODE_W = 124
const NODE_H = 46
const PAD = 6

/** Where P6 records how a link is known; without it every link reads as unconfirmed. */
const confirmed = (g: Gesellschaft) => (g as unknown as { mutterQuelle?: string }).mutterQuelle === 'register'
const number = (g: Gesellschaft) => g.register.split(', ').pop() ?? g.register

function layout(list: Gesellschaft[]) {
  const names = new Set(list.map((g) => g.name))
  const place = new Map<string, { x: number; depth: number }>()
  let slot = 0
  const visit = (g: Gesellschaft, depth: number): number => {
    place.set(g.name, { x: slot, depth })
    const kids = list.filter((k) => k.mutter === g.name && !place.has(k.name))
    const x = kids.length ? kids.map((k) => visit(k, depth + 1)).reduce((a, b) => a + b, 0) / kids.length : slot++
    place.set(g.name, { x, depth })
    return x
  }
  for (const g of list) if (!g.mutter || !names.has(g.mutter)) visit(g, 0)
  // A parent loop would leave companies unplaced; give them a column of their own.
  for (const g of list) if (!place.has(g.name)) visit(g, 0)
  const nodes = list.map((g) => {
    const p = place.get(g.name)!
    return { g, cx: COL / 2 + p.x * COL, cy: PAD + NODE_H / 2 + p.depth * ROW }
  })
  const rows = Math.max(...nodes.map((n) => (n.cy - PAD - NODE_H / 2) / ROW)) + 1
  return { nodes, width: Math.max(1, slot) * COL, height: (rows - 1) * ROW + NODE_H + PAD * 2 }
}

export default function GroupGraph({ gesellschaften, color, onPick }: { gesellschaften: Gesellschaft[]; color: string; onPick: (g: Gesellschaft) => void }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const still = useReducedMotion()
  const { nodes, width, height } = layout(gesellschaften)
  const at = new Map(nodes.map((n) => [n.g.name, n]))
  const edges = nodes.flatMap((child) => {
    const parent = child.g.mutter ? at.get(child.g.mutter) : undefined
    if (!parent) return []
    const y0 = parent.cy + NODE_H / 2
    const y1 = child.cy - NODE_H / 2
    const mid = (y0 + y1) / 2
    return [
      {
        child,
        parent,
        solid: confirmed(child.g),
        d: `M${parent.cx} ${y0} C${parent.cx} ${mid} ${child.cx} ${mid} ${child.cx} ${y1}`,
        label: child.g.name.includes('Co. KG') ? 'Komplementärin laut Treffer' : '',
        lx: (parent.cx + child.cx) / 2,
        ly: mid,
      },
    ]
  })
  const open = gesellschaften.filter((g) => !g.belegt)
  const summary =
    `Struktur der Gruppe, ${gesellschaften.length} Gesellschaften. ` +
    edges.map((e) => `Von ${e.parent.g.name} zu ${e.child.g.name}: ${e.solid ? 'belegt' : 'nur laut Netzwerk-Grafik'}.`).join(' ') +
    (open.length ? ` Registernummer zu prüfen: ${open.map((g) => g.name).join(', ')}.` : '')

  return (
    <div className="ggraph" style={{ ['--c' as string]: color }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={summary}>
        <defs>
          {edges.map((e, i) => (
            // The draw-in runs on a mask, so dashed links keep their dashes while they grow.
            <mask key={i} id={`${uid}-e${i}`} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
              <motion.path
                d={e.d}
                fill="none"
                stroke="white"
                strokeWidth={8}
                initial={{ pathLength: still ? 1 : 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.12, ease: 'easeOut' }}
              />
            </mask>
          ))}
        </defs>
        {edges.map((e, i) => (
          <path key={i} className={`ggraph__edge${e.solid ? '' : ' is-graph'}`} d={e.d} mask={`url(#${uid}-e${i})`} />
        ))}
        {/* Labels sit outside the masks, which only cover the line itself, and fade in once it is drawn. */}
        {edges.map(
          (e, i) =>
            e.label && (
              <motion.text
                key={i}
                className="ggraph__label"
                x={e.lx}
                y={e.ly + 3}
                textAnchor="middle"
                initial={{ opacity: still ? 1 : 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.6 + i * 0.12 }}
              >
                {e.label}
              </motion.text>
            ),
        )}
        {nodes.map(({ g, cx, cy }, i) => (
          <motion.g
            key={g.name}
            className={`ggraph__node${i === 0 ? ' is-head' : ''}${g.belegt ? '' : ' is-open'}`}
            role="button"
            tabIndex={0}
            aria-label={`${g.name}, ${number(g)}, ${g.belegt ? 'belegt' : 'Registernummer zu prüfen'}`}
            onClick={() => onPick(g)}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ') {
                ev.preventDefault()
                onPick(g)
              }
            }}
            initial={{ opacity: still ? 1 : 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          >
            <rect x={cx - NODE_W / 2} y={cy - NODE_H / 2} width={NODE_W} height={NODE_H} rx={11} />
            <circle className={`ggraph__dot${g.belegt ? ' is-ok' : ' is-warn'}`} cx={cx + NODE_W / 2 - 10} cy={cy - NODE_H / 2 + 10} r={3.5} />
            <text className="ggraph__name" x={cx} y={cy - 3} textAnchor="middle">
              {g.kurz}
              {!g.belegt && <tspan className="ggraph__check"> · zu prüfen</tspan>}
            </text>
            <text className="ggraph__num" x={cx} y={cy + 13} textAnchor="middle">
              {number(g)}
            </text>
          </motion.g>
        ))}
      </svg>
      <p className="ggraph__legend">
        <span>
          <i className="ggraph__key" aria-hidden /> belegt
        </span>
        <span>
          <i className="ggraph__key is-graph" aria-hidden /> nur laut Netzwerk-Grafik
        </span>
        <span>Beteiligungshöhen offen</span>
      </p>
    </div>
  )
}
