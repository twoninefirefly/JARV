import { AKTIV } from './branche'
import type { Agent, AgentStatus, Department } from './data'
import type { Helpers } from './hausverwaltung'
import type { Layout, Source, WsItem } from './workspaces'

/**
 * A property manager that is really a group of companies.
 *
 * When the customer comes with a `gruppe` (kunden.ts), the WEG floor is not
 * what they run — the holding is. That floor becomes "Holding &
 * Gesellschaften": the companies themselves, the register watch, filing
 * deadlines, intercompany charges, financing and the group report. The other
 * five floors stay the Hausverwaltung's, and the group's own service company
 * joins the tradesmen.
 *
 * Register numbers come from the customer record and are shown with their
 * source; everything else here is demo data of the right shape, like the rest
 * of the office.
 */

export const GRUPPE = AKTIV?.gruppe ?? null

export type GruppeKind = 'entities' | 'registerwatch' | 'deadlines' | 'intercompany' | 'financing' | 'groupreports'

type Team = (prefix: string, members: Array<[string, string, AgentStatus, string, boolean?]>) => Agent[]

const G = GRUPPE?.gesellschaften ?? []
const holding = G[0]?.name ?? 'Holding'
const kurz = (i: number) => G[i % Math.max(1, G.length)]?.kurz ?? 'Gesellschaft'
const service = GRUPPE?.service ?? 'Hausmeisterservice'
const unconfirmed = G.filter((g) => !g.belegt).length

/**
 * The financial year being closed: always last year's, so the filing
 * deadlines roll forward on their own on New Year's Day.
 */
export const J = new Date().getFullYear() - 1

/** The month `offset` months from now, written out: „Oktober“. */
export const monat = (offset = 0, now = new Date()) => new Date(now.getFullYear(), now.getMonth() + offset, 1).toLocaleDateString('de-DE', { month: 'long' })

/**
 * The waiting item, named once so the management-only list can refer to it.
 * Decisions are stored by this text, so it must read the same as before for
 * the current year.
 */
export const GRUPPE_FREIGABE = `Offenlegung Jahresabschluss ${J} ${holding} freigeben`

export function gruppeDepartment(day: (seed: number, scale: number) => number[], team: Team, angle: number): Department {
  return {
    id: 'holding',
    name: 'Holding & Gesellschaften',
    short: 'Holding',
    tagline: `${G.length} Gesellschaften, Register, Finanzen`,
    icon: 'building',
    color: '#c7704e',
    angle,
    lead: {
      title: 'Holding-Lead',
      about:
        `Hält die Gruppe zusammen: ${G.map((g) => g.kurz).join(', ')}. 6 Agenten berichten an ihn: Gesellschaften, Registerwache, ` +
        'Fristen & Offenlegung, Intercompany, Finanzierung und Gruppen-Reporting. Jede Bekanntmachung im Handelsregister ist am nächsten Morgen bekannt.',
    },
    agents: team('hol', [
      ['Holding-Lead', 'Lead', 'arbeitet', 'bündelt den Monatsstand der Gruppe', true],
      ['Gesellschaften', 'Stammdaten', 'bereit', unconfirmed ? `${G.length} Gesellschaften, ${unconfirmed} Registernummer zu bestätigen` : `${G.length} Gesellschaften aktuell`],
      ['Registerwache', 'Handelsregister', 'arbeitet', 'gleicht die Bekanntmachungen von heute ab'],
      ['Fristen & Offenlegung', 'Fristen', 'wartet', 'Offenlegung Jahresabschluss wartet auf Freigabe'],
      ['Intercompany', 'Verrechnung', 'arbeitet', `stimmt Leistungen von ${service} ab`],
      ['Finanzierung', 'Banken', 'bereit', 'alle Darlehen planmäßig bedient'],
      ['Gruppen-Reporting', 'Berichte', 'arbeitet', 'schreibt den Gruppenbericht Q3'],
    ]),
    kpis: [
      { value: G.length, label: 'Gesellschaften' },
      { value: 4, label: 'Fristen im Q4' },
    ],
    runs: day(71, 6),
    waiting: [GRUPPE_FREIGABE],
    jobs: ['Handelsregister abgeglichen', 'Verrechnung gebucht', 'Frist überwacht', 'Gruppenbericht aktualisiert', 'Gesellschafterliste geprüft'],
    docs: 640,
  }
}

export const GRUPPE_KIND_BY_NAME: Record<string, GruppeKind> = {
  Gesellschaften: 'entities',
  Registerwache: 'registerwatch',
  'Fristen & Offenlegung': 'deadlines',
  Intercompany: 'intercompany',
  Finanzierung: 'financing',
  'Gruppen-Reporting': 'groupreports',
}

export const GRUPPE_WAITING_OWNER = { holding: ['Fristen & Offenlegung'] }
export const GRUPPE_KPI_OWNER: Record<string, [string, string]> = { holding: ['Gesellschaften', 'Fristen & Offenlegung'] }

// [from dept, from agent, to dept, to agent, message, what the brain did]
export const GRUPPE_ROUTES: Array<[string, string, string, string, string, string]> = [
  // Nothing here may announce a register event for a real company; the open
  // MH 11 number is the one true thing the watch has to report.
  ['holding', 'Registerwache', 'holding', 'Gesellschaften', `${kurz(4)}: Registernummer weiter offen – Auszug angefordert`, 'Prüfauftrag angelegt'],
  ['schaden', 'Rechnungsprüfung', 'holding', 'Intercompany', `${service} rechnet den Hausmeistereinsatz {object} ab`, 'Verrechnung vorgemerkt'],
  ['miete', 'Objektkonten', 'holding', 'Finanzierung', `Mieteingang {object} deckt die Rate im ${monat(0)}`, 'Liquiditätsplan aktualisiert'],
  ['holding', 'Fristen & Offenlegung', 'miete', 'Belege', `Jahresabschluss ${kurz(1)}: Belege bis 30.11.`, 'Belegliste angefordert'],
  ['holding', 'Gruppen-Reporting', 'vermietung', 'Leerstand', 'Leerstand je Gesellschaft für den Gruppenbericht?', 'Zahlen übernommen'],
]

export function gruppeSources(domain: string): Record<GruppeKind, Source> {
  return {
    entities: { system: 'Gesellschaftsakte', examples: 'Handelsregister, Notar, DMS', account: `holding@${domain}`, does: ['führt alle Gesellschaften mit Register, Geschäftsführung und Gesellschaftern', 'verknüpft Objekte mit ihrer Gesellschaft', 'meldet fehlende Unterlagen'] },
    registerwatch: { system: 'Handelsregister-Wache', examples: 'handelsregister.de, Unternehmensregister, North Data', account: `holding@${domain}`, does: ['prüft jeden Morgen alle Bekanntmachungen der Gruppe', 'gleicht sie mit der Gesellschaftsakte ab', 'meldet jede Änderung der Geschäftsführung'] },
    deadlines: { system: 'Fristenkalender', examples: 'Steuerberater, DATEV, Outlook', account: `fristen@${domain}`, does: ['überwacht Offenlegung, Steuer und Transparenzregister', 'erinnert vier Wochen vorher', 'sammelt die Unterlagen ein'] },
    intercompany: { system: 'Konzernverrechnung', examples: 'DATEV, Immoware24', account: `buchhaltung@${domain}`, does: ['bucht Leistungen zwischen den Gesellschaften', 'gleicht beide Seiten ab', 'bereitet die Verrechnung zur Freigabe vor'] },
    financing: { system: 'Darlehen und Banken', examples: 'Hausbank über EBICS, Darlehensverträge', account: `finanzen@${domain}`, does: ['überwacht Raten und Zinsbindungen', 'warnt vor jedem Zinsende', 'bereitet Bankunterlagen vor'] },
    groupreports: { system: 'Gruppenberichte', examples: 'DATEV, Excel, Power BI', account: `reporting@${domain}`, does: ['fasst alle Gesellschaften zu einem Bericht zusammen', 'vergleicht mit Plan und Vorjahr', 'legt ihn der Geschäftsführung vor'] },
  }
}

export const GRUPPE_LAYOUT: Record<GruppeKind, { layout: Layout; columns?: string[] }> = {
  entities: { layout: 'table', columns: ['Gesellschaft', 'Register', 'Aufgabe (Annahme)', 'Stand'] },
  registerwatch: { layout: 'list' },
  deadlines: { layout: 'calendar' },
  intercompany: { layout: 'table', columns: ['Von', 'An', 'Leistung', 'Betrag', 'Status'] },
  financing: { layout: 'table', columns: ['Darlehen', 'Gesellschaft', 'Restschuld', 'Zinsbindung', 'Status'] },
  groupreports: { layout: 'list' },
}

type Maker = (r: () => number, pick: <T>(xs: T[]) => T) => WsItem[]

export function gruppeMakers({ n, eur, clock, due }: Helpers): Record<GruppeKind, Maker> {
  const source = GRUPPE?.quelle ?? ''
  // „Registerrecherche Agenten-Büro, 16.10.2026“ → its name and its date.
  const [study, studied] = source.split(', ')
  const confirmed = G.length - unconfirmed
  return {
    entities: () =>
      G.map((g, i) => {
        // The court is the same for the whole group, so the table shows only the number.
        const number = g.register.split(', ').pop() ?? g.register
        return {
          id: `ges${i}`,
          title: g.name,
          // The full name, suffix included: a UG has to carry „(haftungsbeschränkt)“ (§ 5a GmbHG).
          cells: [g.name, g.belegt ? number : `${number}?`, g.aufgabe, g.belegt ? 'belegt' : 'zu prüfen'],
          badge: g.belegt ? { text: 'belegt', tone: 'ok' } : { text: 'zu prüfen', tone: 'warn' },
          fields: [
            ['Registergericht', g.register.split(', ')[0]],
            ['Gesellschafterin', g.mutter ? `${g.mutter} (${g.mutterQuelle === 'register' ? 'laut Treffer der Recherche' : 'nur laut Netzwerk-Grafik'})` : '—'],
            ['Quelle', g.belegt ? source : `${source} (nur Suchergebnis)`],
            ...(g.hinweis ? [['Hinweis', g.hinweis] as [string, string]] : []),
          ],
          actions: ['Gesellschaftsakte'],
        }
      }),
    registerwatch: () => [
      // The research itself comes first: it is the only dated event the office really has.
      {
        id: 'hr-recherche',
        title: `${studied ?? ''} · ${study}`,
        sub: `${G.length} Gesellschaften abgefragt`,
        badge: { text: 'Demo-Lauf', tone: 'info' },
        body: `${confirmed} von ${G.length} Registernummern bestätigt${unconfirmed ? `, ${G.filter((g) => !g.belegt).map((g) => g.kurz).join(', ')} offen` : ''}.`,
        actions: ['Recherche ansehen'],
      },
      ...G.map((g, i) => ({
        id: `hr${i}`,
        title: g.name,
        sub: g.register,
        meta: clock(30 + i * 7),
        badge: g.belegt ? { text: 'keine Änderung', tone: 'ok' as const } : { text: 'Nummer bestätigen', tone: 'warn' as const },
        // Only what was checked: nobody looked up capital or management here, so the row claims neither.
        body: g.belegt
          ? 'Keine neue Bekanntmachung seit dem letzten Abgleich (Demo-Lauf).'
          : 'Registernummer stammt nur aus einem Suchergebnis. Ein aktueller Registerauszug bestätigt sie.',
        actions: ['Registerauszug'],
      })),
    ],
    deadlines: () =>
      (
        [
          [`Offenlegung Jahresabschluss ${J} · ${kurz(0)}`, `Unternehmensregister · gesetzliche Frist 31.12.${J + 1} (§ 325 HGB)`, 12],
          [`Gesellschafterversammlung · ${kurz(1)}`, `Feststellung Jahresabschluss ${J}, Ergebnisverwendung`, 19],
          ['Transparenzregister · alle Gesellschaften', 'Angaben zu wirtschaftlich Berechtigten prüfen (§ 20 GwG)', 26],
          [`Feststellungserklärung und Steuererklärungen ${J} · ${kurz(5)}`, 'gesonderte und einheitliche Feststellung (§ 180 AO) · über den Steuerberater', 40],
        ] as Array<[string, string, number]>
      ).map(([title, sub, days], i) => ({
        id: `fr${i}`,
        title,
        sub,
        // A deadline is a day, not a time: the date alone, „Do., 29.10.“.
        meta: due(days),
        badge: i === 0 ? { text: 'Entwurf liegt vor', tone: 'info' } : { text: 'Geplant', tone: 'ok' },
        body: i === 0 ? 'Unterlagen gesammelt, der Entwurf liegt bei.' : 'Im Fristenkalender. Die Unterlagen werden eingesammelt.',
        fields: [
          ['Erledigen bis', due(days)],
          ['Erinnerung', 'vier Wochen und eine Woche vorher'],
        ],
        actions: ['Unterlagen'],
      })),
    intercompany: (r) =>
      // The open rows are this month's: last month's charge is already approved in the Leitung history (team.ts).
      [
        [service, kurz(1), `Hausmeister ${monat(0)}`],
        [service, kurz(2), `Hausmeister ${monat(0)}`],
        [kurz(0), kurz(3), 'Geschäftsbesorgung Q3'],
        [service, kurz(5), 'Kleinreparaturen'],
        [kurz(0), kurz(1), 'Geschäftsbesorgung Q3'],
      ].map((c, i) => ({
        id: `ic${i}`,
        title: `${c[0]} → ${c[1]}`,
        cells: [c[0], c[1], c[2], eur(1200 + Math.floor(r() * 60) * 100), i < 2 ? 'offen' : 'gebucht'],
        badge: i < 2 ? { text: 'abstimmen', tone: 'info' } : { text: 'gebucht', tone: 'ok' },
        actions: ['Beleg'],
      })),
    financing: (r) =>
      n(4, (i) => {
        const end = 2027 + Math.floor(r() * 6)
        return {
          id: `dl${i}`,
          title: `Darlehen ${i + 1}`,
          cells: [`Darlehen ${i + 1}`, kurz([1, 2, 5, 5][i]), eur(400000 + Math.floor(r() * 30) * 50000), `bis ${end}`, end <= 2027 ? 'Anschluss planen' : 'planmäßig'],
          badge: end <= 2027 ? { text: 'Zinsende naht', tone: 'warn' } : undefined,
          actions: ['Vertrag'],
        }
      }),
    groupreports: () =>
      n(3, (i) => ({
        id: `gb${i}`,
        title: ['Gruppenbericht Q3', 'Liquiditätsvorschau 13 Wochen', 'Gruppenbericht Q2'][i],
        sub: `${G.length} Gesellschaften · Mieten, Kosten, Darlehen, Leerstand`,
        meta: i < 2 ? 'Entwurf' : '8.7.',
        badge: i < 2 ? { text: 'In Arbeit', tone: 'info' } : { text: 'Vorgelegt', tone: 'ok' },
        body: 'Je Gesellschaft eine Zeile, darunter die Gruppe gesamt. Abweichungen zum Plan sind markiert.',
        actions: ['Bericht öffnen'],
      })),
  }
}
