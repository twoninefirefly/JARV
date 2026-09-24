import { ask as bridgeAsk, warmBridge, isConnected } from '../lib/bridge'
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

/**
 * Answers for the chat line under every panel.
 *
 * With the JARVIS bridge running (`npm start`), the question goes to Claude
 * along with the office's current figures, so anything can be asked. Without
 * it the page still answers the suggested questions — and anything close to
 * them — from the same figures, so a demo never dead-ends on a phone that has
 * no bridge to talk to.
 */

export type Who = { kind: 'brain' } | { kind: 'dept'; dept: Department }

let bridge: 'unknown' | 'up' | 'down' = 'unknown'

async function bridgeUp(): Promise<boolean> {
  if (bridge !== 'unknown') return bridge === 'up'
  try {
    await Promise.race([warmBridge(), new Promise((_, no) => setTimeout(() => no(new Error('timeout')), 3000))])
    bridge = isConnected() ? 'up' : 'down'
  } catch {
    bridge = 'down'
  }
  return bridge === 'up'
}

export const liveMode = () => bridge === 'up'

function context(who: Who): string {
  const now = new Date()
  if (who.kind === 'brain') {
    return [
      `Firma: ${COMPANY.name}. ${AGENT_COUNT} KI-Agenten in ${DEPARTMENTS.length} Abteilungen.`,
      `Gedächtnis: ${BRAIN.stats.map((s) => `${fmt(s.value)} ${s.label}`).join(', ')}.`,
      `Abteilungen: ${DEPARTMENTS.map((d) => `${d.name} (${d.agents.length} Agenten, ${d.tagline}; wartet: ${d.waiting.join('; ') || 'nichts'})`).join(' | ')}.`,
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
    `Wartet auf Freigabe: ${d.waiting.join('; ') || 'nichts'}.`,
    `Protokoll: ${deptProtocol(d, now).slice(0, 8).map((p) => `${p.time} ${p.text}${p.done ? '' : ' (geplant)'}`).join('; ')}.`,
  ].join('\n')
}

/** Offline answers, built from the same figures the panels show. */
function local(question: string, who: Who): string {
  const q = question.toLowerCase()
  const now = new Date()
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
      const all = DEPARTMENTS.flatMap((d) => d.waiting.map((w) => `${d.short}: ${w}`))
      return `${all.length} Dinge warten auf dich:\n• ${all.join('\n• ')}`
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
    return d.waiting.length
      ? `Ja, ${d.waiting.length === 1 ? 'eine Sache wartet' : `${d.waiting.length} Dinge warten`} auf dich:\n• ${d.waiting.join('\n• ')}`
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

export async function answer(question: string, who: Who, onText: (delta: string) => void): Promise<void> {
  if (await bridgeUp()) {
    const role = who.kind === 'brain' ? `${COMPANY.assistant}, das zentrale Gedächtnis` : who.dept.lead.title
    const prompt =
      `[Agenten-Büro] Du antwortest im Agenten-Büro als ${role} von ${COMPANY.name}. ` +
      `Antworte auf Deutsch, in höchstens drei kurzen Sätzen, nur aus diesem Stand, ohne Werkzeuge und ohne Panels.\n\n` +
      `${context(who)}\n\nFrage: ${question}`
    try {
      await bridgeAsk(prompt, { onText, onTool: () => {} })
      return
    } catch {
      bridge = 'down'
    }
  }
  // Type the offline answer out, so it reads like the live one.
  const text = local(question, who)
  for (let i = 0; i < text.length; i += 3) {
    onText(text.slice(i, i + 3))
    await new Promise((r) => setTimeout(r, 12))
  }
}
