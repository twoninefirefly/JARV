/**
 * Everything the Agenten-Büro shows, in one place.
 *
 * This is the file to change per customer: company name, departments, who
 * sits in them and what they do. The numbers are demo figures generated from
 * a fixed seed, so the same page looks the same on every reload and in every
 * pitch — only the hour of day moves, which is what makes it feel live.
 *
 * `?firma=Müller%20GmbH` in the URL swaps the company name without a rebuild,
 * so a personalised demo is a link, not a deploy. `?branche=hausverwaltung`
 * swaps the whole office for the property-management one (hausverwaltung.ts).
 */

import { BRANCHE } from './branche'
import { HV_KUNDE, KUNDE as CHOSEN } from './kunden'
import { HV_BRAIN, hvDepartments } from './hausverwaltung'

export type IconName = 'chat' | 'megaphone' | 'box' | 'clapper' | 'handshake' | 'euro' | 'brain' | 'key' | 'wrench' | 'building' | 'meter'

export type AgentStatus = 'arbeitet' | 'bereit' | 'wartet'

export type Agent = {
  id: string
  name: string
  role: string
  status: AgentStatus
  /** What the agent is doing right now, or last did. */
  doing: string
  lead?: boolean
}

export type Department = {
  id: string
  name: string
  short: string
  tagline: string
  icon: IconName
  color: string
  /** Position around the brain, in radians. */
  angle: number
  lead: { title: string; about: string }
  agents: Agent[]
  kpis: [{ value: number; label: string }, { value: number; label: string }]
  /** Runs per hour, 24 entries. Past hours are done, the rest are planned. */
  runs: number[]
  /** Things only a human can decide. */
  waiting: string[]
  /** Recurring jobs, used for the protocol and "what's next". */
  jobs: string[]
  /** Documents this department contributes to the brain. */
  docs: number
}

const params = new URLSearchParams(location.search)
const KUNDE = CHOSEN ?? (BRANCHE === 'hausverwaltung' ? HV_KUNDE : null)

export const COMPANY = {
  name: params.get('firma')?.slice(0, 40) || KUNDE?.name || (BRANCHE === 'hausverwaltung' ? 'Beispiel Hausverwaltung' : 'Beispielfirma'),
  demo: !params.has('live'),
  assistant: 'Jarvis',
  /**
   * Opens the lock screen. This only keeps a demo from being browsed by
   * accident — the page ships with it. Real customer data needs a server-side
   * login in front of it, never a password in the page.
   */
  password: 'demo',
  /** Optional logo for the lock screen (an image URL or data: URI); the mark is used without one. */
  logo: KUNDE?.logo ?? '',
  /** Minutes without a touch before the office locks itself. */
  autoLockMinutes: 5,
}

/** Small deterministic PRNG so the demo figures never change between loads. */
export function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

/** A working-hours curve: quiet at night, a morning peak, a softer afternoon. */
function day(seed: number, scale: number): number[] {
  const r = rng(seed)
  return Array.from({ length: 24 }, (_, h) => {
    const morning = Math.exp(-((h - 9.5) ** 2) / 6)
    const afternoon = 0.7 * Math.exp(-((h - 15) ** 2) / 8)
    const base = h >= 6 && h <= 21 ? 0.25 : 0.08
    return Math.max(1, Math.round((base + morning + afternoon) * scale * (0.75 + r() * 0.5)))
  })
}

function team(prefix: string, members: Array<[string, string, AgentStatus, string, boolean?]>): Agent[] {
  return members.map(([name, role, status, doing, lead], i) => ({
    id: `${prefix}-${i}`,
    name,
    role,
    status,
    doing,
    lead,
  }))
}

const step = (Math.PI * 2) / 6

const STANDARD: Department[] = [
  {
    id: 'kommunikation',
    name: 'Kommunikation',
    short: 'Kommunikation',
    tagline: 'Mails, Chats, Anrufe',
    icon: 'chat',
    color: '#8ea5bd',
    angle: 0,
    lead: {
      title: 'Kommunikations-Lead',
      about:
        'Sortiert jeden Eingang. 6 Agenten berichten an ihn: Posteingang, Chat, Telefon, Terminierung, Antwortentwürfe und Eskalation. Nichts bleibt länger als 30 Minuten unbeantwortet.',
    },
    agents: team('kom', [
      ['Kommunikations-Lead', 'Lead', 'arbeitet', 'verteilt 12 neue Mails', true],
      ['Posteingang', 'Mails', 'arbeitet', 'sortiert Posteingang info@'],
      ['Chat', 'Website-Chat', 'bereit', 'wartet auf neue Chats'],
      ['Telefon', 'Anrufe', 'arbeitet', 'fasst Anruf von 10:04 zusammen'],
      ['Terminierung', 'Kalender', 'arbeitet', 'bestätigt 3 Termine'],
      ['Antwort-Entwurf', 'Texte', 'wartet', 'Entwurf an Kunde wartet auf Freigabe'],
      ['Eskalation', 'Prioritäten', 'bereit', 'nichts Dringendes offen'],
    ]),
    kpis: [
      { value: 312, label: 'Mails heute' },
      { value: 18, label: 'Anrufe heute' },
    ],
    runs: day(11, 22),
    waiting: ['Antwort an Kunde Weber freigeben'],
    jobs: ['Mails und Termine einlesen', 'Chats beantwortet', 'Anruf protokolliert', 'Termin bestätigt'],
    docs: 1210,
  },
  {
    id: 'technik',
    name: 'Fulfillment & Technik',
    short: 'Technik',
    tagline: 'Projekte und Betrieb',
    icon: 'box',
    color: '#a88760',
    angle: step * 1,
    lead: {
      title: 'Technik-Lead',
      about:
        'Hält Projekte und Systeme am Laufen. 6 Agenten berichten an ihn: Projektplan, Monitoring, Support-Tickets, Deployments, Backups und Dokumentation.',
    },
    agents: team('tec', [
      ['Technik-Lead', 'Lead', 'arbeitet', 'plant Sprint für KW 39', true],
      ['Projektplan', 'Projekte', 'arbeitet', 'aktualisiert 4 Meilensteine'],
      ['Monitoring', 'Betrieb', 'bereit', 'alle Systeme grün'],
      ['Tickets', 'Support', 'arbeitet', 'löst Ticket #2291'],
      ['Deployment', 'Releases', 'bereit', 'nächstes Release 14:00'],
      ['Backup', 'Sicherung', 'bereit', 'letztes Backup 06:00 ok'],
      ['Doku', 'Wissen', 'arbeitet', 'schreibt Übergabe-Doku'],
    ]),
    kpis: [
      { value: 7, label: 'Projekte aktiv' },
      { value: 23, label: 'Tickets gelöst' },
    ],
    runs: day(23, 12),
    waiting: ['Release 2.4 freigeben'],
    jobs: ['Tickets abgearbeitet', 'Systeme geprüft', 'Projektstand aktualisiert', 'Backup geprüft'],
    docs: 640,
  },
  {
    id: 'vertrieb',
    name: 'Vertrieb',
    short: 'Vertrieb',
    tagline: 'Leads und Abschlüsse',
    icon: 'handshake',
    color: '#8fa35e',
    angle: step * 2,
    lead: {
      title: 'Vertriebs-Lead',
      about:
        'Führt den Vertrieb. 5 Agenten berichten an ihn: Lead-Wache, Call-Briefing, Nach-Call, Pipeline und Angebote. Hält die Pipeline aktuell, meldet jeden neuen Lead und bereitet jedes Gespräch vor.',
    },
    agents: team('ver', [
      ['Vertriebs-Lead', 'Lead', 'arbeitet', 'priorisiert 6 Leads', true],
      ['Lead-Wache', 'Neue Leads', 'arbeitet', 'prüft 2 Anfragen vom Formular'],
      ['Call-Briefing', 'Vorbereitung', 'arbeitet', 'Briefing für 11:30 fertig'],
      ['Nach-Call', 'Nachbereitung', 'wartet', 'Follow-up an Schmidt wartet'],
      ['Pipeline', 'CRM', 'bereit', 'Pipeline aktuell'],
      ['Angebote', 'Angebote', 'wartet', 'Angebot #118 wartet auf Freigabe'],
    ]),
    kpis: [
      { value: 42, label: 'Termine 30 T' },
      { value: 11, label: 'Abschlüsse 30 T' },
    ],
    runs: day(37, 16),
    waiting: ['Angebot #118 an Kanzlei Brandt freigeben', 'Follow-up an Schmidt & Co. freigeben'],
    jobs: ['Neue Leads geprüft', 'Call-Briefing geschrieben', 'Pipeline aktualisiert', 'Follow-up entworfen'],
    docs: 520,
  },
  {
    id: 'finanzen',
    name: 'Finanzen & Verwaltung',
    short: 'Finanzen',
    tagline: 'Rechnungen und Zahlen',
    icon: 'euro',
    color: '#d6c69c',
    angle: step * 3,
    lead: {
      title: 'Finanz-Lead',
      about:
        'Hat jede Zahl im Blick. 5 Agenten berichten an ihn: Rechnungen, Mahnwesen, Belege, Liquidität und Reporting. Jeden Morgen liegt der Kassenstand bereit.',
    },
    agents: team('fin', [
      ['Finanz-Lead', 'Lead', 'arbeitet', 'prüft Monatsabschluss', true],
      ['Rechnungen', 'Ausgang', 'arbeitet', 'stellt 4 Rechnungen'],
      ['Mahnwesen', 'Forderungen', 'bereit', '2 Zahlungen eingegangen'],
      ['Belege', 'Eingang', 'arbeitet', 'ordnet 17 Belege zu'],
      ['Liquidität', 'Cashflow', 'bereit', 'Prognose aktuell'],
      ['Reporting', 'Zahlen', 'wartet', 'Monatsbericht wartet auf Durchsicht'],
    ]),
    kpis: [
      { value: 48, label: 'Rechnungen Monat' },
      { value: 96, label: '% bezahlt' },
    ],
    runs: day(41, 8),
    waiting: ['Monatsbericht August durchsehen'],
    jobs: ['Belege zugeordnet', 'Zahlungseingänge abgeglichen', 'Rechnungen gestellt', 'Kennzahlen eingesammelt'],
    docs: 410,
  },
  {
    id: 'content',
    name: 'Content',
    short: 'Content',
    tagline: 'Inhalte und Kanäle',
    icon: 'clapper',
    color: '#d7b15d',
    angle: step * 4,
    lead: {
      title: 'Content-Lead',
      about:
        'Plant und produziert alle Inhalte. 6 Agenten berichten an ihn: Redaktionsplan, Texte, Video-Schnitt, Grafik, Veröffentlichung und Auswertung jedes Beitrags.',
    },
    agents: team('con', [
      ['Content-Lead', 'Lead', 'arbeitet', 'plant Woche 40', true],
      ['Redaktion', 'Plan', 'bereit', 'Plan bis Freitag steht'],
      ['Texte', 'Copy', 'arbeitet', 'schreibt 3 Captions'],
      ['Video', 'Schnitt', 'arbeitet', 'schneidet Reel „Einblick“'],
      ['Grafik', 'Design', 'arbeitet', 'baut Karussell 1/6'],
      ['Veröffentlichung', 'Kanäle', 'wartet', 'Reel wartet auf Freigabe'],
      ['Auswertung', 'Zahlen', 'bereit', 'Zahlen jedes Beitrags aktuell'],
    ]),
    kpis: [
      { value: 26, label: 'Beiträge 30 T' },
      { value: 184, label: 'Tsd. Aufrufe 30 T' },
    ],
    runs: day(53, 10),
    waiting: ['Reel „Einblick ins Büro“ freigeben'],
    jobs: ['Zahlen jedes Beitrags eingetragen', 'Beitrag geplant', 'Captions geschrieben', 'Video geschnitten'],
    docs: 380,
  },
  {
    id: 'marketing',
    name: 'Marketing',
    short: 'Marketing',
    tagline: 'Reichweite und Kampagnen',
    icon: 'megaphone',
    color: '#c7704e',
    angle: step * 5,
    lead: {
      title: 'Marketing-Lead',
      about:
        'Sorgt für Reichweite. 6 Agenten berichten an ihn: Kampagnen, Anzeigen, SEO, Newsletter, Wettbewerb und Budget. Jede Kampagne hat ein Ziel und eine Zahl.',
    },
    agents: team('mar', [
      ['Marketing-Lead', 'Lead', 'arbeitet', 'prüft Kampagnen-Ziele', true],
      ['Kampagnen', 'Planung', 'arbeitet', 'plant Herbst-Kampagne'],
      ['Anzeigen', 'Ads', 'arbeitet', 'optimiert 3 Anzeigengruppen'],
      ['SEO', 'Suche', 'bereit', '12 Rankings verbessert'],
      ['Newsletter', 'E-Mail', 'wartet', 'Newsletter wartet auf Freigabe'],
      ['Wettbewerb', 'Markt', 'bereit', 'Wochenbericht fertig'],
      ['Budget', 'Kosten', 'bereit', 'im Plan: 64 % verbraucht'],
    ]),
    kpis: [
      { value: 4, label: 'Kampagnen aktiv' },
      { value: 3.1, label: 'ROAS 30 T' },
    ],
    runs: day(67, 9),
    waiting: ['Newsletter Oktober freigeben'],
    jobs: ['Anzeigen optimiert', 'Rankings geprüft', 'Wettbewerb beobachtet', 'Budget abgeglichen'],
    docs: 680,
  },
]

export const DEPARTMENTS: Department[] = BRANCHE === 'hausverwaltung' ? hvDepartments(day, team) : STANDARD

export const AGENT_COUNT = DEPARTMENTS.reduce((n, d) => n + d.agents.length, 0)

const HV = BRANCHE === 'hausverwaltung'

export const BRAIN = HV
  ? {
      about: HV_BRAIN.about,
      jarvis: HV_BRAIN.jarvis,
      stats: [{ value: DEPARTMENTS.reduce((n, d) => n + d.docs, 0), label: 'Dokumente' }, ...HV_BRAIN.stats],
      runs: Array.from({ length: 24 }, (_, h) => (h === 7 || h === 8 ? 3 : h === 10 || h === 13 || h === 16 ? 3 : 2)),
    }
  : {
  about:
    'Hier sprechen die Agenten miteinander. Jede Nachricht läuft durchs Gehirn: Es legt sie ab, erkennt, wer sie braucht, und stellt sie dem richtigen Kollegen in der anderen Abteilung zu. Mails und Termine kommen alle 30 Minuten dazu, Wissen jeden Morgen.',
  jarvis:
    'Ein Gedächtnis für das ganze Haus. Wer im Vertrieb fragt, bekommt den Stand aus Mails, Calls und CRM. Wer im Content fragt, die Zahlen jedes Beitrags.',
  stats: [
    { value: DEPARTMENTS.reduce((n, d) => n + d.docs, 0), label: 'Dokumente' },
    { value: 612, label: 'Kontakte' },
    { value: 240, label: 'Protokolle' },
    { value: 18400, label: 'Mails' },
    { value: 2310, label: 'Termine' },
    { value: 9870, label: 'Chats' },
  ],
  /** Ingest runs per hour — the half-hourly sync shows as a steady floor. */
  runs: Array.from({ length: 24 }, (_, h) => (h === 7 || h === 8 ? 3 : h === 10 || h === 13 || h === 16 ? 3 : 2)),
}

/** The brain's own schedule, newest first, up to the current time. */
export function brainProtocol(now = new Date()): Array<{ time: string; text: string; done: boolean }> {
  const out: Array<{ time: string; text: string; done: boolean }> = []
  const minutes = now.getHours() * 60 + now.getMinutes()
  for (let m = 7 * 60; m <= minutes + 30 && m < 24 * 60; m += 30) {
    const t = m + 16
    const time = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
    const hour = Math.floor(m / 60)
    let text = 'Mails und Termine ins Gedächtnis'
    if (m === 7 * 60) text = 'Tagesplan geschrieben'
    else if (m === 7 * 60 + 30) text = 'Wissensbibliothek aufgefrischt'
    else if (m === 8 * 60) text = 'Alle Kennzahlen eingesammelt'
    else if (hour % 3 === 2 && m % 60 === 30) text = HV ? HV_BRAIN.syncText : 'Zahlen jedes Beitrags eingetragen'
    else if (hour % 3 === 1 && m % 60 === 0) text = `${COMPANY.assistant} liest sich neu ein`
    out.push({ time, text, done: t <= minutes })
  }
  return out.reverse()
}

/** A department's log, newest first, built from its recurring jobs. */
export function deptProtocol(d: Department, now = new Date()) {
  const r = rng(d.docs)
  const out: Array<{ time: string; text: string; done: boolean }> = []
  const minutes = now.getHours() * 60 + now.getMinutes()
  for (let m = 7 * 60 + Math.floor(r() * 20); m <= minutes + 60 && m < 24 * 60; m += 20 + Math.floor(r() * 40)) {
    const time = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
    out.push({ time, text: d.jobs[Math.floor(r() * d.jobs.length)], done: m <= minutes })
  }
  return out.reverse()
}

/** Done vs. planned for a 24-hour run curve, split at the current hour. */
export function split(runs: number[], now = new Date()) {
  const h = now.getHours()
  const done = runs.slice(0, h).reduce((a, b) => a + b, 0) + Math.round(runs[h] * (now.getMinutes() / 60))
  const total = runs.reduce((a, b) => a + b, 0)
  return { done, total, hour: h }
}

export const fmt = (n: number) => n.toLocaleString('de-DE')
