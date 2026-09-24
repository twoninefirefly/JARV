import type { AgentStatus, Agent, Department } from './data'
import type { Layout, Source, WsItem } from './workspaces'

/**
 * The office dressed for a property manager (`?branche=hausverwaltung`).
 *
 * Same building, same brain, different trade: tenants instead of leads,
 * damage reports instead of tickets, service-charge statements instead of
 * campaigns. The systems named here are the ones a Hausverwaltung actually
 * runs on, so the setup conversation starts from their world.
 *
 * Only types come from the shared modules; the helpers are passed in, so this
 * file never takes part in an import cycle.
 */

export type HvKind =
  | 'damages'
  | 'dispatch'
  | 'workorders'
  | 'maintenance'
  | 'insurance'
  | 'craftinvoices'
  | 'vacancies'
  | 'listings'
  | 'applicants'
  | 'viewings'
  | 'leases'
  | 'handovers'
  | 'rent'
  | 'deposits'
  | 'meters'
  | 'costs'
  | 'statements'
  | 'prepayments'
  | 'objections'
  | 'assemblies'
  | 'resolutions'
  | 'businessplan'
  | 'reserves'
  | 'ownerreports'
  | 'ownerrequests'

type Team = (prefix: string, members: Array<[string, string, AgentStatus, string, boolean?]>) => Agent[]

export function hvDepartments(day: (seed: number, scale: number) => number[], team: Team): Department[] {
  const step = (Math.PI * 2) / 6
  return [
    {
      id: 'mieter',
      name: 'Mieterkommunikation',
      short: 'Mieter',
      tagline: 'Mails, Anrufe, Mieterportal',
      icon: 'chat',
      color: '#8ea5bd',
      angle: 0,
      lead: {
        title: 'Mieter-Lead',
        about:
          'Nimmt jedes Anliegen der Mieter an. 6 Agenten berichten an ihn: Posteingang, Mieterportal, Telefon, Terminierung, Antwortentwürfe und Eskalation. Schäden gehen sofort an die Technik, Zahlungsfragen an die Buchhaltung.',
      },
      agents: team('mie', [
        ['Mieter-Lead', 'Lead', 'arbeitet', 'verteilt 23 neue Anliegen', true],
        ['Posteingang', 'Mails', 'arbeitet', 'sortiert Posteingang verwaltung@'],
        ['Mieterportal', 'Portal & App', 'arbeitet', 'beantwortet Frage zur Mülltonne'],
        ['Telefon', 'Anrufe', 'arbeitet', 'fasst Anruf Lindenstr. 12 zusammen'],
        ['Terminierung', 'Kalender', 'bereit', '4 Handwerkertermine bestätigt'],
        ['Antwort-Entwurf', 'Texte', 'wartet', 'Antwort zur Mieterhöhung wartet auf Freigabe'],
        ['Eskalation', 'Notfälle', 'bereit', 'kein Notfall offen'],
      ]),
      kpis: [
        { value: 187, label: 'Anliegen heute' },
        { value: 41, label: 'Anrufe heute' },
      ],
      runs: day(13, 20),
      waiting: ['Antwort an Fam. Yilmaz zur Mieterhöhung freigeben'],
      jobs: ['Mails und Portal eingelesen', 'Anliegen zugeordnet', 'Anruf protokolliert', 'Handwerkertermin an Mieter bestätigt', 'Aushang verschickt'],
      docs: 1840,
    },
    {
      id: 'schaden',
      name: 'Schäden & Handwerker',
      short: 'Technik',
      tagline: 'Schäden, Aufträge, Wartung',
      icon: 'wrench',
      color: '#a88760',
      angle: step,
      lead: {
        title: 'Technik-Lead',
        about:
          'Vom gemeldeten Schaden bis zur geprüften Rechnung. 6 Agenten berichten an ihn: Schadensaufnahme, Handwerker-Vergabe, Auftragsverfolgung, Wartung & Prüfungen, Versicherung und Rechnungsprüfung.',
      },
      agents: team('sch', [
        ['Technik-Lead', 'Lead', 'arbeitet', 'priorisiert 9 offene Schäden', true],
        ['Schadensaufnahme', 'Meldungen', 'arbeitet', 'wertet Fotos Wasserschaden aus'],
        ['Handwerker-Vergabe', 'Aufträge', 'wartet', 'Auftrag Dachrinne wartet auf Freigabe'],
        ['Auftragsverfolgung', 'Termine', 'arbeitet', 'fragt Stand bei Sanitär Kaya an'],
        ['Wartung & Prüfungen', 'Pflichten', 'bereit', 'Aufzugsprüfung am 2.10. geplant'],
        ['Versicherung', 'Schäden', 'arbeitet', 'meldet Leitungswasserschaden'],
        ['Rechnungsprüfung', 'Handwerker', 'arbeitet', 'prüft 6 Handwerkerrechnungen'],
      ]),
      kpis: [
        { value: 34, label: 'Schäden offen' },
        { value: 19, label: 'Aufträge diese Woche' },
      ],
      runs: day(29, 12),
      waiting: ['Auftrag Dachrinne Birkenweg 3 (1.840 €) freigeben'],
      jobs: ['Schadensmeldung aufgenommen', 'Handwerker beauftragt', 'Auftragsstand abgefragt', 'Rechnung geprüft', 'Prüftermine überwacht'],
      docs: 960,
    },
    {
      id: 'vermietung',
      name: 'Vermietung',
      short: 'Vermietung',
      tagline: 'Leerstand, Interessenten, Verträge',
      icon: 'key',
      color: '#8fa35e',
      angle: step * 2,
      lead: {
        title: 'Vermietungs-Lead',
        about:
          'Hält den Leerstand klein. 6 Agenten berichten an ihn: Leerstand, Inserate, Interessenten, Besichtigungen, Mietverträge und Übergaben. Jede frei werdende Wohnung ist inseriert, bevor der Mieter auszieht.',
      },
      agents: team('ver', [
        ['Vermietungs-Lead', 'Lead', 'arbeitet', 'plant Neuvermietung Hafenstr. 8', true],
        ['Leerstand', 'Wohnungen', 'bereit', '5 Wohnungen frei, 3 gekündigt'],
        ['Inserate', 'Portale', 'arbeitet', 'aktualisiert Inserat auf ImmoScout24'],
        ['Interessenten', 'Anfragen', 'arbeitet', 'prüft 14 Bewerbungen'],
        ['Besichtigungen', 'Termine', 'arbeitet', 'lädt 6 Interessenten ein'],
        ['Mietverträge', 'Verträge', 'wartet', 'Vertrag Hafenstr. 8 wartet auf Freigabe'],
        ['Übergaben', 'Protokolle', 'bereit', 'Übergabe Freitag 10:00 vorbereitet'],
      ]),
      kpis: [
        { value: 5, label: 'Wohnungen frei' },
        { value: 62, label: 'Anfragen 30 T' },
      ],
      runs: day(31, 10),
      waiting: ['Mietvertrag Hafenstr. 8, WE 04 freigeben'],
      jobs: ['Anfragen vorsortiert', 'Besichtigung bestätigt', 'Inserat aktualisiert', 'Selbstauskunft geprüft', 'Übergabeprotokoll erstellt'],
      docs: 720,
    },
    {
      id: 'miete',
      name: 'Mietbuchhaltung',
      short: 'Buchhaltung',
      tagline: 'Mieten, Mahnungen, Konten',
      icon: 'euro',
      color: '#d6c69c',
      angle: step * 3,
      lead: {
        title: 'Buchhaltungs-Lead',
        about:
          'Jede Miete, jede Zahlung, jedes Objektkonto. 5 Agenten berichten an ihn: Mieteingänge, Mahnwesen, Kautionen, Belege und Objektkonten. Jeden Morgen ist klar, wer gezahlt hat.',
      },
      agents: team('buc', [
        ['Buchhaltungs-Lead', 'Lead', 'arbeitet', 'schließt Mietmonat September ab', true],
        ['Mieteingänge', 'Soll/Ist', 'arbeitet', 'gleicht 212 Zahlungen ab'],
        ['Mahnwesen', 'Rückstände', 'wartet', '2. Mahnung Lindenstr. 12 wartet'],
        ['Kautionen', 'Konten', 'bereit', '3 Kautionen angelegt'],
        ['Belege', 'Kreditoren', 'arbeitet', 'ordnet 28 Belege Objekten zu'],
        ['Objektkonten', 'Liquidität', 'bereit', 'alle Objektkonten gedeckt'],
      ]),
      kpis: [
        { value: 98, label: '% Miete eingegangen' },
        { value: 7, label: 'Rückstände' },
      ],
      runs: day(43, 9),
      waiting: ['2. Mahnung an Mieter Lindenstr. 12 freigeben'],
      jobs: ['Mieteingänge abgeglichen', 'Belege zugeordnet', 'Lastschriften eingezogen', 'Objektkonten geprüft', 'Rückstände aktualisiert'],
      docs: 1320,
    },
    {
      id: 'nebenkosten',
      name: 'Nebenkosten',
      short: 'Nebenkosten',
      tagline: 'Zähler, Kosten, Abrechnungen',
      icon: 'meter',
      color: '#d7b15d',
      angle: step * 4,
      lead: {
        title: 'Nebenkosten-Lead',
        about:
          'Macht die Abrechnung pünktlich und prüfbar. 5 Agenten berichten an ihn: Zählerstände, Kostenerfassung, Abrechnung, Vorauszahlungen und Einsprüche. Jede Umlage mit Schlüssel und Beleg.',
      },
      agents: team('nk', [
        ['Nebenkosten-Lead', 'Lead', 'arbeitet', 'plant Abrechnungen 2025', true],
        ['Zählerstände', 'Ablesung', 'arbeitet', 'übernimmt Werte vom Messdienst'],
        ['Kostenerfassung', 'Umlage', 'arbeitet', 'ordnet Grundsteuer 2025 zu'],
        ['Abrechnung', 'Abrechnungen', 'wartet', '3 Abrechnungen warten auf Freigabe'],
        ['Vorauszahlungen', 'Anpassung', 'bereit', '41 Anpassungen berechnet'],
        ['Einsprüche', 'Rückfragen', 'arbeitet', 'beantwortet Belegeinsicht Hafenstr.'],
      ]),
      kpis: [
        { value: 38, label: 'Abrechnungen fertig' },
        { value: 12, label: 'noch offen' },
      ],
      runs: day(59, 8),
      waiting: ['Nebenkostenabrechnungen Birkenweg 3 (3 Stück) freigeben'],
      jobs: ['Zählerstände übernommen', 'Kosten zugeordnet', 'Abrechnung erstellt', 'Vorauszahlung angepasst', 'Rückfrage beantwortet'],
      docs: 880,
    },
    {
      id: 'weg',
      name: 'WEG & Eigentümer',
      short: 'WEG',
      tagline: 'Versammlungen, Beschlüsse, Rücklagen',
      icon: 'building',
      color: '#c7704e',
      angle: step * 5,
      lead: {
        title: 'WEG-Lead',
        about:
          'Betreut Eigentümergemeinschaften und Einzeleigentümer. 6 Agenten berichten an ihn: Eigentümerversammlung, Beschlüsse, Wirtschaftsplan, Rücklagen, Eigentümer-Reporting und Eigentümer-Anfragen.',
      },
      agents: team('weg', [
        ['WEG-Lead', 'Lead', 'arbeitet', 'bereitet ETV Parkallee 21 vor', true],
        ['Eigentümerversammlung', 'ETV', 'wartet', 'Einladung ETV wartet auf Freigabe'],
        ['Beschlüsse', 'Sammlung', 'bereit', 'Beschlusssammlung aktuell'],
        ['Wirtschaftsplan', 'Planung', 'arbeitet', 'rechnet Wirtschaftsplan 2027'],
        ['Rücklagen', 'Erhaltung', 'bereit', 'Rücklagen aller WEGs geprüft'],
        ['Eigentümer-Reporting', 'Berichte', 'arbeitet', 'schreibt Quartalsbericht Q3'],
        ['Eigentümer-Anfragen', 'Anfragen', 'arbeitet', 'beantwortet Frage zur Sonderumlage'],
      ]),
      kpis: [
        { value: 14, label: 'WEGs betreut' },
        { value: 3, label: 'ETVs im Oktober' },
      ],
      runs: day(71, 7),
      waiting: ['Einladung ETV Parkallee 21 freigeben'],
      jobs: ['Beschluss umgesetzt', 'Einladung vorbereitet', 'Hausgeld abgeglichen', 'Eigentümeranfrage beantwortet', 'Rücklage gebucht'],
      docs: 1100,
    },
  ]
}

export const HV_BRAIN = {
  about:
    'Hier sprechen die Agenten miteinander. Jede Nachricht läuft durchs Gehirn: Es legt sie beim richtigen Objekt und Mieter ab und stellt sie dem Kollegen zu, der sie braucht. Mails und Portal kommen alle 30 Minuten dazu, Kontoumsätze jeden Morgen.',
  jarvis:
    'Ein Gedächtnis für alle Objekte. Wer nach der Lindenstraße fragt, bekommt Mieter, offene Schäden, Zahlungen und den letzten Beschluss der WEG — aus einer Hand.',
  stats: [
    { value: 1840, label: 'Kontakte' },
    { value: 410, label: 'Protokolle' },
    { value: 26400, label: 'Mails' },
    { value: 3120, label: 'Termine' },
    { value: 7450, label: 'Chats' },
  ],
  syncText: 'Kontoumsätze abgeglichen',
}

// ---------------------------------------------------------------------------
// Agents talking through the brain
// ---------------------------------------------------------------------------

export const HV_OBJECTS = ['Lindenstr. 12', 'Birkenweg 3', 'Hafenstr. 8', 'Parkallee 21', 'Am Markt 5', 'Gartenstr. 40']
export const HV_PEOPLE = ['Fam. Yilmaz', 'Herr Becker', 'Frau Nowak', 'Herr Schulte', 'Frau Hansen', 'Fam. Kowalski', 'Herr Albrecht', 'Frau Demir', 'Herr Jansen', 'Frau Lorenz', 'Herr Özdemir', 'Frau Krause']
export const HV_CRAFTS = ['Sanitär Kaya', 'Elektro Hahn', 'Dachdecker Brandt', 'Malerbetrieb Voss', 'Schlüsseldienst 24', 'Heizung & Solar Meyer', 'Gartenpflege Grün']

// [from dept, from agent, to dept, to agent, message, what the brain did]
export const HV_ROUTES: Array<[string, string, string, string, string, string]> = [
  ['mieter', 'Posteingang', 'schaden', 'Schadensaufnahme', 'Wasserfleck an der Decke, {object}', 'Schaden angelegt'],
  ['schaden', 'Handwerker-Vergabe', 'mieter', 'Terminierung', '{craft} kommt Donnerstag 8–10 Uhr', 'Mieter informiert'],
  ['mieter', 'Telefon', 'miete', 'Mieteingänge', '{person} fragt nach der Oktobermiete', 'Kontostand geprüft'],
  ['miete', 'Mahnwesen', 'mieter', 'Antwort-Entwurf', '{person} ist 2 Monate im Rückstand', 'Schreiben entworfen'],
  ['vermietung', 'Mietverträge', 'miete', 'Kautionen', 'Neuer Mieter {object}, Kaution 2.850 €', 'Kautionskonto angelegt'],
  ['schaden', 'Rechnungsprüfung', 'nebenkosten', 'Kostenerfassung', 'Rechnung Gartenpflege {object} ist umlagefähig', 'als Betriebskosten gebucht'],
  ['nebenkosten', 'Abrechnung', 'mieter', 'Posteingang', 'Abrechnungen {object} versendet', 'Rückfragen erwartet'],
  ['mieter', 'Mieterportal', 'vermietung', 'Leerstand', 'Kündigung {person} zum 31.12.', 'Wohnung als frei gemeldet'],
  ['weg', 'Eigentümerversammlung', 'schaden', 'Handwerker-Vergabe', 'Beschluss: Dachsanierung {object} beauftragen', 'Angebote angefragt'],
  ['schaden', 'Versicherung', 'weg', 'Eigentümer-Reporting', 'Versicherung zahlt Leitungswasserschaden {object}', 'Eigentümer informiert'],
  ['miete', 'Objektkonten', 'weg', 'Rücklagen', 'Rücklage {object} unter Zielwert', 'Wirtschaftsplan vorgemerkt'],
  ['mieter', 'Eskalation', 'schaden', 'Technik-Lead', 'Heizungsausfall {object}, 8 Parteien', 'Notdienst alarmiert'],
  ['vermietung', 'Besichtigungen', 'mieter', 'Terminierung', 'Besichtigung {object} Samstag 11:00', 'Vormieter informiert'],
  ['nebenkosten', 'Einsprüche', 'miete', 'Belege', '{person} möchte Belegeinsicht', 'Belege bereitgestellt'],
]

// ---------------------------------------------------------------------------
// Who works where, and the systems behind them
// ---------------------------------------------------------------------------

export const HV_KIND_BY_NAME: Record<string, string> = {
  Mieterportal: 'chat',
  Schadensaufnahme: 'damages',
  'Handwerker-Vergabe': 'dispatch',
  Auftragsverfolgung: 'workorders',
  'Wartung & Prüfungen': 'maintenance',
  Versicherung: 'insurance',
  Rechnungsprüfung: 'craftinvoices',
  Leerstand: 'vacancies',
  Inserate: 'listings',
  Interessenten: 'applicants',
  Besichtigungen: 'viewings',
  Mietverträge: 'leases',
  Übergaben: 'handovers',
  Mieteingänge: 'rent',
  Kautionen: 'deposits',
  Objektkonten: 'cashflow',
  Zählerstände: 'meters',
  Kostenerfassung: 'costs',
  Abrechnung: 'statements',
  Vorauszahlungen: 'prepayments',
  Einsprüche: 'objections',
  Eigentümerversammlung: 'assemblies',
  Beschlüsse: 'resolutions',
  Wirtschaftsplan: 'businessplan',
  Rücklagen: 'reserves',
  'Eigentümer-Reporting': 'ownerreports',
  'Eigentümer-Anfragen': 'ownerrequests',
}

export const HV_WAITING_OWNER: Record<string, string[]> = {
  mieter: ['Antwort-Entwurf'],
  schaden: ['Handwerker-Vergabe'],
  vermietung: ['Mietverträge'],
  miete: ['Mahnwesen'],
  nebenkosten: ['Abrechnung'],
  weg: ['Eigentümerversammlung'],
}

export const HV_KPI_OWNER: Record<string, [string, string]> = {
  mieter: ['Posteingang', 'Telefon'],
  schaden: ['Schadensaufnahme', 'Auftragsverfolgung'],
  vermietung: ['Leerstand', 'Interessenten'],
  miete: ['Mieteingänge', 'Mahnwesen'],
  nebenkosten: ['Abrechnung', 'Abrechnung'],
  weg: ['Beschlüsse', 'Eigentümerversammlung'],
}

const ERP = 'Domus, Karthago, Immoware24'

export function hvSources(domain: string): Record<HvKind, Source> & Partial<Record<string, Source>> {
  return {
    // Shared kinds, re-dressed for the trade.
    chat: { system: 'Mieterportal und App', examples: 'Casavi, Facilioo, Immomio, WhatsApp Business', account: `portal.${domain}`, does: ['beantwortet Standardfragen sofort', 'nimmt Schäden mit Foto auf', 'schreibt jede Nachricht zum Mieter ins Gedächtnis'] },
    inbox: { system: 'E-Mail-Postfach', examples: 'Microsoft 365, Google Workspace, IMAP', account: `verwaltung@${domain}`, does: ['liest neue Mails alle 30 Minuten', 'ordnet sie Objekt und Mieter zu', 'legt Antworten als Entwurf an'] },
    calls: { system: 'Telefonanlage', examples: 'sipgate, Placetel, 3CX', account: '+49 30 000000', does: ['protokolliert jeden Anruf beim Mieter', 'erkennt Notfälle', 'legt Rückrufe als Aufgabe an'] },
    escalation: { system: 'Notfall-Regeln', examples: 'Posteingang, Portal, Telefon, Notdienst', account: domain, does: ['erkennt Heizungsausfall, Wasser, Strom', 'alarmiert Notdienst und Hausmeister', 'hält nach, bis es behoben ist'] },
    dunning: { system: 'Offene Posten', examples: ERP, account: `buchhaltung@${domain}`, does: ['erkennt Mietrückstände', 'schreibt Erinnerung und Mahnung', 'meldet Kündigungsrelevanz'] },
    receipts: { system: 'Kreditorenbelege', examples: `${ERP}, DATEV`, account: `belege@${domain}`, does: ['liest Rechnungen aus Mails', 'ordnet sie Objekt und Kostenart zu', 'bereitet die Zahlung vor'] },
    cashflow: { system: 'Objekt- und Treuhandkonten', examples: 'Hausbank über EBICS, FinAPI', account: 'DE00 0000 0000 0000 0000 00', does: ['liest alle Objektkonten täglich', 'warnt bei Unterdeckung', 'gleicht Hausgeld und Mieten ab'] },
    library: { system: 'Objektakte', examples: `${ERP}, SharePoint, DMS`, account: `akte.${domain}`, does: ['liest Verträge, Protokolle und Pläne ein', 'macht sie durchsuchbar', 'verknüpft sie mit Objekt und Einheit'] },
    contacts: { system: 'Mieter und Eigentümer', examples: ERP, account: `stammdaten.${domain}`, does: ['führt Mieter, Eigentümer und Handwerker zusammen', 'hält Stammdaten aktuell', 'verknüpft sie mit Einheiten'] },
    // Trade-specific kinds.
    damages: { system: 'Schadensmeldungen', examples: 'Mieterportal, Mail, Telefon, Casavi', account: `schaden@${domain}`, does: ['nimmt Schäden mit Fotos auf', 'schätzt Dringlichkeit und Gewerk', 'legt den Vorgang beim Objekt an'] },
    dispatch: { system: 'Handwerkerpool', examples: `${ERP}, Mail, Handwerkerportal`, account: `auftraege@${domain}`, does: ['holt Angebote ein', 'vergleicht Preis und Termin', 'beauftragt nach Freigabe'] },
    workorders: { system: 'Auftragsverwaltung', examples: `${ERP}, Facilioo`, account: `auftraege@${domain}`, does: ['fragt den Stand ab', 'koordiniert Termine mit Mietern', 'nimmt die Leistung ab'] },
    maintenance: { system: 'Wartungsplan', examples: `${ERP}, Prüfbücher`, account: `technik.${domain}`, does: ['überwacht Prüffristen', 'beauftragt Wartungen rechtzeitig', 'legt Prüfberichte ab'] },
    insurance: { system: 'Gebäudeversicherung', examples: 'Versicherer-Portal, Makler', account: `versicherung@${domain}`, does: ['meldet Schäden an den Versicherer', 'reicht Belege nach', 'verfolgt die Regulierung'] },
    craftinvoices: { system: 'Handwerkerrechnungen', examples: `${ERP}, DATEV`, account: `rechnungen@${domain}`, does: ['prüft Rechnung gegen Auftrag', 'erkennt Umlagefähigkeit', 'gibt zur Zahlung frei'] },
    vacancies: { system: 'Wohnungsbestand', examples: ERP, account: `bestand.${domain}`, does: ['meldet frei werdende Wohnungen', 'rechnet Leerstandskosten', 'schlägt Miete nach Mietspiegel vor'] },
    listings: { system: 'Immobilienportale', examples: 'ImmoScout24, Immowelt, Kleinanzeigen', account: `vermietung@${domain}`, does: ['schreibt Inserate mit Fotos', 'veröffentlicht auf allen Portalen', 'nimmt sie nach Vermietung offline'] },
    applicants: { system: 'Interessenten', examples: 'ImmoScout24, Immomio, Mail', account: `vermietung@${domain}`, does: ['beantwortet jede Anfrage', 'prüft Selbstauskunft und Unterlagen', 'sortiert nach Passung'] },
    viewings: { system: 'Besichtigungskalender', examples: 'Outlook, Immomio, Calendly', account: `besichtigung@${domain}`, does: ['lädt Interessenten ein', 'stimmt sich mit Vormietern ab', 'erinnert alle Seiten'] },
    leases: { system: 'Mietverträge', examples: `${ERP}, DocuSign`, account: `vertraege@${domain}`, does: ['erstellt Verträge aus Vorlagen', 'legt sie zur Freigabe vor', 'versendet zur Unterschrift'] },
    handovers: { system: 'Übergabeprotokolle', examples: 'Wohnungsübergabe-App, Tablet', account: `vermietung@${domain}`, does: ['bereitet das Protokoll vor', 'erfasst Zählerstände und Schlüssel', 'legt es in der Akte ab'] },
    rent: { system: 'Sollstellung und Bank', examples: `${ERP}, Hausbank über EBICS`, account: `miete@${domain}`, does: ['gleicht jede Miete ab', 'zieht Lastschriften ein', 'meldet Abweichungen'] },
    deposits: { system: 'Kautionskonten', examples: 'Hausbank, Kautionsversicherung', account: `kaution@${domain}`, does: ['legt Kautionskonten an', 'verfolgt Ratenzahlungen', 'rechnet bei Auszug ab'] },
    meters: { system: 'Messdienst', examples: 'Techem, ista, Brunata, Minol', account: `messdienst.${domain}`, does: ['übernimmt Verbrauchswerte', 'erkennt Ausreißer', 'fordert fehlende Werte an'] },
    costs: { system: 'Betriebskosten', examples: `${ERP}, DATEV`, account: `nebenkosten@${domain}`, does: ['ordnet Kosten der Kostenart zu', 'prüft Umlagefähigkeit', 'wählt den Verteilerschlüssel'] },
    statements: { system: 'Nebenkostenabrechnung', examples: ERP, account: `nebenkosten@${domain}`, does: ['erstellt Abrechnungen je Einheit', 'prüft Plausibilität zum Vorjahr', 'versendet nach Freigabe'] },
    prepayments: { system: 'Vorauszahlungen', examples: ERP, account: `nebenkosten@${domain}`, does: ['rechnet neue Vorauszahlungen', 'schreibt die Anpassung', 'stellt die Sollmiete um'] },
    objections: { system: 'Rückfragen und Einsprüche', examples: 'Postfach, Mieterportal', account: `nebenkosten@${domain}`, does: ['beantwortet Rückfragen zur Abrechnung', 'organisiert Belegeinsicht', 'korrigiert bei Fehlern'] },
    assemblies: { system: 'Eigentümerversammlungen', examples: `${ERP}, Teams, Zoom`, account: `weg@${domain}`, does: ['lädt fristgerecht ein', 'schreibt die Tagesordnung', 'protokolliert die Versammlung'] },
    resolutions: { system: 'Beschlusssammlung', examples: ERP, account: `weg@${domain}`, does: ['führt die Beschlusssammlung', 'verfolgt die Umsetzung', 'meldet Anfechtungsfristen'] },
    businessplan: { system: 'Wirtschaftsplan', examples: ERP, account: `weg@${domain}`, does: ['rechnet den Wirtschaftsplan', 'vergleicht mit dem Vorjahr', 'legt Hausgeld je Einheit fest'] },
    reserves: { system: 'Erhaltungsrücklagen', examples: `${ERP}, Rücklagenkonten`, account: `weg@${domain}`, does: ['bucht Zuführungen', 'vergleicht mit dem Instandhaltungsbedarf', 'warnt bei Unterdeckung'] },
    ownerreports: { system: 'Eigentümer-Berichte', examples: `${ERP}, Eigentümerportal`, account: `eigentuemer@${domain}`, does: ['schreibt Quartalsberichte', 'fasst Mieten, Kosten und Schäden zusammen', 'stellt sie ins Portal'] },
    ownerrequests: { system: 'Eigentümer-Anfragen', examples: 'Postfach, Eigentümerportal', account: `eigentuemer@${domain}`, does: ['beantwortet Fragen zu Hausgeld und Beschlüssen', 'stellt Unterlagen bereit', 'leitet Sonderwünsche weiter'] },
  }
}

export const HV_LAYOUT: Record<HvKind, { layout: Layout; columns?: string[] }> & Partial<Record<string, { layout: Layout; columns?: string[] }>> = {
  // Shared kinds whose columns read differently here.
  dunning: { layout: 'table', columns: ['Einheit', 'Mieter', 'Rückstand', 'Seit', 'Stufe'] },
  cashflow: { layout: 'table', columns: ['Objektkonto', 'Eingänge Monat', 'Ausgänge Monat', 'Stand'] },
  contacts: { layout: 'table', columns: ['Name', 'Objekt', 'Rolle', 'Letzter Kontakt'] },
  damages: { layout: 'list' },
  dispatch: { layout: 'list' },
  workorders: { layout: 'board', columns: ['Beauftragt', 'Termin steht', 'In Arbeit', 'Abgenommen'] },
  maintenance: { layout: 'table', columns: ['Anlage', 'Objekt', 'Nächste Prüfung', 'Status'] },
  insurance: { layout: 'list' },
  craftinvoices: { layout: 'table', columns: ['Rechnung', 'Handwerker', 'Objekt', 'Betrag', 'Status'] },
  vacancies: { layout: 'table', columns: ['Einheit', 'Größe', 'Kaltmiete', 'Frei ab', 'Stand'] },
  listings: { layout: 'list' },
  applicants: { layout: 'list' },
  viewings: { layout: 'calendar' },
  leases: { layout: 'list' },
  handovers: { layout: 'calendar' },
  rent: { layout: 'table', columns: ['Mieter', 'Einheit', 'Soll', 'Ist', 'Status'] },
  deposits: { layout: 'table', columns: ['Mieter', 'Einheit', 'Kaution', 'Stand'] },
  meters: { layout: 'table', columns: ['Objekt', 'Zähler', 'Einheiten', 'Stand'] },
  costs: { layout: 'table', columns: ['Kostenart', 'Objekt', 'Betrag', 'Schlüssel'] },
  statements: { layout: 'board', columns: ['Belege sammeln', 'In Arbeit', 'Prüfung', 'Versendet'] },
  prepayments: { layout: 'list' },
  objections: { layout: 'list' },
  assemblies: { layout: 'calendar' },
  resolutions: { layout: 'table', columns: ['Beschluss', 'WEG', 'Datum', 'Umsetzung'] },
  businessplan: { layout: 'table', columns: ['Position', 'Plan 2026', 'Plan 2027', 'Änderung'] },
  reserves: { layout: 'table', columns: ['WEG', 'Stand', 'Zuführung/Jahr', 'Ziel'] },
  ownerreports: { layout: 'list' },
  ownerrequests: { layout: 'list' },
}

// ---------------------------------------------------------------------------
// Placeholder records
// ---------------------------------------------------------------------------

export type Helpers = {
  n: (count: number, f: (i: number) => WsItem) => WsItem[]
  eur: (n: number) => string
  clock: (minutesAgo: number) => string
  later: (minutes: number) => string
  company: string
}

type Maker = (r: () => number, pick: <T>(xs: T[]) => T) => WsItem[]

export function hvMakers({ n, eur, clock, later, company }: Helpers): Partial<Record<string, Maker>> {
  const O = HV_OBJECTS
  const P = HV_PEOPLE
  const C = HV_CRAFTS
  const unit = (r: () => number) => `WE ${String(1 + Math.floor(r() * 16)).padStart(2, '0')}`

  return {
    inbox: (r, pick) =>
      [
        ['Wasserfleck an der Badezimmerdecke', 'Seit gestern ist an der Decke im Bad ein Fleck, der größer wird. Können Sie jemanden schicken?', 'Schaden'],
        ['Frage zur Nebenkostenabrechnung', 'In der Abrechnung sind die Kosten für den Hausmeister deutlich gestiegen. Woran liegt das?', 'Nebenkosten'],
        ['Kündigung meiner Wohnung', 'Hiermit kündige ich fristgerecht zum 31.12. Bitte bestätigen Sie den Eingang.', 'Vermietung'],
        ['Heizung kalt – ganzes Haus', 'Bei uns im Haus sind seit heute Morgen alle Heizkörper kalt.', 'Notfall'],
        ['Miete diesen Monat später', 'Wegen einer Gehaltsumstellung kommt die Miete diesmal zum 10. Ist das in Ordnung?', 'Buchhaltung'],
        ['Anfrage Eigentümer: Sonderumlage', 'Wie hoch fällt mein Anteil an der Sonderumlage für das Dach aus?', 'WEG'],
        ['Lärmbeschwerde Nachbarn', 'Die Nachbarn im 2. OG sind jede Nacht bis 2 Uhr laut.', 'Mieter'],
        ['Rechnung Winterdienst', 'Anbei unsere Rechnung für den Winterdienst Dezember bis März.', 'Belege'],
      ].map(([title, body, tag], i) => ({
        id: `m${i}`,
        title,
        sub: `${pick(P)} · ${pick(O)}, ${unit(r)}`,
        meta: clock(8 + i * 31 + Math.floor(r() * 20)),
        badge: { text: tag, tone: tag === 'Notfall' ? 'bad' : tag === 'Schaden' ? 'warn' : 'info' },
        body,
        fields: [['Vorschlag des Agenten', tag === 'Notfall' ? 'Notdienst Heizung alarmiert, Aushang an alle Mieter vorbereitet.' : `An ${tag} weitergeleitet, Antwortentwurf liegt bereit.`]],
        actions: ['Antworten', 'Weiterleiten', 'Erledigt'],
      })),
    chat: (r, pick) =>
      n(7, (i) => ({
        id: `c${i}`,
        title: `${pick(P)} · ${pick(O)}`,
        sub: pick(['Wann wird der Müll abgeholt?', 'Wo finde ich meine Abrechnung?', 'Der Aufzug steht wieder.', 'Kann ich einen zweiten Schlüssel bekommen?', 'Darf ich einen Balkonkraftwerk anbringen?', 'Wann kommt der Handwerker?']),
        meta: clock(4 + i * 21 + Math.floor(r() * 10)),
        badge: i === 2 ? { text: 'Schaden angelegt', tone: 'warn' } : { text: 'Beantwortet', tone: 'ok' },
        body: 'Der Agent hat mit Hausordnung, Mietvertrag und Objektakte geantwortet und die Nachricht beim Mieter abgelegt.',
        fields: [['Kanal', pick(['Mieterportal', 'App', 'WhatsApp'])], ['Antwortzeit', `${2 + Math.floor(r() * 30)} Sekunden`]],
        actions: ['Verlauf öffnen', 'Übernehmen'],
      })),
    calls: (r, pick) =>
      n(6, (i) => ({
        id: `t${i}`,
        title: `${pick(P)} · ${pick(O)}`,
        sub: pick(['Heizung fällt aus', 'Frage zur Mieterhöhung', 'Schlüssel verloren', 'Rückruf Handwerkertermin', 'Kündigung', 'Eigentümer: Hausgeld']),
        meta: clock(15 + i * 47 + Math.floor(r() * 20)),
        badge: i === 1 ? { text: 'Rückruf offen', tone: 'warn' } : { text: `${2 + Math.floor(r() * 9)} Min.`, tone: 'muted' },
        body: 'Zusammenfassung: Mieter meldet, dass die Heizung im Wohnzimmer nur lauwarm wird. Termin mit Heizungsbauer gewünscht, vormittags.',
        fields: [['Nächster Schritt', 'Schaden angelegt, an Technik übergeben'], ['Aufzeichnung', 'Transkript liegt beim Mieter']],
        actions: ['Zurückrufen', 'Transkript öffnen'],
      })),
    calendar: (r, pick) =>
      n(7, (i) => ({
        id: `k${i}`,
        title: pick(['Handwerkertermin', 'Wohnungsbesichtigung', 'Wohnungsübergabe', 'Begehung Objekt', 'Zählerablesung', 'Beiratssitzung']),
        sub: `${pick(P)} · ${pick(O)}`,
        meta: later(-120 + i * 75 + Math.floor(r() * 20)),
        badge: i < 2 ? { text: 'Vorbei', tone: 'muted' } : i === 3 ? { text: 'Unbestätigt', tone: 'warn' } : { text: 'Bestätigt', tone: 'ok' },
        body: 'Mieter, Handwerker und Hausmeister eingeladen, Erinnerung 24 Stunden vorher.',
        fields: [['Ort', pick(O)], ['Dauer', `${pick([30, 45, 60, 90])} Minuten`]],
        actions: ['Verschieben', 'Absagen'],
      })),
    drafts: (_r, pick) =>
      n(5, (i) => ({
        id: `d${i}`,
        title: `Re: ${pick(['Mieterhöhung nach Mietspiegel', 'Ihr Wasserschaden', 'Nebenkostenabrechnung 2025', 'Kündigungsbestätigung', 'Lärmbeschwerde'])}`,
        sub: `an ${pick(P)}`,
        meta: clock(25 + i * 40),
        badge: { text: 'Entwurf', tone: 'info' },
        body: `Sehr geehrte Damen und Herren,\n\nvielen Dank für Ihre Nachricht. Wir haben den Vorgang geprüft und melden uns bis Freitag mit einer verbindlichen Antwort.\n\nMit freundlichen Grüßen\n${company}`,
        actions: ['Freigeben', 'Ändern', 'Verwerfen'],
      })),
    escalation: () => [
      { id: 'e0', title: 'Heizungsausfall Parkallee 21', sub: 'Posteingang · 8 Parteien betroffen', badge: { text: 'Notfall', tone: 'bad' }, body: 'Notdienst Heizung Meyer ist unterwegs, Ankunft 11:30. Aushang an alle Mieter verschickt.', actions: ['Status ansehen'] },
      { id: 'e1', title: 'Frist: Einladung ETV Parkallee 21', sub: 'WEG · Versand bis Freitag', badge: { text: 'Mittel', tone: 'warn' }, body: 'Einladung liegt zur Freigabe vor, Frist nach WEG-Gesetz 3 Wochen.', actions: ['Zur Freigabe'] },
      { id: 'e2', title: 'Wasserschaden seit 3 Tagen ohne Termin', sub: 'Lindenstr. 12, WE 07', badge: { text: 'Mittel', tone: 'warn' }, body: 'Sanitär Kaya hat noch nicht bestätigt. Zweiter Betrieb angefragt.', actions: ['Nachfassen'] },
    ],
    damages: (r, pick) =>
      n(9, (i) => ({
        id: `sd${i}`,
        title: pick(['Wasserfleck Decke Bad', 'Heizkörper bleibt kalt', 'Fenster schließt nicht', 'Schimmel im Schlafzimmer', 'Klingelanlage defekt', 'Aufzug steht', 'Rohrverstopfung Küche', 'Treppenhauslicht aus']),
        sub: `${pick(O)}, ${unit(r)} · ${pick(P)}`,
        meta: clock(20 + i * 110 + Math.floor(r() * 40)),
        badge: i === 0 ? { text: 'Dringend', tone: 'bad' } : i < 4 ? { text: 'Neu', tone: 'info' } : { text: 'Beauftragt', tone: 'ok' },
        body: 'Aus den Fotos erkannt: Gewerk, Dringlichkeit und ob ein Versicherungsfall vorliegen könnte. Vorgang beim Objekt angelegt.',
        fields: [['Gewerk', pick(['Sanitär', 'Heizung', 'Elektro', 'Fenster', 'Aufzug'])], ['Fotos', `${1 + Math.floor(r() * 4)} vom Mieter`]],
        actions: ['Handwerker beauftragen', 'Rückfrage an Mieter'],
      })),
    dispatch: (r, pick) =>
      n(5, (i) => ({
        id: `hv${i}`,
        title: `${pick(['Dachrinne erneuern', 'Fassade ausbessern', 'Treppenhaus streichen', 'Heizungswartung', 'Klingelanlage tauschen'])} · ${pick(O)}`,
        sub: `${2 + Math.floor(r() * 2)} Angebote verglichen`,
        meta: eur(400 + Math.floor(r() * 40) * 100),
        badge: i === 0 ? { text: 'Freigabe', tone: 'warn' } : { text: 'Beauftragt', tone: 'ok' },
        body: 'Günstigstes vollständiges Angebot mit dem frühesten Termin vorgeschlagen.',
        fields: [['Empfehlung', pick(C)], ['Termin', `ab ${1 + Math.floor(r() * 20)}.10.`]],
        actions: ['Angebote ansehen', 'Beauftragen'],
      })),
    workorders: (r, pick) =>
      n(10, (i) => ({
        id: `wo${i}`,
        title: `${pick(['Wasserschaden', 'Heizung', 'Fenster', 'Aufzug', 'Rohrverstopfung', 'Elektrik'])} · ${pick(O)}`,
        col: ['Beauftragt', 'Termin steht', 'In Arbeit', 'Abgenommen'][i % 4],
        sub: pick(C),
        meta: `seit ${1 + Math.floor(r() * 12)} T`,
        badge: i === 4 ? { text: 'Keine Rückmeldung', tone: 'bad' } : undefined,
        body: 'Der Agent fragt den Stand beim Betrieb ab und stimmt den Termin mit dem Mieter ab.',
        actions: ['Auftrag öffnen', 'Nachfassen'],
      })),
    maintenance: () =>
      [
        ['Aufzug (TÜV)', 'Parkallee 21', '2.10.', 'Beauftragt'],
        ['Rauchwarnmelder', 'Lindenstr. 12', '15.10.', 'Geplant'],
        ['Heizungswartung', 'Birkenweg 3', '20.10.', 'Geplant'],
        ['Spielplatzprüfung', 'Gartenstr. 40', '3.11.', 'Geplant'],
        ['Legionellenprüfung', 'Hafenstr. 8', '12.9.', 'Erledigt'],
        ['Dachrinnenreinigung', 'Am Markt 5', '28.9.', 'Überfällig'],
      ].map((c, i) => ({
        id: `wa${i}`,
        title: c[0],
        cells: c,
        badge: c[3] === 'Überfällig' ? { text: 'Überfällig', tone: 'bad' } : c[3] === 'Erledigt' ? { text: 'Erledigt', tone: 'ok' } : { text: c[3], tone: 'info' },
        actions: ['Prüfbericht', 'Beauftragen'],
      })),
    insurance: (r, pick) =>
      n(4, (i) => ({
        id: `vs${i}`,
        title: `${pick(['Leitungswasserschaden', 'Sturmschaden Dach', 'Glasbruch Haustür', 'Überspannung Elektrik'])} · ${pick(O)}`,
        sub: `Schadennr. ${40812 + i * 37}`,
        meta: eur(800 + Math.floor(r() * 60) * 100),
        badge: i === 0 ? { text: 'Gemeldet', tone: 'info' } : i === 1 ? { text: 'Gutachter', tone: 'warn' } : { text: 'Reguliert', tone: 'ok' },
        body: 'Schadensmeldung mit Fotos, Handwerkerrechnung und Mieteraussage an den Versicherer übermittelt.',
        actions: ['Vorgang öffnen'],
      })),
    craftinvoices: (r) =>
      n(7, (i) => ({
        id: `hr${i}`,
        title: `R-${3310 + i}`,
        cells: [`R-${3310 + i}`, C[i % C.length], O[(i + 2) % O.length], eur(180 + Math.floor(r() * 40) * 50), i === 1 ? 'Abweichung' : i < 3 ? 'Geprüft' : 'Bezahlt'],
        badge: i === 1 ? { text: 'Abweichung', tone: 'bad' } : i < 3 ? { text: 'Geprüft', tone: 'info' } : { text: 'Bezahlt', tone: 'ok' },
        actions: ['Rechnung ansehen', 'Freigeben'],
      })),
    vacancies: (r) =>
      n(6, (i) => {
        const qm = 42 + Math.floor(r() * 70)
        return {
          id: `le${i}`,
          title: `${O[i % O.length]}, ${unit(r)}`,
          cells: [`${O[i % O.length]}, ${unit(r)}`, `${qm} m²`, eur(Math.round(qm * (9 + r() * 5))), i < 3 ? 'sofort' : `${1 + i}.12.`, i === 0 ? 'Vertrag' : i < 3 ? 'Besichtigung' : 'Gekündigt'],
          badge: i === 0 ? { text: 'Vertrag', tone: 'ok' } : i < 3 ? { text: 'Besichtigung', tone: 'info' } : { text: 'Gekündigt', tone: 'muted' },
          actions: ['Einheit öffnen', 'Inserat'],
        }
      }),
    listings: (r) =>
      n(4, (i) => ({
        id: `in${i}`,
        title: `${2 + (i % 3)}-Zimmer-Wohnung, ${O[(i + 1) % O.length]}`,
        sub: 'ImmoScout24 · Immowelt · Kleinanzeigen',
        meta: `${10 + Math.floor(r() * 90)} Aufrufe heute`,
        badge: { text: `${3 + Math.floor(r() * 20)} Anfragen`, tone: 'info' },
        body: 'Helle Wohnung mit Balkon, neu renoviert, Einbauküche, Keller. Text und Fotos aus der Objektakte.',
        actions: ['Inserat ansehen', 'Offline nehmen'],
      })),
    applicants: (r, pick) =>
      n(7, (i) => ({
        id: `ia${i}`,
        title: pick(['Laura Brandt', 'Tobias Engel', 'Familie Petrović', 'Sven Richter', 'Julia Haas', 'Kemal Aydın', 'Marie Vogt']),
        sub: `für ${O[i % 3 + 1]} · ${pick(['ImmoScout24', 'Immowelt', 'Empfehlung'])}`,
        meta: clock(30 + i * 80),
        badge: i < 2 ? { text: 'Unterlagen vollständig', tone: 'ok' } : i === 2 ? { text: 'SCHUFA fehlt', tone: 'warn' } : { text: `Passung ${60 + Math.floor(r() * 40)} %`, tone: 'info' },
        body: 'Selbstauskunft, Einkommensnachweis und Mietschuldenfreiheit geprüft.',
        actions: ['Zur Besichtigung einladen', 'Absagen'],
      })),
    viewings: (r, pick) =>
      n(6, (i) => ({
        id: `bs${i}`,
        title: `Besichtigung ${O[i % 3 + 1]}`,
        sub: `${2 + Math.floor(r() * 5)} Interessenten`,
        meta: later(60 + i * 180),
        badge: i === 0 ? { text: 'Heute', tone: 'info' } : { text: 'Bestätigt', tone: 'ok' },
        body: 'Einladungen verschickt, Vormieter informiert, Schlüssel beim Hausmeister.',
        fields: [['Treffpunkt', pick(['Haustür', 'Hof', 'Treppenhaus'])]],
        actions: ['Teilnehmer', 'Verschieben'],
      })),
    leases: (_r, pick) =>
      n(4, (i) => ({
        id: `mv${i}`,
        title: `Mietvertrag ${O[(i + 2) % O.length]}, WE 0${4 + i}`,
        sub: pick(['Laura Brandt', 'Sven Richter', 'Julia Haas', 'Familie Petrović']),
        meta: `Beginn 1.${11 + (i % 2)}.`,
        badge: i === 0 ? { text: 'Freigabe', tone: 'warn' } : i === 1 ? { text: 'Zur Unterschrift', tone: 'info' } : { text: 'Unterschrieben', tone: 'ok' },
        body: 'Aus der Vorlage erstellt: Miete, Nebenkostenvorauszahlung, Kaution, Hausordnung und Anlagen.',
        actions: ['Vertrag ansehen', 'Zur Unterschrift'],
      })),
    handovers: (_r, pick) =>
      n(4, (i) => ({
        id: `ug${i}`,
        title: `${i % 2 ? 'Auszug' : 'Einzug'} ${pick(O)}`,
        sub: pick(P),
        meta: later(200 + i * 900),
        badge: { text: 'Vorbereitet', tone: 'ok' },
        body: 'Protokoll mit Räumen, Zählern und Schlüsseln liegt auf dem Tablet bereit.',
        actions: ['Protokoll öffnen'],
      })),
    rent: (r) =>
      P.slice(0, 10).map((p, i) => {
        const soll = 620 + Math.floor(r() * 60) * 10
        const ist = i === 2 ? 0 : i === 6 ? soll - 150 : soll
        return {
          id: `mi${i}`,
          title: p,
          cells: [p, `${O[i % O.length]}, ${unit(r)}`, eur(soll), eur(ist), ist === soll ? 'Bezahlt' : ist === 0 ? 'Offen' : 'Teilzahlung'],
          badge: ist === soll ? { text: 'Bezahlt', tone: 'ok' } : ist === 0 ? { text: 'Offen', tone: 'bad' } : { text: 'Teilzahlung', tone: 'warn' },
          actions: ['Mieterkonto'],
        }
      }),
    dunning: (r) =>
      n(4, (i) => ({
        id: `du${i}`,
        title: P[(i * 3 + 2) % P.length],
        cells: [`${O[i]}, ${unit(r)}`, P[(i * 3 + 2) % P.length], eur(700 + Math.floor(r() * 20) * 100), `${1 + (i % 3)} Monate`, i === 0 ? '2. Mahnung' : 'Erinnerung'],
        badge: i === 0 ? { text: '2. Mahnung', tone: 'bad' } : { text: 'Erinnerung', tone: 'warn' },
        actions: ['Schreiben ansehen', 'Ratenzahlung anbieten'],
      })),
    deposits: (r) =>
      n(6, (i) => ({
        id: `ka${i}`,
        title: P[(i + 4) % P.length],
        cells: [P[(i + 4) % P.length], `${O[i % O.length]}, ${unit(r)}`, eur(1800 + Math.floor(r() * 20) * 100), i === 1 ? '2 von 3 Raten' : 'Vollständig'],
        badge: i === 1 ? { text: 'Raten', tone: 'info' } : { text: 'Vollständig', tone: 'ok' },
        actions: ['Kautionskonto'],
      })),
    receipts: (r, pick) =>
      n(8, (i) => ({
        id: `re${i}`,
        title: pick(['Winterdienst', 'Gartenpflege', 'Hausstrom', 'Wasser/Abwasser', 'Müllabfuhr', 'Gebäudeversicherung', 'Hausmeister', 'Aufzugswartung']),
        sub: `${pick(O)} · ${pick(['aus Mail', 'aus Handwerkerportal', 'Post gescannt'])}`,
        meta: eur(80 + Math.floor(r() * 2400)),
        badge: i === 3 ? { text: 'Objekt unklar', tone: 'warn' } : { text: 'Zugeordnet', tone: 'ok' },
        body: 'Beleg ausgelesen, Objekt und Kostenart erkannt, als umlagefähig markiert und zur Zahlung vorbereitet.',
        actions: ['Beleg ansehen'],
      })),
    cashflow: (r) =>
      O.map((o, i) => {
        const inn = 18000 + Math.floor(r() * 30000)
        const out = 9000 + Math.floor(r() * 20000)
        return { id: `ok${i}`, title: o, cells: [o, eur(inn), eur(out), eur(20000 + inn - out)], badge: i === 4 ? { text: 'knapp', tone: 'warn' } : undefined, actions: ['Kontoauszug'] }
      }),
    meters: (r) =>
      O.map((o, i) => ({
        id: `zs${i}`,
        title: o,
        cells: [o, pick3(i), String(6 + Math.floor(r() * 20)), i === 2 ? '3 Werte fehlen' : 'Vollständig'],
        badge: i === 2 ? { text: 'Werte fehlen', tone: 'warn' } : { text: 'Vollständig', tone: 'ok' },
        actions: ['Werte ansehen'],
      })),
    costs: (r) =>
      [
        ['Grundsteuer', 'Wohnfläche'],
        ['Wasser/Abwasser', 'Verbrauch'],
        ['Müllabfuhr', 'Personen'],
        ['Hausmeister', 'Wohnfläche'],
        ['Gebäudeversicherung', 'Wohnfläche'],
        ['Heizung', '70 % Verbrauch'],
      ].map(([k, s], i) => ({
        id: `ko${i}`,
        title: k,
        cells: [k, O[i % O.length], eur(900 + Math.floor(r() * 80) * 100), s],
        actions: ['Belege'],
      })),
    statements: (_r, pick) =>
      n(12, (i) => ({
        id: `nk${i}`,
        title: `${O[i % O.length]} · 2025`,
        col: ['Belege sammeln', 'In Arbeit', 'Prüfung', 'Versendet'][i % 4],
        sub: `${6 + (i % 5) * 3} Einheiten`,
        meta: pick(['Nachzahlung Ø 84 €', 'Guthaben Ø 57 €', 'Nachzahlung Ø 212 €']),
        badge: i === 1 ? { text: 'Freigabe', tone: 'warn' } : undefined,
        body: 'Kosten je Kostenart, Verteilerschlüssel, Verbrauchswerte und Vorjahresvergleich.',
        actions: ['Abrechnung öffnen'],
      })),
    prepayments: (r, pick) =>
      n(5, (i) => ({
        id: `vz${i}`,
        title: `${pick(P)} · ${pick(O)}`,
        sub: `Vorauszahlung ${eur(180 + i * 15)} → ${eur(180 + i * 15 + 10 + Math.floor(r() * 50))}`,
        meta: 'ab 1.1.',
        badge: { text: 'Berechnet', tone: 'info' },
        body: 'Neue Vorauszahlung aus der letzten Abrechnung und der Preisentwicklung, Schreiben an den Mieter vorbereitet.',
        actions: ['Schreiben ansehen'],
      })),
    objections: (_r, pick) =>
      n(4, (i) => ({
        id: `ew${i}`,
        title: pick(['Hausmeisterkosten zu hoch', 'Belegeinsicht gewünscht', 'Verteilerschlüssel falsch', 'Heizkosten unplausibel']),
        sub: `${pick(P)} · ${pick(O)}`,
        meta: clock(120 + i * 600),
        badge: i === 0 ? { text: 'In Klärung', tone: 'warn' } : { text: 'Beantwortet', tone: 'ok' },
        body: 'Antwort mit Belegen und Vorjahresvergleich entworfen. Bei einem Fehler wird die Abrechnung korrigiert.',
        actions: ['Antwort ansehen'],
      })),
    assemblies: () =>
      [
        ['ETV Parkallee 21', 'Dachsanierung, Wirtschaftsplan 2027', 24 * 60 * 18],
        ['ETV Am Markt 5', 'Verwalterbestellung, Fassade', 24 * 60 * 25],
        ['ETV Gartenstr. 40', 'Wallbox-Anträge, Jahresabrechnung', 24 * 60 * 31],
        ['Beiratssitzung Birkenweg 3', 'Belegprüfung', 24 * 60 * 6],
      ].map(([t, s, m], i) => ({
        id: `etv${i}`,
        title: String(t),
        sub: String(s),
        meta: later(Number(m)),
        badge: i === 0 ? { text: 'Einladung Freigabe', tone: 'warn' } : { text: 'Geplant', tone: 'ok' },
        body: 'Tagesordnung, Beschlussvorlagen und Vollmachten vorbereitet. Online-Teilnahme möglich.',
        actions: ['Tagesordnung', 'Einladung ansehen'],
      })),
    resolutions: () =>
      [
        ['Dachrinne erneuern', 'Birkenweg 3', '12.6.', 'Beauftragt'],
        ['Fassade streichen', 'Am Markt 5', '3.5.', 'Angebote'],
        ['Wallbox Stellplatz 4', 'Gartenstr. 40', '20.4.', 'Umgesetzt'],
        ['Hausordnung neu', 'Parkallee 21', '14.3.', 'Umgesetzt'],
        ['Sonderumlage Dach', 'Parkallee 21', '14.3.', 'Eingezogen'],
      ].map((c, i) => ({ id: `bs${i}`, title: c[0], cells: c, badge: c[3] === 'Angebote' ? { text: 'Offen', tone: 'warn' } : { text: c[3], tone: 'ok' }, actions: ['Protokoll'] })),
    businessplan: () =>
      [
        ['Hausgeld gesamt', 148000, 156500],
        ['Erhaltungsrücklage', 24000, 30000],
        ['Versicherungen', 11200, 12400],
        ['Hausmeister', 18600, 19100],
        ['Energie', 41000, 38500],
      ].map(([t, a, b], i) => ({
        id: `wp${i}`,
        title: String(t),
        cells: [String(t), eur(a as number), eur(b as number), `${(((b as number) / (a as number) - 1) * 100).toFixed(1).replace('.', ',')} %`],
        actions: ['Details'],
      })),
    reserves: (r) =>
      O.map((o, i) => {
        const stand = 40000 + Math.floor(r() * 200) * 1000
        const ziel = stand + (i === 4 ? 60000 : -10000 + Math.floor(r() * 30) * 1000)
        return { id: `rl${i}`, title: o, cells: [o, eur(stand), eur(6000 + Math.floor(r() * 20) * 1000), eur(ziel)], badge: i === 4 ? { text: 'unter Ziel', tone: 'warn' } : undefined, actions: ['Konto'] }
      }),
    ownerreports: (_r, pick) =>
      n(4, (i) => ({
        id: `eb${i}`,
        title: `Quartalsbericht ${['Q3', 'Q3', 'Q2', 'Q2'][i]} · ${pick(O)}`,
        sub: 'Mieten, Kosten, Schäden, Leerstand',
        meta: i < 2 ? 'Entwurf' : '5.7.',
        badge: i < 2 ? { text: 'In Arbeit', tone: 'info' } : { text: 'Im Portal', tone: 'ok' },
        body: 'Mieteingang 98 %, zwei Schäden reguliert, keine Leerstände, Rücklage im Plan.',
        actions: ['Bericht öffnen'],
      })),
    ownerrequests: (_r, pick) =>
      n(5, (i) => ({
        id: `ea${i}`,
        title: pick(['Anteil Sonderumlage?', 'Jahresabrechnung Hausgeld', 'Vermietung meiner Wohnung', 'Protokoll letzte ETV', 'Wallbox beantragen']),
        sub: `${pick(['Herr Albrecht', 'Frau Lorenz', 'Herr Jansen', 'Frau Krause'])} · ${pick(O)}`,
        meta: clock(60 + i * 300),
        badge: i === 0 ? { text: 'Offen', tone: 'warn' } : { text: 'Beantwortet', tone: 'ok' },
        body: 'Antwort aus Beschlusssammlung, Wirtschaftsplan und Teilungserklärung.',
        actions: ['Antworten'],
      })),
    library: (r, pick) =>
      n(10, (i) => ({
        id: `lib${i}`,
        title: `${pick(['Mietvertrag', 'Übergabeprotokoll', 'Teilungserklärung', 'ETV-Protokoll', 'Energieausweis', 'Grundriss', 'Wartungsvertrag'])} · ${pick(O)}`,
        sub: pick(['PDF', 'Scan', 'Word']),
        meta: clock(60 + i * 400 + Math.floor(r() * 60)),
        body: 'Eingelesen, durchsuchbar und mit Objekt, Einheit und Mieter verknüpft.',
        actions: ['Öffnen'],
      })),
    contacts: () =>
      [...P.slice(0, 7), ...C.slice(0, 3)].map((p, i) => ({
        id: `ct${i}`,
        title: p,
        cells: [p, O[i % O.length], i < 5 ? 'Mieter' : i < 7 ? 'Eigentümer' : 'Handwerker', clock(200 + i * 900)],
        actions: ['Kontakt öffnen'],
      })),
    protocols: (r, pick) =>
      n(8, (i) => ({
        id: `pr${i}`,
        title: `${pick(['Begehung', 'Mietergespräch', 'Beiratssitzung', 'Handwerker-Abstimmung', 'Wohnungsübergabe'])} · ${pick(O)}`,
        sub: `${pick(['vor Ort', 'Telefon', 'Teams'])} · ${10 + Math.floor(r() * 40)} Min.`,
        meta: clock(90 + i * 300),
        body: 'Zusammenfassung, Entscheidungen und Aufgaben — automatisch aus dem Gespräch gezogen und beim Objekt abgelegt.',
        fields: [['Aufgaben', `${1 + Math.floor(r() * 4)} angelegt`]],
        actions: ['Protokoll öffnen'],
      })),
  }
}

function pick3(i: number) {
  return ['Wärme', 'Kaltwasser', 'Warmwasser'][i % 3]
}
