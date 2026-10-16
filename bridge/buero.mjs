/**
 * The agent office (public/buero.html), live.
 *
 * A second conversation on the same bridge, on its own socket path so it never
 * shares a session — or a persona — with the voice assistant. The page sends
 * the network it has on screen and the questions the graph leaves open; two
 * agents answer them:
 *
 *   Register-Prüfer   researches the open questions in public sources and
 *                     returns structured findings, every one with a URL.
 *   Berichtschreiber  turns graph and findings into the case file, streamed.
 *
 * Both are deliberately narrow. The researcher gets web search and page
 * fetches and nothing else — no MCP servers, no shell, no files — so a page
 * that talks to this socket can make it read the web and nothing more. The
 * writer gets no tools at all.
 */

import { query } from '@anthropic-ai/claude-agent-sdk'
import { homedir } from 'node:os'

const RESEARCH_TOOLS = ['WebSearch', 'WebFetch']

const CHECK_PROMPT = `Du bist der Register-Prüfer in einem Agenten-Büro für Firmenrecherchen.

Du bekommst ein Firmennetzwerk, das aus einer Grafik abgeschrieben wurde, und eine
Liste offener Prüfpunkte. Kläre sie mit öffentlich zugänglichen Quellen:
Handelsregister/Unternehmensregister, Bundesanzeiger, North Data und ähnliche
Registerauskünfte, Impressum der Firmenwebsites.

Regeln:
- Jede Aussage braucht eine Quelle (URL), die du tatsächlich geöffnet oder in den
  Suchergebnissen gesehen hast. Ohne Quelle: Status "offen".
- Nichts raten. Wenn eine Angabe nur wahrscheinlich ist, Status "teilweise" und
  sagen, was fehlt.
- Namensgleichheit ist kein Beweis. Ordne einen Treffer nur zu, wenn Firma,
  Sitz oder beteiligte Personen zusammenpassen; sonst darauf hinweisen.
- Nur geschäftliche Registerangaben. Keine Privatanschriften, keine Angaben zum
  Privatleben, keine Vermutungen über Personen.
- Wenn eine Quelle der Grafik widerspricht, trage das unter "corrections" ein.
- Arbeite zügig: höchstens etwa 15 Suchen oder Abrufe insgesamt.
- Antworte auf Deutsch.`

const WRITER_PROMPT = `Du bist der Berichtschreiber in einem Agenten-Büro für Firmenrecherchen.

Schreibe aus den Netzwerkdaten und den Prüfergebnissen eine Akte in Markdown, auf
Deutsch. Gib nur das Dokument aus, ohne Vorrede.

Aufbau:
# Akte: <Titel>
Eine Zeile Stand/Quellenlage.
## Kurzfazit — höchstens drei Sätze.
## Gesellschaften — Tabelle: Gesellschaft | Rechtsform / Register | Verbindung zur Hauptperson | Beleg
## Beteiligungsstruktur — Liste der Ketten, nur entlang der Verbindungen
"hält Beteiligung an". Eine direkte Verbindung einer Person ist keine Beteiligung
und gehört nicht in eine Kette.
## Prüfergebnisse — je Prüfpunkt: Status (belegt / teilweise / offen), Ergebnis, Quelle als Link.
## Offene Punkte — was noch zu klären ist und wo.

Regeln: Trenne sichtbar zwischen "laut Grafik", "laut Quelle" (mit Link) und
"offen". Erfinde nichts, was weder in der Grafik noch in den Prüfergebnissen
steht. Keine Privatangaben zu Personen.`

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'integer', description: 'Nummer des Prüfpunkts, ab 1' },
          status: { type: 'string', enum: ['belegt', 'teilweise', 'offen'] },
          answer: { type: 'string', description: 'Ergebnis in ein bis drei Sätzen' },
          sources: { type: 'array', items: { type: 'string' } },
        },
        required: ['question', 'status', 'answer', 'sources'],
      },
    },
    corrections: {
      type: 'array',
      items: { type: 'string' },
      description: 'Stellen, an denen Quellen der Grafik widersprechen',
    },
  },
  required: ['findings', 'corrections'],
}

/** What the page may send. Small on purpose: this text goes into a prompt. */
const clip = (s, n = 200) => String(s ?? '').slice(0, n)

function readCase(input) {
  const nodes = Array.isArray(input?.nodes) ? input.nodes.slice(0, 60) : []
  const edges = Array.isArray(input?.edges) ? input.edges.slice(0, 200) : []
  const questions = Array.isArray(input?.questions)
    ? input.questions.slice(0, 12).map((q) => clip(q, 400))
    : []
  if (!nodes.length || !questions.length) return null
  return {
    title: clip(input.title, 120) || 'Firmennetzwerk',
    nodes: nodes.map((n) => ({
      name: clip(n.name),
      type: n.type === 'person' ? 'Person' : 'Gesellschaft',
      status: clip(n.status, 40) || undefined,
    })),
    edges: edges.map((e) => ({ from: clip(e.from), to: clip(e.to), kind: clip(e.kind, 60) })),
    questions,
  }
}

const describeCase = (c) =>
  `Netzwerk „${c.title}“ (aus einer Grafik abgeschrieben, unverifiziert):\n\n` +
  `Knoten:\n${c.nodes.map((n) => `- ${n.name} (${n.type}${n.status ? ', ' + n.status : ''})`).join('\n')}\n\n` +
  `Verbindungen:\n${c.edges.map((e) => `- ${e.from} — ${e.kind} — ${e.to}`).join('\n')}\n`

/** One line for the page's log, out of a tool call's input. */
function toolLine(name, input) {
  if (name === 'WebSearch') return { label: 'Websuche', detail: clip(input?.query, 160) }
  if (name === 'WebFetch') {
    let host = clip(input?.url, 160)
    try {
      host = new URL(input.url).host + new URL(input.url).pathname.slice(0, 60)
    } catch {}
    return { label: 'Abruf', detail: host }
  }
  return { label: name, detail: '' }
}

/**
 * Runs one agent to completion and returns its result. Tool calls and text are
 * forwarded as they happen so the page can show the agent working.
 */
async function runAgent({ agent, system, prompt, tools, schema, send, abort, model, effort }) {
  const seen = new Set()
  const session = query({
    prompt,
    options: {
      systemPrompt: system,
      cwd: homedir(),
      // Same reasoning as the voice session: no settings files, so no
      // allow-rules from the user's CLI config can get past canUseTool, and no
      // MCP servers either — this socket only ever reads the web.
      settingSources: [],
      mcpServers: {},
      // Only these tools exist for the agent at all. Not repeated in
      // allowedTools: a bare name there auto-approves the tool and canUseTool
      // below would never be asked.
      tools,
      model,
      effort,
      maxTurns: 40,
      permissionMode: 'default',
      includePartialMessages: true,
      abortController: abort,
      ...(schema ? { outputFormat: { type: 'json_schema', schema } } : {}),
      canUseTool: async (name) =>
        tools.includes(name)
          ? { behavior: 'allow' }
          : { behavior: 'deny', message: 'Im Agenten-Büro sind nur Websuche und Seitenabruf erlaubt.' },
    },
  })

  for await (const msg of session) {
    if (msg.type === 'stream_event') {
      const ev = msg.event
      if (ev?.type === 'content_block_delta' && ev.delta?.type === 'text_delta' && ev.delta.text) {
        send({ type: 'text', agent, delta: ev.delta.text })
      }
    } else if (msg.type === 'assistant') {
      for (const block of msg.message?.content ?? []) {
        if (block.type !== 'tool_use' || seen.has(block.id)) continue
        seen.add(block.id)
        // The structured answer arrives as a tool call of its own; it is the
        // result, not work worth a log line.
        if (!tools.includes(block.name)) continue
        send({ type: 'tool', agent, ...toolLine(block.name, block.input) })
      }
    } else if (msg.type === 'result') {
      if (msg.subtype !== 'success') {
        throw new Error(`${agent}: ${msg.subtype}`)
      }
      return { text: msg.result ?? '', data: msg.structured_output, costUsd: msg.total_cost_usd ?? 0 }
    }
  }
  throw new Error(`${agent}: ended without a result`)
}

export function handleBuero(socket, { model, effort }) {
  console.log('[buero] client connected')
  let abort = null

  const send = (msg) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(msg))
  }
  send({ type: 'ready', model })

  socket.on('message', async (raw) => {
    let msg
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (msg.type === 'stop') {
      abort?.abort()
      return
    }
    if (msg.type !== 'start' || abort) return

    const c = readCase(msg.case)
    if (!c) return send({ type: 'error', message: 'Keine Netzwerkdaten oder Prüfpunkte erhalten.' })

    abort = new AbortController()
    const common = { send, abort, model, effort }
    let cost = 0
    try {
      send({ type: 'phase', agent: 'check' })
      const check = await runAgent({
        ...common,
        agent: 'check',
        system: CHECK_PROMPT,
        tools: RESEARCH_TOOLS,
        schema: FINDINGS_SCHEMA,
        prompt:
          describeCase(c) +
          `\nOffene Prüfpunkte:\n${c.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n` +
          'Kläre jeden Prüfpunkt und gib das Ergebnis im vorgegebenen Format zurück.',
      })
      cost += check.costUsd
      const findings = check.data ?? { findings: [], corrections: [] }
      send({ type: 'findings', agent: 'check', data: findings })

      send({ type: 'phase', agent: 'writer' })
      const writer = await runAgent({
        ...common,
        agent: 'writer',
        system: WRITER_PROMPT,
        tools: [],
        prompt:
          describeCase(c) +
          `\nPrüfpunkte:\n${c.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n` +
          `Prüfergebnisse (JSON):\n${JSON.stringify(findings, null, 2)}\n\n` +
          `Heutiges Datum: ${new Date().toLocaleDateString('de-DE')}. Schreibe jetzt die Akte.`,
      })
      cost += writer.costUsd
      send({ type: 'done', report: writer.text, costUsd: cost })
    } catch (err) {
      const stopped = abort?.signal.aborted
      console.error('[buero] run failed:', err?.message ?? err)
      send({ type: 'error', message: stopped ? 'Lauf abgebrochen.' : String(err?.message ?? err) })
    } finally {
      abort = null
    }
  })

  socket.on('close', () => {
    console.log('[buero] client disconnected')
    abort?.abort()
  })
}
