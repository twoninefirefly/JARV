import {
  BRAIN,
  COMPANY,
  DEPARTMENTS,
  brainProtocol,
  deptProtocol,
  rng,
  type Agent,
  type Department,
} from './data'

/**
 * The window behind every agent, figure and log line.
 *
 * Each agent works in one area — a mailbox, a pipeline, an invoice ledger —
 * and that area has a data source the customer connects during setup. Until
 * then every window shows placeholder records of the right shape, so the demo
 * already looks like the finished thing and the setup is only a matter of
 * pointing `SOURCES` at the customer's systems.
 */

export type WsKind =
  | 'lead'
  | 'inbox'
  | 'chat'
  | 'calls'
  | 'calendar'
  | 'drafts'
  | 'escalation'
  | 'projects'
  | 'monitoring'
  | 'tickets'
  | 'releases'
  | 'backups'
  | 'docs'
  | 'leads'
  | 'briefings'
  | 'followups'
  | 'pipeline'
  | 'offers'
  | 'invoices'
  | 'dunning'
  | 'receipts'
  | 'cashflow'
  | 'reports'
  | 'editorial'
  | 'copy'
  | 'video'
  | 'design'
  | 'publishing'
  | 'analytics'
  | 'campaigns'
  | 'ads'
  | 'seo'
  | 'newsletter'
  | 'competition'
  | 'budget'
  | 'library'
  | 'contacts'
  | 'protocols'
  | 'log'
  | 'approvals'

export type Layout = 'list' | 'board' | 'table' | 'calendar' | 'overview'

export type Tone = 'ok' | 'warn' | 'info' | 'muted' | 'bad'

export type WsItem = {
  id: string
  title: string
  sub?: string
  meta?: string
  badge?: { text: string; tone: Tone }
  body?: string
  fields?: Array<[string, string]>
  actions?: string[]
  /** Board column. */
  col?: string
  /** Table cells, in `columns` order. */
  cells?: string[]
  /** A decision that only a human can make; approving it clears it everywhere. */
  approval?: string
  /** Planned rather than done — used by the log's filter. */
  planned?: boolean
}

export type Source = {
  /** The kind of system, as a customer would name it. */
  system: string
  /** Typical products, to make the setup conversation concrete. */
  examples: string
  /** The account or address it would read, derived from the company name. */
  account: string
  /** What the agent does with it once connected. */
  does: string[]
}

/** Where a window opens: which area, for whom, and optionally which record. */
export type WsTarget = {
  kind: WsKind
  title: string
  sub: string
  color: string
  deptId?: string
  agentId?: string
  focus?: string
  filter?: 'done' | 'planned'
}

const domain = `${COMPANY.name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/^-|-$/g, '')}.de`

// ---------------------------------------------------------------------------
// Who works where
// ---------------------------------------------------------------------------

/** Agent name → work area. A lead always gets the department overview. */
const KIND_BY_NAME: Record<string, WsKind> = {
  Posteingang: 'inbox',
  Chat: 'chat',
  Telefon: 'calls',
  Terminierung: 'calendar',
  'Antwort-Entwurf': 'drafts',
  Eskalation: 'escalation',
  Projektplan: 'projects',
  Monitoring: 'monitoring',
  Tickets: 'tickets',
  Deployment: 'releases',
  Backup: 'backups',
  Doku: 'docs',
  'Lead-Wache': 'leads',
  'Call-Briefing': 'briefings',
  'Nach-Call': 'followups',
  Pipeline: 'pipeline',
  Angebote: 'offers',
  Rechnungen: 'invoices',
  Mahnwesen: 'dunning',
  Belege: 'receipts',
  Liquidität: 'cashflow',
  Reporting: 'reports',
  Redaktion: 'editorial',
  Texte: 'copy',
  Video: 'video',
  Grafik: 'design',
  Veröffentlichung: 'publishing',
  Auswertung: 'analytics',
  Kampagnen: 'campaigns',
  Anzeigen: 'ads',
  SEO: 'seo',
  Newsletter: 'newsletter',
  Wettbewerb: 'competition',
  Budget: 'budget',
}

export const kindOf = (a: Agent): WsKind => (a.lead ? 'lead' : (KIND_BY_NAME[a.name] ?? 'docs'))

/** Which agent owns each item in a department's `waiting` list, in order. */
const WAITING_OWNER: Record<string, string[]> = {
  kommunikation: ['Antwort-Entwurf'],
  technik: ['Deployment'],
  vertrieb: ['Angebote', 'Nach-Call'],
  finanzen: ['Reporting'],
  content: ['Veröffentlichung'],
  marketing: ['Newsletter'],
}

/** Which agent stands behind each of a department's two headline figures. */
const KPI_OWNER: Record<string, [string, string]> = {
  kommunikation: ['Posteingang', 'Telefon'],
  technik: ['Projektplan', 'Tickets'],
  vertrieb: ['Call-Briefing', 'Pipeline'],
  finanzen: ['Rechnungen', 'Mahnwesen'],
  content: ['Redaktion', 'Auswertung'],
  marketing: ['Kampagnen', 'Anzeigen'],
}

export function waitingOwner(d: Department, i: number): Agent {
  const name = WAITING_OWNER[d.id]?.[i]
  return d.agents.find((a) => a.name === name) ?? d.agents[0]
}

export function kpiOwner(d: Department, i: number): Agent {
  const name = KPI_OWNER[d.id]?.[i]
  return d.agents.find((a) => a.name === name) ?? d.agents[0]
}

// ---------------------------------------------------------------------------
// Targets
// ---------------------------------------------------------------------------

export function agentTarget(d: Department, a: Agent, focus?: string): WsTarget {
  return {
    kind: kindOf(a),
    title: a.name,
    sub: `${d.short} · ${a.role}`,
    color: d.color,
    deptId: d.id,
    agentId: a.id,
    focus,
  }
}

export function logTarget(d: Department | null, filter?: 'done' | 'planned', focus?: string): WsTarget {
  return {
    kind: 'log',
    title: 'Protokoll',
    sub: d ? `${d.short} · alle Läufe heute` : 'Gehirn · alle Synchronisierungen',
    color: d?.color ?? '#d98a62',
    deptId: d?.id,
    filter,
    focus,
  }
}

export function approvalsTarget(d: Department | null): WsTarget {
  return {
    kind: 'approvals',
    title: 'Freigaben',
    sub: d ? `${d.short} · wartet auf Sie` : 'Ganzes Büro · wartet auf Sie',
    color: d?.color ?? '#e8c170',
    deptId: d?.id,
  }
}

/** The brain's figures, each opening the store it counts. */
const BRAIN_KIND: Record<string, WsKind> = {
  Dokumente: 'library',
  Kontakte: 'contacts',
  Protokolle: 'protocols',
  Mails: 'inbox',
  Termine: 'calendar',
  Chats: 'chat',
}

export function brainTarget(label: string): WsTarget {
  return { kind: BRAIN_KIND[label] ?? 'library', title: label, sub: 'Gehirn · Gedächtnis', color: '#d98a62' }
}

// ---------------------------------------------------------------------------
// Data sources — the part that gets connected per customer
// ---------------------------------------------------------------------------

export const SOURCES: Record<WsKind, Source> = {
  lead: { system: 'Alle Quellen der Abteilung', examples: 'wird aus den Agenten zusammengeführt', account: domain, does: ['fasst den Stand der Abteilung zusammen', 'verteilt Aufgaben an das Team', 'meldet, was eine Entscheidung braucht'] },
  inbox: { system: 'E-Mail-Postfach', examples: 'Microsoft 365, Google Workspace, IMAP', account: `info@${domain}`, does: ['liest neue Mails alle 30 Minuten', 'sortiert nach Thema und Dringlichkeit', 'legt Antworten als Entwurf an'] },
  chat: { system: 'Chat-Kanäle', examples: 'Website-Chat, WhatsApp Business, Instagram DMs', account: `chat.${domain}`, does: ['beantwortet Standardfragen sofort', 'übergibt Anfragen an den Vertrieb', 'schreibt jeden Chat ins Gedächtnis'] },
  calls: { system: 'Telefonanlage', examples: 'sipgate, Placetel, 3CX', account: '+49 30 000000', does: ['protokolliert jeden Anruf', 'fasst das Gespräch zusammen', 'legt Rückrufe als Aufgabe an'] },
  calendar: { system: 'Kalender', examples: 'Outlook, Google Kalender, Calendly', account: `termine@${domain}`, does: ['bestätigt Termine', 'schlägt freie Zeiten vor', 'erinnert beide Seiten'] },
  drafts: { system: 'E-Mail-Entwürfe', examples: 'Postfach, Entwürfe-Ordner', account: `info@${domain}`, does: ['schreibt Antworten im Ton der Firma', 'legt sie zur Freigabe vor', 'versendet nach Freigabe'] },
  escalation: { system: 'Prioritäten-Regeln', examples: 'Posteingang, Chat, Telefon', account: domain, does: ['erkennt Beschwerden und Fristen', 'benachrichtigt die zuständige Person', 'hält nach, bis es erledigt ist'] },
  projects: { system: 'Projekt-Tool', examples: 'Asana, ClickUp, monday.com, Jira', account: `projekte.${domain}`, does: ['aktualisiert Meilensteine', 'meldet Verzug früh', 'schreibt den Wochenstand'] },
  monitoring: { system: 'Systemüberwachung', examples: 'UptimeRobot, Grafana, Server-Logs', account: domain, does: ['prüft alle Systeme alle 5 Minuten', 'meldet Ausfälle sofort', 'sammelt Ladezeiten'] },
  tickets: { system: 'Ticket-System', examples: 'Zendesk, Freshdesk, Jira Service', account: `support@${domain}`, does: ['ordnet Tickets zu', 'löst Standardfälle selbst', 'hält die Reaktionszeit ein'] },
  releases: { system: 'Code und Releases', examples: 'GitHub, GitLab, Vercel', account: `git.${domain}`, does: ['bereitet Releases vor', 'schreibt Änderungsnotizen', 'veröffentlicht nach Freigabe'] },
  backups: { system: 'Datensicherung', examples: 'Server, Cloud-Speicher, NAS', account: `backup.${domain}`, does: ['sichert täglich um 06:00', 'prüft jede Sicherung', 'meldet Fehler'] },
  docs: { system: 'Wissensbasis', examples: 'Notion, Confluence, SharePoint', account: `wiki.${domain}`, does: ['hält Anleitungen aktuell', 'schreibt Übergaben', 'beantwortet Fragen aus der Doku'] },
  leads: { system: 'Anfragen und CRM', examples: 'Website-Formular, HubSpot, Pipedrive', account: `vertrieb@${domain}`, does: ['prüft jede neue Anfrage', 'bewertet sie nach Passung', 'legt sie im CRM an'] },
  briefings: { system: 'Kalender und CRM', examples: 'Outlook, HubSpot, LinkedIn', account: `vertrieb@${domain}`, does: ['recherchiert vor jedem Termin', 'schreibt eine Seite Briefing', 'legt es in den Termin'] },
  followups: { system: 'Gesprächsnotizen und Postfach', examples: 'Call-Aufzeichnung, CRM, Postfach', account: `vertrieb@${domain}`, does: ['fasst jedes Gespräch zusammen', 'schreibt das Follow-up', 'legt nächste Schritte an'] },
  pipeline: { system: 'CRM-Pipeline', examples: 'HubSpot, Pipedrive, Salesforce', account: `crm.${domain}`, does: ['verschiebt Deals nach Stand', 'meldet stehende Deals', 'rechnet die Prognose'] },
  offers: { system: 'Angebote', examples: 'lexoffice, sevDesk, PandaDoc', account: `angebote@${domain}`, does: ['erstellt Angebote aus Vorlagen', 'legt sie zur Freigabe vor', 'fasst nach 5 Tagen nach'] },
  invoices: { system: 'Buchhaltung', examples: 'lexoffice, sevDesk, DATEV', account: `buchhaltung@${domain}`, does: ['stellt Rechnungen nach Leistung', 'versendet sie', 'gleicht Zahlungen ab'] },
  dunning: { system: 'Offene Posten', examples: 'Buchhaltung und Bankkonto', account: `buchhaltung@${domain}`, does: ['erkennt überfällige Rechnungen', 'schreibt Zahlungserinnerungen', 'meldet Ausfälle'] },
  receipts: { system: 'Belege', examples: 'DATEV Unternehmen online, GetMyInvoices', account: `belege@${domain}`, does: ['liest Belege aus Mails', 'ordnet sie Buchungen zu', 'meldet fehlende Belege'] },
  cashflow: { system: 'Bankkonten', examples: 'Geschäftskonto über FinAPI oder PSD2', account: 'DE00 0000 0000 0000 0000 00', does: ['liest den Kontostand täglich', 'rechnet die 90-Tage-Prognose', 'warnt bei Engpässen'] },
  reports: { system: 'Kennzahlen', examples: 'Buchhaltung, CRM, Tabellen', account: `reporting.${domain}`, does: ['schreibt den Monatsbericht', 'vergleicht mit dem Plan', 'legt ihn zur Durchsicht vor'] },
  editorial: { system: 'Redaktionsplan', examples: 'Notion, Trello, Google Sheets', account: `content.${domain}`, does: ['plant Themen pro Woche', 'verteilt Aufgaben', 'hält Termine'] },
  copy: { system: 'Textablage', examples: 'Google Docs, Notion', account: `content.${domain}`, does: ['schreibt Captions und Texte', 'hält die Markenstimme', 'legt Varianten vor'] },
  video: { system: 'Medienablage', examples: 'Google Drive, Dropbox, Frame.io', account: `medien.${domain}`, does: ['schneidet Rohmaterial', 'setzt Untertitel', 'exportiert pro Kanal'] },
  design: { system: 'Design-Tool', examples: 'Canva, Figma', account: `design.${domain}`, does: ['baut Grafiken aus Vorlagen', 'hält das Corporate Design', 'exportiert in allen Formaten'] },
  publishing: { system: 'Social-Media-Kanäle', examples: 'Instagram, LinkedIn, TikTok, Meta Business', account: `@${domain.replace('.de', '')}`, does: ['plant Beiträge ein', 'veröffentlicht nach Freigabe', 'beantwortet Kommentare'] },
  analytics: { system: 'Social-Media-Statistik', examples: 'Meta Insights, LinkedIn Analytics, TikTok', account: `@${domain.replace('.de', '')}`, does: ['trägt die Zahlen jedes Beitrags ein', 'erkennt, was funktioniert', 'schreibt den Wochenbericht'] },
  campaigns: { system: 'Kampagnenplanung', examples: 'Asana, Notion, Google Sheets', account: `marketing.${domain}`, does: ['plant Kampagnen mit Ziel und Budget', 'verteilt Aufgaben', 'misst das Ergebnis'] },
  ads: { system: 'Werbekonten', examples: 'Meta Ads, Google Ads, LinkedIn Ads', account: `ads.${domain}`, does: ['optimiert Gebote täglich', 'pausiert schwache Anzeigen', 'meldet Budgetverbrauch'] },
  seo: { system: 'Suchmaschinen', examples: 'Google Search Console, Sistrix', account: domain, does: ['beobachtet Rankings', 'schlägt Seitenverbesserungen vor', 'meldet technische Fehler'] },
  newsletter: { system: 'Newsletter-Tool', examples: 'Brevo, Mailchimp, CleverReach', account: `news@${domain}`, does: ['schreibt den Newsletter', 'legt ihn zur Freigabe vor', 'wertet Öffnungen aus'] },
  competition: { system: 'Marktbeobachtung', examples: 'Websites, Social Media, Presse', account: domain, does: ['beobachtet 8 Wettbewerber', 'meldet Preis- und Angebotsänderungen', 'schreibt den Wochenbericht'] },
  budget: { system: 'Budget und Kosten', examples: 'Werbekonten, Buchhaltung', account: `marketing.${domain}`, does: ['gleicht Ausgaben mit dem Plan ab', 'warnt bei Überschreitung', 'rechnet Kosten pro Lead'] },
  library: { system: 'Dokumentenablage', examples: 'SharePoint, Google Drive, Dropbox', account: `ablage.${domain}`, does: ['liest neue Dokumente jeden Morgen ein', 'macht sie durchsuchbar', 'verknüpft sie mit Kunden und Projekten'] },
  contacts: { system: 'Kontakte', examples: 'CRM, Outlook-Kontakte, Visitenkarten', account: `crm.${domain}`, does: ['führt Kontakte aus allen Quellen zusammen', 'entfernt Dubletten', 'ergänzt Firmendaten'] },
  protocols: { system: 'Gesprächsprotokolle', examples: 'Telefon, Teams, Zoom, Meet', account: domain, does: ['protokolliert jedes Gespräch', 'zieht Aufgaben heraus', 'legt sie beim Kunden ab'] },
  log: { system: 'Agenten-Protokoll', examples: 'intern', account: domain, does: ['zeichnet jeden Lauf auf', 'misst Dauer und Ergebnis', 'meldet Fehler'] },
  approvals: { system: 'Freigaben', examples: 'aus allen Abteilungen', account: domain, does: ['sammelt alles, was eine Entscheidung braucht', 'führt es nach Freigabe aus', 'hält nach, wenn es liegen bleibt'] },
}

// ---------------------------------------------------------------------------
// Layout of each area
// ---------------------------------------------------------------------------

export const LAYOUT: Record<WsKind, { layout: Layout; columns?: string[] }> = {
  lead: { layout: 'overview' },
  inbox: { layout: 'list' },
  chat: { layout: 'list' },
  calls: { layout: 'list' },
  calendar: { layout: 'calendar' },
  drafts: { layout: 'list' },
  escalation: { layout: 'list' },
  projects: { layout: 'board', columns: ['Geplant', 'In Arbeit', 'Abnahme', 'Fertig'] },
  monitoring: { layout: 'table', columns: ['System', 'Status', 'Antwortzeit', 'Verfügbarkeit 30 T'] },
  tickets: { layout: 'list' },
  releases: { layout: 'list' },
  backups: { layout: 'table', columns: ['Sicherung', 'Zeit', 'Größe', 'Status'] },
  docs: { layout: 'list' },
  leads: { layout: 'list' },
  briefings: { layout: 'calendar' },
  followups: { layout: 'list' },
  pipeline: { layout: 'board', columns: ['Neu', 'Erstgespräch', 'Angebot', 'Verhandlung', 'Gewonnen'] },
  offers: { layout: 'table', columns: ['Nr.', 'Kunde', 'Summe', 'Status'] },
  invoices: { layout: 'table', columns: ['Nr.', 'Kunde', 'Betrag', 'Fällig', 'Status'] },
  dunning: { layout: 'table', columns: ['Rechnung', 'Kunde', 'Betrag', 'Überfällig', 'Stufe'] },
  receipts: { layout: 'list' },
  cashflow: { layout: 'table', columns: ['Woche', 'Eingänge', 'Ausgänge', 'Stand'] },
  reports: { layout: 'list' },
  editorial: { layout: 'board', columns: ['Idee', 'In Arbeit', 'Freigabe', 'Geplant'] },
  copy: { layout: 'list' },
  video: { layout: 'list' },
  design: { layout: 'list' },
  publishing: { layout: 'calendar' },
  analytics: { layout: 'table', columns: ['Beitrag', 'Kanal', 'Aufrufe', 'Interaktion'] },
  campaigns: { layout: 'board', columns: ['Planung', 'Läuft', 'Auswertung'] },
  ads: { layout: 'table', columns: ['Anzeigengruppe', 'Kanal', 'Ausgaben', 'Leads', 'Kosten/Lead'] },
  seo: { layout: 'table', columns: ['Suchbegriff', 'Position', 'Änderung', 'Seite'] },
  newsletter: { layout: 'list' },
  competition: { layout: 'list' },
  budget: { layout: 'table', columns: ['Posten', 'Plan', 'Ist', 'Anteil'] },
  library: { layout: 'list' },
  contacts: { layout: 'table', columns: ['Name', 'Firma', 'Rolle', 'Letzter Kontakt'] },
  protocols: { layout: 'list' },
  log: { layout: 'list' },
  approvals: { layout: 'list' },
}

// ---------------------------------------------------------------------------
// Placeholder records
// ---------------------------------------------------------------------------

const PEOPLE = ['Anna Weber', 'Jonas Schmidt', 'Lea Fischer', 'Paul Wagner', 'Mia Becker', 'Felix Hoffmann', 'Laura Schulz', 'Tim Koch', 'Sophie Richter', 'Lukas Klein', 'Hannah Wolf', 'Noah Neumann']
const FIRMS = ['Kanzlei Brandt', 'Schmidt & Co.', 'Weber Immobilien', 'Bäckerei Lange', 'Autohaus Krüger', 'Praxis Dr. Vogel', 'Hotel Seeblick', 'Nordlicht Media', 'Elektro Hahn', 'Fitnesswerk Mitte']
const eur = (n: number) => `${n.toLocaleString('de-DE')} €`

function clock(minutesAgo: number, now = new Date()) {
  const d = new Date(now.getTime() - minutesAgo * 60_000)
  const same = d.toDateString() === now.toDateString()
  const t = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return same ? t : `${d.getDate()}.${d.getMonth() + 1}. ${t}`
}
function later(minutes: number, now = new Date()) {
  return clock(-minutes, now)
}

type Maker = (r: () => number, pick: <T>(xs: T[]) => T) => WsItem[]

const n = (count: number, f: (i: number) => WsItem) => Array.from({ length: count }, (_, i) => f(i))

const MAKERS: Partial<Record<WsKind, Maker>> = {
  inbox: (r, pick) => {
    const subjects = [
      ['Anfrage: Angebot für 20 Arbeitsplätze', 'Guten Tag, wir suchen eine Lösung für unser Büro und hätten gern ein Angebot bis Ende der Woche.', 'Vertrieb'],
      ['Rechnung 2026-0912 – Rückfrage', 'Hallo, auf der Rechnung fehlt unsere Bestellnummer. Können Sie die bitte ergänzen?', 'Finanzen'],
      ['Terminwunsch nächste Woche', 'Passt Ihnen Dienstag oder Mittwoch am Vormittag für ein kurzes Gespräch?', 'Kalender'],
      ['Beschwerde: Lieferung verspätet', 'Die Lieferung war für Montag zugesagt und ist bis heute nicht da. Bitte melden Sie sich.', 'Eskalation'],
      ['Bewerbung als Projektmanagerin', 'Anbei meine Unterlagen. Ich freue mich auf Ihre Rückmeldung.', 'Personal'],
      ['Newsletter-Abmeldung', 'Bitte nehmen Sie mich aus dem Verteiler.', 'Erledigt'],
      ['Kooperationsanfrage Podcast', 'Wir würden Sie gern als Gast in unserem Podcast begrüßen.', 'Marketing'],
      ['Zugangsdaten Kundenportal', 'Ich komme nicht mehr ins Portal, können Sie mir helfen?', 'Support'],
    ]
    return subjects.map(([title, body, tag], i) => ({
      id: `m${i}`,
      title,
      sub: `${pick(PEOPLE)} · ${pick(FIRMS)}`,
      meta: clock(12 + i * 37 + Math.floor(r() * 20)),
      badge: { text: tag, tone: tag === 'Eskalation' ? 'bad' : tag === 'Erledigt' ? 'muted' : 'info' },
      body,
      fields: [['Vorschlag des Agenten', tag === 'Erledigt' ? 'Abgemeldet und bestätigt.' : `An ${tag} weitergeleitet, Antwortentwurf liegt bereit.`]],
      actions: ['Antworten', 'Weiterleiten', 'Erledigt'],
    }))
  },
  chat: (r, pick) =>
    n(7, (i) => ({
      id: `c${i}`,
      title: pick(PEOPLE),
      sub: pick(['Was kostet das Paket für 5 Nutzer?', 'Haben Sie am Samstag geöffnet?', 'Kann ich meinen Termin verschieben?', 'Wie lange dauert die Einrichtung?', 'Gibt es eine Testphase?', 'Wo finde ich meine Rechnung?']),
      meta: clock(5 + i * 23 + Math.floor(r() * 10)),
      badge: i < 2 ? { text: 'An Vertrieb übergeben', tone: 'warn' } : { text: 'Beantwortet', tone: 'ok' },
      body: 'Der Agent hat mit den Informationen aus der Wissensbasis geantwortet und den Chat im Gedächtnis abgelegt.',
      fields: [['Kanal', pick(['Website-Chat', 'WhatsApp', 'Instagram'])], ['Antwortzeit', `${2 + Math.floor(r() * 30)} Sekunden`]],
      actions: ['Chat öffnen', 'Übernehmen'],
    })),
  calls: (r, pick) =>
    n(6, (i) => ({
      id: `t${i}`,
      title: `${pick(PEOPLE)} · ${pick(FIRMS)}`,
      sub: pick(['Rückfrage zum Angebot', 'Terminabsprache', 'Reklamation', 'Neuanfrage', 'Rückruf erbeten']),
      meta: clock(20 + i * 55 + Math.floor(r() * 20)),
      badge: i === 1 ? { text: 'Rückruf offen', tone: 'warn' } : { text: `${2 + Math.floor(r() * 9)} Min.`, tone: 'muted' },
      body: 'Zusammenfassung: Kunde möchte das Angebot um zwei Arbeitsplätze erweitern und bittet um eine neue Version bis Freitag.',
      fields: [['Nächster Schritt', 'Angebot anpassen (an Vertrieb übergeben)'], ['Aufzeichnung', 'Transkript liegt im Gedächtnis']],
      actions: ['Zurückrufen', 'Transkript öffnen'],
    })),
  calendar: (r, pick) =>
    n(7, (i) => ({
      id: `k${i}`,
      title: pick(['Erstgespräch', 'Angebotsbesprechung', 'Projekt-Kickoff', 'Jahresgespräch', 'Rückruf', 'Vor-Ort-Termin']),
      sub: `${pick(PEOPLE)} · ${pick(FIRMS)}`,
      meta: later(-120 + i * 75 + Math.floor(r() * 20)),
      badge: i < 2 ? { text: 'Vorbei', tone: 'muted' } : i === 3 ? { text: 'Unbestätigt', tone: 'warn' } : { text: 'Bestätigt', tone: 'ok' },
      body: 'Einladung verschickt, Erinnerung an beide Seiten 24 Stunden vorher.',
      fields: [['Ort', pick(['Teams', 'Google Meet', 'Telefon', 'Büro'])], ['Dauer', `${pick([30, 45, 60])} Minuten`]],
      actions: ['Verschieben', 'Absagen'],
    })),
  drafts: (_r, pick) =>
    n(5, (i) => ({
      id: `d${i}`,
      title: `Re: ${pick(['Ihre Anfrage', 'Terminvorschlag', 'Rechnung', 'Lieferstatus', 'Angebot'])}`,
      sub: `an ${pick(PEOPLE)}`,
      meta: clock(30 + i * 40),
      badge: { text: 'Entwurf', tone: 'info' },
      body: `Guten Tag,\n\nvielen Dank für Ihre Nachricht. Wir haben uns das angesehen und melden uns bis morgen mit einer verbindlichen Antwort.\n\nViele Grüße\n${COMPANY.name}`,
      actions: ['Freigeben', 'Ändern', 'Verwerfen'],
    })),
  escalation: () => [
    { id: 'e0', title: 'Beschwerde: Lieferung verspätet', sub: 'Posteingang · seit 2 Std.', badge: { text: 'Hoch', tone: 'bad' }, body: 'Kunde wartet seit Montag. Technik-Lead und Geschäftsführung informiert.', actions: ['Übernehmen', 'Erledigt'] },
    { id: 'e1', title: 'Frist: Angebot Kanzlei Brandt', sub: 'Vertrieb · Freitag 12:00', badge: { text: 'Mittel', tone: 'warn' }, body: 'Angebot liegt zur Freigabe vor.', actions: ['Zur Freigabe'] },
    { id: 'e2', title: 'Rückruf seit 24 Std. offen', sub: 'Telefon', badge: { text: 'Mittel', tone: 'warn' }, body: 'Rückruf an Hotel Seeblick noch nicht erfolgt.', actions: ['Zurückrufen'] },
  ],
  projects: (r, pick) =>
    n(10, (i) => ({
      id: `p${i}`,
      title: pick(['Website-Relaunch', 'CRM-Einführung', 'Umzug Server', 'Kundenportal', 'Schulung Team', 'Onboarding Neukunde', 'Datenschutz-Check']) + ` · ${pick(FIRMS)}`,
      col: ['Geplant', 'In Arbeit', 'Abnahme', 'Fertig'][i % 4],
      meta: `bis ${1 + Math.floor(r() * 28)}.10.`,
      badge: i === 5 ? { text: 'Verzug', tone: 'bad' } : undefined,
      body: 'Meilensteine, Verantwortliche und Stand werden aus dem Projekt-Tool gelesen.',
      fields: [['Fortschritt', `${Math.floor(r() * 100)} %`], ['Verantwortlich', pick(PEOPLE)]],
      actions: ['Projekt öffnen'],
    })),
  monitoring: (r) =>
    ['Website', 'Kundenportal', 'Mailserver', 'CRM', 'Telefonanlage', 'Backup-Server'].map((s, i) => ({
      id: `s${i}`,
      title: s,
      cells: [s, i === 4 ? 'Langsam' : 'Online', `${80 + Math.floor(r() * 300)} ms`, `${(99.5 + r() * 0.49).toFixed(2)} %`],
      badge: i === 4 ? { text: 'Langsam', tone: 'warn' } : { text: 'Online', tone: 'ok' },
      actions: ['Verlauf'],
    })),
  tickets: (r, pick) =>
    n(8, (i) => ({
      id: `tk${i}`,
      title: `#${2291 - i} ${pick(['Login funktioniert nicht', 'Export fehlerhaft', 'Rechnung doppelt', 'Drucker offline', 'Passwort zurücksetzen', 'Neue Nutzerin anlegen'])}`,
      sub: `${pick(PEOPLE)} · ${pick(FIRMS)}`,
      meta: clock(15 + i * 50 + Math.floor(r() * 20)),
      badge: i < 2 ? { text: 'In Arbeit', tone: 'info' } : i === 2 ? { text: 'Wartet auf Kunde', tone: 'warn' } : { text: 'Gelöst', tone: 'ok' },
      body: 'Der Agent hat das Problem nachgestellt und die Lösung aus der Wissensbasis angewendet.',
      actions: ['Antworten', 'Schließen'],
    })),
  releases: () => [
    { id: 'r0', title: 'Release 2.4', sub: 'Kundenportal · 12 Änderungen', meta: 'heute 14:00', badge: { text: 'Bereit', tone: 'info' }, body: 'Neu: Rechnungen als PDF, schnellere Suche, 3 Fehler behoben. Tests grün.', actions: ['Freigeben', 'Änderungen ansehen'] },
    { id: 'r1', title: 'Release 2.3.2', sub: 'Kundenportal · Fehlerbehebung', meta: '18.9.', badge: { text: 'Live', tone: 'ok' }, body: 'Behebt den Fehler beim Export.', actions: ['Änderungen ansehen'] },
    { id: 'r2', title: 'Website 5.1', sub: 'Neue Leistungsseite', meta: '12.9.', badge: { text: 'Live', tone: 'ok' }, body: 'Neue Seite „Leistungen“ mit Kontaktformular.', actions: ['Änderungen ansehen'] },
  ],
  backups: (r) =>
    ['Datenbank', 'Dateiablage', 'Mailarchiv', 'Website', 'CRM-Export'].map((s, i) => ({
      id: `b${i}`,
      title: s,
      cells: [s, 'heute 06:00', `${(1 + r() * 40).toFixed(1)} GB`, 'Geprüft'],
      badge: { text: 'Geprüft', tone: 'ok' },
      actions: ['Wiederherstellen'],
    })),
  docs: (r, pick) =>
    n(7, (i) => ({
      id: `w${i}`,
      title: pick(['Übergabe Projekt Portal', 'Anleitung: Neuer Mitarbeiter', 'Preisliste 2026', 'Prozess: Reklamation', 'FAQ Kundenportal', 'Checkliste Onboarding', 'Datenschutz-Hinweise']),
      sub: `zuletzt geändert von ${pick(['Doku-Agent', ...PEOPLE])}`,
      meta: clock(60 + i * 180 + Math.floor(r() * 60)),
      body: 'Dokument aus der Wissensbasis. Der Agent hält es aktuell und nutzt es für Antworten.',
      actions: ['Öffnen', 'Verlauf'],
    })),
  leads: (r, pick) =>
    n(7, (i) => ({
      id: `l${i}`,
      title: pick(FIRMS),
      sub: `${pick(PEOPLE)} · ${pick(['Website-Formular', 'Empfehlung', 'LinkedIn', 'Telefon', 'Messe'])}`,
      meta: clock(25 + i * 90 + Math.floor(r() * 30)),
      badge: i < 2 ? { text: 'Neu', tone: 'info' } : { text: `Passung ${60 + Math.floor(r() * 40)} %`, tone: 'ok' },
      body: 'Anfrage geprüft: Branche, Größe und Budget passen. Im CRM angelegt, Erstgespräch vorgeschlagen.',
      fields: [['Budget', eur(2000 + Math.floor(r() * 30) * 500)], ['Bedarf', pick(['Komplettpaket', 'Beratung', 'Wartung', 'Einrichtung'])]],
      actions: ['Termin vorschlagen', 'Ablehnen'],
    })),
  briefings: (_r, pick) =>
    n(5, (i) => ({
      id: `br${i}`,
      title: `Briefing: ${pick(FIRMS)}`,
      sub: `mit ${pick(PEOPLE)}`,
      meta: later(30 + i * 90),
      badge: { text: 'Fertig', tone: 'ok' },
      body: 'Firma, Ansprechpartner, bisherige Kontakte, offene Fragen und ein Vorschlag für den Gesprächsverlauf — auf einer Seite.',
      actions: ['Briefing öffnen'],
    })),
  followups: (_r, pick) =>
    n(5, (i) => ({
      id: `f${i}`,
      title: `Follow-up: ${pick(FIRMS)}`,
      sub: `nach Gespräch mit ${pick(PEOPLE)}`,
      meta: clock(40 + i * 120),
      badge: { text: 'Gesendet', tone: 'ok' },
      body: 'Danke für das Gespräch. Wie besprochen schicken wir Ihnen bis Donnerstag das angepasste Angebot.',
      actions: ['Ansehen'],
    })),
  pipeline: (r, pick) =>
    n(12, (i) => ({
      id: `pl${i}`,
      title: FIRMS[i % FIRMS.length],
      col: ['Neu', 'Erstgespräch', 'Angebot', 'Verhandlung', 'Gewonnen'][i % 5],
      meta: eur(1500 + Math.floor(r() * 40) * 500),
      sub: pick(PEOPLE),
      badge: i === 7 ? { text: '14 Tage still', tone: 'warn' } : undefined,
      body: 'Deal aus dem CRM. Der Agent aktualisiert Stufe, Wert und nächsten Schritt nach jedem Kontakt.',
      actions: ['Deal öffnen', 'Nächster Schritt'],
    })),
  offers: (r) =>
    n(6, (i) => ({
      id: `o${i}`,
      title: `Angebot #${118 - i}`,
      cells: [`#${118 - i}`, FIRMS[i], eur(3000 + Math.floor(r() * 30) * 500), i === 0 ? 'Freigabe' : i < 3 ? 'Versendet' : 'Angenommen'],
      badge: i === 0 ? { text: 'Freigabe', tone: 'warn' } : i < 3 ? { text: 'Versendet', tone: 'info' } : { text: 'Angenommen', tone: 'ok' },
      actions: ['PDF ansehen', 'Nachfassen'],
    })),
  invoices: (r) =>
    n(8, (i) => ({
      id: `i${i}`,
      title: `Rechnung 2026-${912 - i}`,
      cells: [`2026-${912 - i}`, FIRMS[(i + 3) % FIRMS.length], eur(400 + Math.floor(r() * 60) * 100), `${1 + ((i * 3) % 28)}.10.`, i < 2 ? 'Entwurf' : i < 6 ? 'Offen' : 'Bezahlt'],
      badge: i < 2 ? { text: 'Entwurf', tone: 'info' } : i < 6 ? { text: 'Offen', tone: 'warn' } : { text: 'Bezahlt', tone: 'ok' },
      actions: ['PDF ansehen', 'Versenden'],
    })),
  dunning: (r) =>
    n(4, (i) => ({
      id: `du${i}`,
      title: `Rechnung 2026-${870 + i}`,
      cells: [`2026-${870 + i}`, FIRMS[(i + 5) % FIRMS.length], eur(600 + Math.floor(r() * 40) * 100), `${7 + i * 6} Tage`, i === 3 ? '2. Mahnung' : 'Erinnerung'],
      badge: i === 3 ? { text: '2. Mahnung', tone: 'bad' } : { text: 'Erinnerung', tone: 'warn' },
      actions: ['Erinnerung senden', 'Anrufen'],
    })),
  receipts: (r, pick) =>
    n(8, (i) => ({
      id: `re${i}`,
      title: pick(['Tankbeleg', 'Bürobedarf', 'Software-Abo', 'Hotel', 'Bahnticket', 'Bewirtung', 'Hardware']),
      sub: pick(['aus Mail', 'Foto per App', 'aus Kundenportal']),
      meta: eur(10 + Math.floor(r() * 400)),
      badge: i === 4 ? { text: 'Beleg fehlt', tone: 'warn' } : { text: 'Zugeordnet', tone: 'ok' },
      body: 'Beleg ausgelesen, Konto und Steuersatz erkannt, der Bankbuchung zugeordnet.',
      actions: ['Beleg ansehen'],
    })),
  cashflow: (r) => {
    let stand = 84000
    return n(6, (i) => {
      const inn = 18000 + Math.floor(r() * 12000)
      const out = 15000 + Math.floor(r() * 12000)
      stand += inn - out
      return { id: `cf${i}`, title: `KW ${40 + i}`, cells: [`KW ${40 + i}`, eur(inn), eur(out), eur(stand)], actions: ['Details'] }
    })
  },
  reports: () => [
    { id: 'rp0', title: 'Monatsbericht August', sub: 'Umsatz, Kosten, Liquidität, Pipeline', meta: '1.9.', badge: { text: 'Zur Durchsicht', tone: 'warn' }, body: 'Umsatz +8 % zum Vormonat, Kosten im Plan, Liquidität für 5 Monate gesichert.', actions: ['Freigeben', 'Bericht öffnen'] },
    { id: 'rp1', title: 'Monatsbericht Juli', sub: 'Umsatz, Kosten, Liquidität, Pipeline', meta: '1.8.', badge: { text: 'Freigegeben', tone: 'ok' }, body: 'Umsatz im Plan.', actions: ['Bericht öffnen'] },
    { id: 'rp2', title: 'Quartalsbericht Q2', sub: 'für Steuerberatung', meta: '5.7.', badge: { text: 'Versendet', tone: 'ok' }, body: 'An die Steuerberatung übermittelt.', actions: ['Bericht öffnen'] },
  ],
  editorial: (_r, pick) =>
    n(9, (i) => ({
      id: `ed${i}`,
      title: pick(['Einblick ins Büro', 'Kundenstimme', '3 Tipps für …', 'Team-Vorstellung', 'Vorher / Nachher', 'Häufige Fragen', 'Behind the Scenes']),
      col: ['Idee', 'In Arbeit', 'Freigabe', 'Geplant'][i % 4],
      sub: pick(['Reel', 'Karussell', 'Story', 'LinkedIn-Post']),
      meta: `${20 + i}.9.`,
      body: 'Thema, Format, Kanal und Termin aus dem Redaktionsplan.',
      actions: ['Öffnen'],
    })),
  copy: (_r, pick) =>
    n(5, (i) => ({
      id: `cp${i}`,
      title: `Caption: ${pick(['Einblick ins Büro', 'Kundenstimme', 'Team-Vorstellung', 'Häufige Fragen'])}`,
      sub: pick(['Instagram', 'LinkedIn', 'TikTok']),
      meta: clock(30 + i * 60),
      badge: { text: `${2 + i % 2} Varianten`, tone: 'info' },
      body: 'So sieht ein ganz normaler Dienstag bei uns aus. Und ja, die Kaffeemaschine arbeitet am meisten. 👉 Mehr im Link in der Bio.',
      actions: ['Übernehmen', 'Neu schreiben'],
    })),
  video: (r) =>
    n(4, (i) => ({
      id: `v${i}`,
      title: ['Reel „Einblick ins Büro“', 'Kundenstimme Weber', 'Tipp der Woche', 'Recruiting-Clip'][i],
      sub: `${15 + Math.floor(r() * 45)} s · 9:16`,
      meta: clock(60 + i * 200),
      badge: i === 0 ? { text: 'Im Schnitt', tone: 'info' } : { text: 'Fertig', tone: 'ok' },
      body: 'Rohmaterial aus der Medienablage, geschnitten, mit Untertiteln und Musik.',
      actions: ['Vorschau', 'Exportieren'],
    })),
  design: () =>
    ['Karussell „3 Tipps“ (6 Folien)', 'Story-Vorlage Angebot', 'LinkedIn-Banner', 'Zitat-Grafik Kundenstimme'].map((t, i) => ({
      id: `g${i}`,
      title: t,
      sub: 'aus Vorlage im Corporate Design',
      meta: clock(40 + i * 150),
      badge: i === 0 ? { text: '1 / 6', tone: 'info' } : { text: 'Fertig', tone: 'ok' },
      actions: ['Vorschau', 'Ändern'],
    })),
  publishing: (_r, pick) =>
    n(6, (i) => ({
      id: `pu${i}`,
      title: ['Reel „Einblick ins Büro“', 'Karussell „3 Tipps“', 'Kundenstimme', 'Team-Vorstellung', 'Story: Angebot', 'LinkedIn: Rückblick'][i],
      sub: pick(['Instagram', 'LinkedIn', 'TikTok']),
      meta: later(60 + i * 240),
      badge: i === 0 ? { text: 'Freigabe', tone: 'warn' } : { text: 'Eingeplant', tone: 'ok' },
      body: 'Beitrag mit Caption, Hashtags und Veröffentlichungszeit.',
      actions: ['Vorschau', 'Verschieben'],
    })),
  analytics: (r) =>
    ['Einblick ins Büro', '3 Tipps für …', 'Kundenstimme', 'Team-Vorstellung', 'Häufige Fragen', 'Vorher / Nachher'].map((t, i) => ({
      id: `an${i}`,
      title: t,
      cells: [t, ['Instagram', 'LinkedIn', 'TikTok'][i % 3], (2000 + Math.floor(r() * 40000)).toLocaleString('de-DE'), `${(2 + r() * 8).toFixed(1)} %`],
      actions: ['Details'],
    })),
  campaigns: () =>
    [
      ['Herbst-Aktion', 'Planung'],
      ['Neukunden Q4', 'Läuft'],
      ['Webinar Oktober', 'Läuft'],
      ['Empfehlungsprogramm', 'Läuft'],
      ['Sommer-Aktion', 'Auswertung'],
    ].map(([t, c], i) => ({
      id: `ca${i}`,
      title: t,
      col: c,
      sub: `Ziel: ${[40, 60, 120, 25, 50][i]} Leads`,
      meta: eur([3000, 5000, 1500, 800, 4000][i]),
      body: 'Ziel, Budget, Kanäle und Ergebnis der Kampagne.',
      actions: ['Kampagne öffnen'],
    })),
  ads: (r) =>
    ['Suchanzeigen Marke', 'Retargeting Website', 'Lookalike Kunden', 'Webinar Oktober'].map((t, i) => {
      const spend = 200 + Math.floor(r() * 1500)
      const leads = 4 + Math.floor(r() * 30)
      return { id: `ad${i}`, title: t, cells: [t, ['Google', 'Meta', 'Meta', 'LinkedIn'][i], eur(spend), String(leads), eur(Math.round(spend / leads))], actions: ['Pausieren', 'Budget ändern'] }
    }),
  seo: (r) =>
    ['it service berlin', 'agentur ki automatisierung', 'buchhaltung automatisieren', 'crm einrichtung', 'ki assistent firma'].map((t, i) => {
      const pos = 2 + Math.floor(r() * 25)
      const delta = Math.floor(r() * 7) - 2
      return { id: `se${i}`, title: t, cells: [t, String(pos), delta > 0 ? `▲ ${delta}` : delta < 0 ? `▼ ${-delta}` : '–', '/leistungen'], actions: ['Seite verbessern'] }
    }),
  newsletter: () => [
    { id: 'n0', title: 'Newsletter Oktober', sub: '2.140 Empfänger', meta: 'geplant 1.10. 09:00', badge: { text: 'Freigabe', tone: 'warn' }, body: 'Themen: Herbst-Aktion, neues Teammitglied, 3 Tipps.', actions: ['Freigeben', 'Vorschau'] },
    { id: 'n1', title: 'Newsletter September', sub: '2.096 Empfänger', meta: '1.9.', badge: { text: '42 % geöffnet', tone: 'ok' }, body: 'Gesendet.', actions: ['Auswertung'] },
  ],
  competition: (_r, pick) =>
    n(5, (i) => ({
      id: `co${i}`,
      title: `Wettbewerber ${String.fromCharCode(65 + i)}`,
      sub: pick(['Preis gesenkt um 10 %', 'Neues Angebot für Kleinbetriebe', 'Neue Website', 'Stellenanzeige Vertrieb', 'Kampagne auf LinkedIn']),
      meta: clock(300 + i * 700),
      badge: { text: pick(['Preis', 'Angebot', 'Marketing']), tone: 'info' },
      body: 'Beobachtet auf Website und Social Media. Einschätzung im Wochenbericht.',
      actions: ['Quelle öffnen'],
    })),
  budget: () =>
    [
      ['Anzeigen', 6000, 4100],
      ['Content-Produktion', 2500, 1700],
      ['Tools', 900, 880],
      ['Events', 3000, 900],
    ].map(([t, plan, ist], i) => ({
      id: `bu${i}`,
      title: String(t),
      cells: [String(t), eur(plan as number), eur(ist as number), `${Math.round(((ist as number) / (plan as number)) * 100)} %`],
      actions: ['Details'],
    })),
  library: (r, pick) =>
    n(10, (i) => ({
      id: `lib${i}`,
      title: pick(['Vertrag', 'Angebot', 'Protokoll', 'Preisliste', 'Präsentation', 'Richtlinie', 'Anleitung']) + ` · ${pick(FIRMS)}`,
      sub: pick(['PDF', 'Word', 'Excel', 'PowerPoint']),
      meta: clock(60 + i * 400 + Math.floor(r() * 60)),
      body: 'Eingelesen, durchsuchbar und mit Kunde und Projekt verknüpft.',
      actions: ['Öffnen'],
    })),
  contacts: (_r, pick) =>
    PEOPLE.slice(0, 10).map((p, i) => ({
      id: `ct${i}`,
      title: p,
      cells: [p, FIRMS[i % FIRMS.length], pick(['Geschäftsführung', 'Einkauf', 'Buchhaltung', 'Marketing', 'IT']), clock(200 + i * 900)],
      actions: ['Kontakt öffnen'],
    })),
  protocols: (r, pick) =>
    n(8, (i) => ({
      id: `pr${i}`,
      title: `${pick(['Erstgespräch', 'Projekt-Update', 'Reklamation', 'Jahresgespräch', 'Support-Anruf'])} · ${pick(FIRMS)}`,
      sub: `${pick(['Telefon', 'Teams', 'Google Meet'])} · ${10 + Math.floor(r() * 40)} Min.`,
      meta: clock(90 + i * 300),
      body: 'Zusammenfassung, Entscheidungen und Aufgaben — automatisch aus dem Gespräch gezogen.',
      fields: [['Aufgaben', `${1 + Math.floor(r() * 4)} angelegt`]],
      actions: ['Protokoll öffnen'],
    })),
}

function seedOf(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) || 1
}

/** Everything a window lists, including approvals owned by that agent. */
export function itemsFor(t: WsTarget, approved: string[]): WsItem[] {
  const dept = DEPARTMENTS.find((d) => d.id === t.deptId)

  if (t.kind === 'log') {
    const now = new Date()
    let log = dept ? deptProtocol(dept, now) : brainProtocol(now)
    // Late in the day nothing is left to plan; show tomorrow morning instead of an empty list.
    if (t.filter === 'planned' && !log.some((p) => !p.done)) {
      const jobs = dept?.jobs ?? ['Mails und Termine ins Gedächtnis', 'Tagesplan geschrieben', 'Wissensbibliothek aufgefrischt']
      log = jobs.map((text, i) => ({ time: `morgen ${String(7 + i).padStart(2, '0')}:${i % 2 ? '30' : '00'}`, text, done: false }))
    }
    const r = rng(seedOf(t.sub))
    return log
      .filter((p) => !t.filter || (t.filter === 'done' ? p.done : !p.done))
      .map((p, i) => ({
        id: `log${i}`,
        title: p.text,
        sub: dept ? dept.short : 'Gehirn',
        meta: p.time,
        planned: !p.done,
        badge: p.done ? { text: 'Erledigt', tone: 'ok' as Tone } : { text: 'Geplant', tone: 'muted' as Tone },
        body: p.done ? 'Lauf ohne Fehler abgeschlossen. Ergebnis liegt im Gedächtnis.' : 'Geplanter Lauf, startet automatisch.',
        fields: p.done
          ? [
              ['Dauer', `${8 + Math.floor(r() * 80)} s`],
              ['Verarbeitet', `${1 + Math.floor(r() * 40)} Einträge`],
            ]
          : [['Start', p.time]],
        actions: p.done ? ['Ergebnis ansehen', 'Erneut ausführen'] : ['Jetzt ausführen', 'Überspringen'],
      }))
  }

  if (t.kind === 'approvals') {
    const depts = dept ? [dept] : DEPARTMENTS
    return depts.flatMap((d) =>
      d.waiting
        .filter((w) => !approved.includes(w))
        .map((w, i) => {
          const owner = waitingOwner(d, d.waiting.indexOf(w))
          return {
            id: `ap-${d.id}-${i}`,
            title: w,
            sub: `${d.short} · ${owner.name}`,
            badge: { text: 'Wartet auf Sie', tone: 'warn' as Tone },
            body: `${owner.name} hat das vorbereitet: ${owner.doing}. Nach Ihrer Freigabe wird es sofort ausgeführt.`,
            approval: w,
            actions: ['Freigeben', 'Ändern', 'Ablehnen'],
          }
        }),
    )
  }

  const r = rng(seedOf(`${t.deptId ?? 'brain'}:${t.kind}:${t.title}`))
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)]
  const base = MAKERS[t.kind]?.(r, pick) ?? []

  // Decisions this agent is waiting on go first.
  if (dept && t.agentId) {
    const mine = dept.waiting
      .map((w, i) => ({ w, owner: waitingOwner(dept, i) }))
      .filter(({ owner }) => owner.id === t.agentId)
      .map(({ w }, i) => ({
        id: `wait${i}`,
        title: w,
        sub: 'Vorbereitet vom Agenten',
        meta: 'jetzt',
        badge: approved.includes(w) ? { text: 'Freigegeben', tone: 'ok' as Tone } : { text: 'Wartet auf Sie', tone: 'warn' as Tone },
        body: 'Alles ist vorbereitet. Nach Ihrer Freigabe wird es sofort ausgeführt.',
        approval: w,
        actions: approved.includes(w) ? [] : ['Freigeben', 'Ändern', 'Ablehnen'],
        col: LAYOUT[t.kind].columns?.[LAYOUT[t.kind].columns!.length - 2],
        cells: LAYOUT[t.kind].columns?.map((_, ci) => (ci === 0 ? w : ci === LAYOUT[t.kind].columns!.length - 1 ? 'Wartet auf Sie' : '–')),
      }))
    return [...mine, ...base]
  }
  return base
}

/** The mailbox-style figures shown on the brain get their own counts. */
export const brainCount = (label: string) => BRAIN.stats.find((s) => s.label === label)?.value
