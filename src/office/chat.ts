import { ask as bridgeAsk, cancel as bridgeCancel, warmBridge, isConnected } from '../lib/bridge'
import {
  BRAIN,
  COMPANY,
  DEPARTMENTS,
  AGENT_COUNT,
  brainProtocol,
  deptProtocol,
  fmt,
  split,
  type Department,
} from './data'
import { GRUPPE } from './gruppe'
import { useOffice } from './state'
import { needsLeitung } from './team'
import { agentTarget, itemsFor } from './workspaces'

/**
 * Answers for the chat line under every panel.
 *
 * Three backends, tried in this order. On a developer machine with the JARVIS
 * bridge running (`npm start`), the question goes to Claude through the
 * bridge. In the published artifact it goes to Claude through the runtime's
 * `sample` capability, on the viewer's own account. Without either, the page
 * still answers the suggested questions — and anything close to them — from
 * the same figures the panels show, so a demo never dead-ends.
 */

export type Who = { kind: 'brain' } | { kind: 'dept'; dept: Department }
export type Turn = SampleTurn

let bridge: 'unknown' | 'up' | 'down' = 'unknown'

// The bridge only accepts sockets from localhost dev ports, so anywhere else
// trying it would just cost the 3 s timeout before every first answer.
const onLocalhost = ['localhost', '127.0.0.1'].includes(location.hostname)

async function bridgeUp(): Promise<boolean> {
  if (!onLocalhost) return false
  if (bridge !== 'unknown') return bridge === 'up'
  try {
    await Promise.race([warmBridge(), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 3000))])
    bridge = isConnected() ? 'up' : 'down'
  } catch {
    bridge = 'down'
  }
  return bridge === 'up'
}

// Asked once at load: the runtime resolves the function, or null where it can
// never run (it decides that within about 10 s; outside claude.ai there is no
// window.claude and this is null at once). Consent is asked on the first call.
let sample: SampleFn | null = null
const samplePromise: Promise<SampleFn | null> = (() => {
  try {
    return window.claude?.use?.('sample').catch(() => null) ?? Promise.resolve(null)
  } catch {
    return Promise.resolve(null)
  }
})()
samplePromise.then((fn) => (sample = fn))
/** Set when the viewer declined or Claude is off for this account: never ask again in this view. */
let sampleOff = false

/** Which backend answers right now, for the label under the thread. */
export function brainMode(): 'bridge' | 'claude' | 'demo' {
  if (bridge === 'up') return 'bridge'
  if (sample && !sampleOff) return 'claude'
  return 'demo'
}

/**
 * The line beside a company that names the one above it. The KG's link is a
 * general partner seen in a search hit and the others are read off the
 * network graph, so both say where they come from instead of claiming more.
 */
const parentNote = (g: { name: string; mutter?: string }) =>
  !g.mutter ? '' : g.name.includes('Co. KG') ? `Komplementärin laut Treffer: ${g.mutter}` : `Gesellschafterin laut Netzwerk-Grafik: ${g.mutter}`

/** The group's companies as the register knows them, for anyone asked about the group. */
const gruppe = GRUPPE
  ? `Gesellschaften der Gruppe (${GRUPPE.quelle}): ${GRUPPE.gesellschaften
      .map((g) => `${g.name}, ${g.register}${g.mutter ? `, ${parentNote(g)}` : ''}${g.belegt ? '' : ', Registernummer noch zu bestätigen'}`)
      .join(' | ')}. Die Aufgaben der Gesellschaften sind aus ihren Namen abgeleitet und nicht bestätigt.`
  : ''

/** What still waits in a department, leaving out what was approved or signed today. */
function open(d: Department): string[] {
  const approved = useOffice.getState().approved
  return d.waiting.filter((w) => !approved.includes(w))
}

/** The group's filing deadlines, as the Fristen window lists them. */
function deadlines(): string[] {
  const holding = DEPARTMENTS.find((d) => d.id === 'holding')
  const agent = holding?.agents.find((a) => a.name === 'Fristen & Offenlegung')
  if (!holding || !agent) return []
  return itemsFor(agentTarget(holding, agent), [], [])
    .filter((i) => i.id.startsWith('fr'))
    .map((i) => `${i.meta} · ${i.title} – ${i.sub}`)
}

function context(who: Who): string {
  const now = new Date()
  if (who.kind === 'brain') {
    return [
      ...(gruppe ? [gruppe, `Fristen: ${deadlines().join('; ')}.`] : []),
      `Firma: ${COMPANY.name}. ${AGENT_COUNT} KI-Agenten in ${DEPARTMENTS.length} Abteilungen.`,
      `Gedächtnis: ${BRAIN.stats.map((s) => `${fmt(s.value)} ${s.label}`).join(', ')}.`,
      `Abteilungen: ${DEPARTMENTS.map((d) => `${d.name} (${d.agents.length} Agenten, ${d.tagline}; wartet: ${open(d).join('; ') || 'nichts'})`).join(' | ')}.`,
      `Protokoll heute: ${brainProtocol(now).slice(0, 8).map((p) => `${p.time} ${p.text}`).join('; ')}.`,
    ].join('\n')
  }
  const d = who.dept
  const s = split(d.runs, now)
  return [
    `Firma: ${COMPANY.name}. Abteilung ${d.name} (${d.tagline}).`,
    `${d.lead.about}`,
    `Kennzahlen: ${d.kpis.map((k) => `${fmt(k.value)} ${k.label}`).join(', ')}. Läufe heute: ${s.done} erledigt von ${s.total} geplant.`,
    `Team: ${d.agents.map((a) => `${a.name} (${a.status}: ${a.doing})`).join('; ')}.`,
    `Wartet auf Freigabe: ${open(d).join('; ') || 'nichts'}.`,
    `Protokoll: ${deptProtocol(d, now).slice(0, 8).map((p) => `${p.time} ${p.text}${p.done ? '' : ' (geplant)'}`).join('; ')}.`,
    ...(gruppe && d.id === 'holding' ? [gruppe, `Fristen: ${deadlines().join('; ')}.`] : []),
  ].join('\n')
}

/** Offline answers, built from the same figures the panels show. */
function local(question: string, who: Who): string {
  const q = question.toLowerCase()
  const now = new Date()
  const group = who.kind === 'brain' || who.dept.id === 'holding'
  // Ahead of the register branch: "Transparenzregister" is a deadline, not a question about the companies.
  if (GRUPPE && group && /frist|offenleg|transparenz|steuer/.test(q)) {
    const rows = deadlines()
    return `${rows.length} Fristen stehen an:\n• ${rows.join('\n• ')}`
  }
  if (GRUPPE && group && /gesellschaft|gruppe|register|hrb|firmen|aufgebaut|struktur/.test(q)) {
    const unconfirmed = GRUPPE.gesellschaften.filter((g) => !g.belegt)
    return (
      `Zur Gruppe gehören ${GRUPPE.gesellschaften.length} Gesellschaften, alle beim ${GRUPPE.gesellschaften[0].register.split(', ')[0]}:\n• ` +
      GRUPPE.gesellschaften.map((g) => `${g.name} – ${g.register.split(', ').pop()}${g.mutter ? ` (${parentNote(g)})` : ''}`).join('\n• ') +
      (unconfirmed.length ? `\n\nNoch zu bestätigen: ${unconfirmed.map((g) => g.name).join(', ')}.` : '')
    )
  }
  // Ahead of "heute": the question is about the signature, not about the day.
  if (/unterschreib|unterschrift/.test(q)) {
    const depts = who.kind === 'brain' ? DEPARTMENTS : [who.dept]
    const sign = depts.flatMap((d) => open(d).filter(needsLeitung).map((w) => `${d.short}: ${w}`))
    return sign.length
      ? `${sign.length === 1 ? 'Eine Sache braucht' : `${sign.length} Dinge brauchen`} die Unterschrift der Leitung:\n• ${sign.join('\n• ')}`
      : 'Gerade liegt nichts zur Unterschrift bereit.'
  }
  if (who.kind === 'brain') {
    if (/herein|heute|neu|kam/.test(q)) {
      const log = brainProtocol(now).filter((p) => p.done)
      return `Heute ${log.length} Synchronisierungen. Zuletzt um ${log[0]?.time ?? '–'}: ${log[0]?.text ?? '–'}. Seit heute früh sind Mails, Termine und die Zahlen aller ${DEPARTMENTS.length} Abteilungen drin.`
    }
    if (/wei(ß|ss)|wissen|wie viel|dokument/.test(q)) {
      const [docs, contacts, protocols, mails, dates, chats] = BRAIN.stats
      return `Ich kenne ${fmt(docs.value)} Dokumente, ${fmt(contacts.value)} Kontakte und ${fmt(protocols.value)} Gesprächsprotokolle — dazu ${fmt(mails.value)} Mails, ${fmt(dates.value)} Termine und ${fmt(chats.value)} Chats.`
    }
    if (/wart|offen|freigab|mich/.test(q)) {
      const all = DEPARTMENTS.flatMap((d) => open(d).map((w) => `${d.short}: ${w}`))
      return all.length
        ? `${all.length === 1 ? 'Eine Sache wartet' : `${all.length} Dinge warten`} auf dich:\n• ${all.join('\n• ')}`
        : 'Nein, gerade wartet nichts auf dich.'
    }
    const dept = DEPARTMENTS.find((d) => q.includes(d.short.toLowerCase()) || q.includes(d.name.toLowerCase()))
    if (dept) return local('was lief heute', { kind: 'dept', dept })
    return `Ich bin das Gedächtnis von ${COMPANY.name}: ${AGENT_COUNT} Agenten in ${DEPARTMENTS.length} Abteilungen schreiben hier hinein. Frag mich, was heute hereinkam, was auf dich wartet oder wie es in einer Abteilung steht.`
  }

  const d = who.dept
  const s = split(d.runs, now)
  const log = deptProtocol(d, now)
  if (/n(ä|ae)chst|kommt|plan|später/.test(q)) {
    const next = log.filter((p) => !p.done).reverse().slice(0, 3)
    return next.length
      ? `Als Nächstes:\n• ${next.map((p) => `${p.time} ${p.text}`).join('\n• ')}\nInsgesamt sind heute noch ${s.total - s.done} Läufe geplant.`
      : `Für heute ist alles erledigt — morgen früh geht es mit „${d.jobs[0]}“ weiter.`
  }
  if (/wart|mich|freigab|offen/.test(q)) {
    const waiting = open(d)
    return waiting.length
      ? `Ja, ${waiting.length === 1 ? 'eine Sache wartet' : `${waiting.length} Dinge warten`} auf dich:\n• ${waiting.join('\n• ')}`
      : 'Nein, gerade wartet nichts auf dich.'
  }
  if (/lief|heute|stand|was/.test(q)) {
    const done = log.filter((p) => p.done).slice(0, 3)
    const busy = d.agents.filter((a) => a.status === 'arbeitet')
    return `Heute ${s.done} von ${s.total} Läufen erledigt. Zuletzt:\n• ${done.map((p) => `${p.time} ${p.text}`).join('\n• ')}\nGerade arbeiten ${busy.length} von ${d.agents.length} Agenten.`
  }
  const agent = d.agents.find((a) => q.includes(a.name.toLowerCase()))
  if (agent) return `${agent.name} (${agent.role}) — ${agent.status}: ${agent.doing}.`
  return `Ich bin der ${d.lead.title}. ${d.kpis.map((k) => `${fmt(k.value)} ${k.label}`).join(', ')}. Frag mich, was heute lief, was als Nächstes kommt oder was auf dich wartet.`
}

/**
 * What a live answer may and may not do. For the group it also says which
 * data is researched and which is demo, so a question about the real
 * companies gets the honest "after the connection" line, never an invented figure.
 */
function rules(who: Who): string {
  const role = who.kind === 'brain' ? `${COMPANY.assistant}, das zentrale Gedächtnis` : who.dept.lead.title
  return (
    `[Agenten-Büro] Du antwortest im Agenten-Büro als ${role} von ${COMPANY.name}. ` +
    'Antworte auf Deutsch, in höchstens vier kurzen Sätzen, ohne Überschriften, nur aus dem Büro-Stand unten. ' +
    'Steht etwas nicht darin, sag, dass es nicht im Gedächtnis ist.' +
    (GRUPPE
      ? ' Registerdaten: Recherche vom 16.10.2026, teils unbestätigt. Objekte, Mieter, Beträge, Darlehen und Kennzahlen sind Beispieldaten der Demo. ' +
        'Erfinde keine Fakten über die echten Gesellschaften; was nicht im Stand steht, beantworte mit: „Das liest das Büro nach der Anbindung aus Ihren Systemen.“'
      : '')
  )
}

export type Handlers = {
  /** More of the answer. */
  onText: (delta: string) => void
  /** Replaces the whole answer, for one that was withdrawn or broke off. */
  onSet?: (text: string) => void
  signal?: AbortSignal
}

/** Viewer copy for the failures that leave live answers on. */
const NOTE: Record<string, string> = {
  rate_limited: 'Gerade zu viele Fragen – bitte kurz warten.',
  session_expired: 'Bitte bei Claude neu anmelden, dann noch einmal fragen.',
}

/** Asks through `sample`. False means the offline answer should take over. */
async function viaSample(fn: SampleFn, question: string, who: Who, history: Turn[], { onText, onSet, signal }: Handlers): Promise<boolean> {
  let prev = ''
  const turns: Turn[] = [
    { role: 'user', content: `${rules(who)}\n=== BÜRO-STAND ===\n${context(who)}` },
    ...history.filter((t) => t.content.trim()).slice(-8),
    { role: 'user', content: question },
  ]
  try {
    await fn(turns, {
      modelTier: 'quick',
      cache: false,
      signal,
      // The delta comes from the cumulative text, whichever shape the runtime sends.
      onText: (o) => {
        onText(o.text.slice(prev.length))
        prev = o.text
      },
    })
    return true
  } catch (err) {
    const e = (err ?? {}) as SampleError
    const kept = e.text ?? prev
    switch (e.code) {
      case 'cancelled':
        return true
      case 'not_granted':
      case 'sampling_disabled':
      case 'capability_disabled':
      case 'capability_removed':
      case 'not_declared':
        // Declined or switched off, which is final for this view: the demo answers from here on.
        sampleOff = true
        onSet?.('')
        return false
      case 'refused':
        // Whatever had streamed is withdrawn.
        onSet?.('Dazu antworte ich hier nicht. Fragen Sie mich nach dem Stand im Büro.')
        return true
      default:
        if (NOTE[e.code]) onSet?.(kept ? `${kept}\n\n${NOTE[e.code]}` : NOTE[e.code])
        else if (kept) onSet?.(`${kept} (unterbrochen)`)
        else return false
        return true
    }
  }
}

export async function answer(question: string, who: Who, history: Turn[], handlers: Handlers): Promise<void> {
  const { onText, signal } = handlers
  if (await bridgeUp()) {
    const prompt = `${rules(who)} Ohne Werkzeuge und ohne Panels.\n\n${context(who)}\n\nFrage: ${question}`
    // Stop tells the bridge to stop and settles the turn with what was already said.
    const stop = () => bridgeCancel()
    signal?.addEventListener('abort', stop, { once: true })
    try {
      await bridgeAsk(prompt, { onText: (delta) => !signal?.aborted && onText(delta), onTool: () => {} })
      return
    } catch {
      bridge = 'down'
    } finally {
      signal?.removeEventListener('abort', stop)
    }
  }
  if (signal?.aborted) return
  const fn = sampleOff ? null : await samplePromise
  if (fn && !sampleOff && !signal?.aborted && (await viaSample(fn, question, who, history, handlers))) return
  // Type the offline answer out, so it reads like the live one.
  const text = local(question, who)
  for (let i = 0; i < text.length; i += 3) {
    if (signal?.aborted) return
    onText(text.slice(i, i + 3))
    await new Promise((r) => setTimeout(r, 12))
  }
}
