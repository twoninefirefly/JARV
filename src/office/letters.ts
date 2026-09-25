import { COMPANY } from './data'

/**
 * The letters and mails an agent prepares for approval, as they would go out.
 *
 * Every one is a fixed template: the wording is the customer's (replaced by
 * their own templates during setup), and the agent only fills in the fields —
 * name, unit, amount, dates — from the connected systems. `[[…]]` marks those
 * fields, so the preview can show exactly what the agent put in.
 */

export type Letter = {
  channel: 'Brief' | 'E-Mail' | 'Portal'
  /** Which template this came from. */
  template: string
  /** Recipient: address lines for a letter, the address for a mail. */
  to: string[]
  subject: string
  salutation: string
  body: string[]
  /** Who signs: the department. */
  from: string
  attachments?: string[]
  /** Legal basis the template relies on, shown under the letter. */
  basis?: string
}

const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

/** A date `days` from today, written out: „9. Oktober 2026“. */
export function day(days = 0, now = new Date()) {
  const d = new Date(now.getTime() + days * 86_400_000)
  return `${d.getDate()}. ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
/** The month `offset` months from now: „September 2026“. */
function month(offset = 0, now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}
const eur = (n: number) => `${n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const f = (s: string | number) => `[[${s}]]`

/** „Fam. Yilmaz“ → „Sehr geehrte Familie Yilmaz,“ */
function greet(person: string) {
  if (person.startsWith('Fam. ')) return `Sehr geehrte Familie ${f(person.slice(5))},`
  if (person.startsWith('Frau ')) return `Sehr geehrte ${f(person)},`
  if (person.startsWith('Herr ')) return `Sehr geehrter ${f(person)},`
  return `Guten Tag ${f(person)},`
}
const IBAN = 'DE12 3456 7890 1234 5678 90'

// ---------------------------------------------------------------------------
// Hausverwaltung
// ---------------------------------------------------------------------------

type Tenant = { person: string; object: string; unit: string }

function address({ person, object, unit }: Tenant) {
  return [person, `${object}, ${unit}`, '12345 Musterstadt']
}

export function reminder(t: Tenant & { rent: number }): Letter {
  return {
    channel: 'Brief',
    template: 'Zahlungserinnerung Miete',
    to: address(t),
    subject: `Zahlungserinnerung – Miete ${f(month(0))}, ${f(`${t.object}, ${t.unit}`)}`,
    salutation: greet(t.person),
    body: [
      `bei der Durchsicht Ihres Mietkontos haben wir festgestellt, dass die Miete für ${f(month(0))} in Höhe von ${f(eur(t.rent))} noch nicht bei uns eingegangen ist. Fällig war sie am ${f(`3. ${month(0)}`)}.`,
      `Sicher handelt es sich um ein Versehen. Bitte überweisen Sie den offenen Betrag bis zum ${f(day(10))} auf das Ihnen bekannte Mietkonto:`,
      `IBAN ${f(IBAN)} · Verwendungszweck ${f(`Miete ${t.unit} ${t.object}`)}`,
      'Hat sich Ihre Zahlung mit diesem Schreiben überschnitten, betrachten Sie es bitte als gegenstandslos. Wenn Sie gerade in einer schwierigen Lage sind, sprechen Sie uns bitte an – gemeinsam finden wir meist eine Lösung, zum Beispiel eine Ratenzahlung.',
    ],
    from: 'Mietbuchhaltung',
  }
}

export function dunning2(t: Tenant & { rent: number; months: number }): Letter {
  const total = t.rent * t.months
  return {
    channel: 'Brief',
    template: 'Mahnung Miete, Stufe 2',
    to: address(t),
    subject: `2. Mahnung – Mietrückstand ${f(eur(total))}, ${f(`${t.object}, ${t.unit}`)}`,
    salutation: greet(t.person),
    body: [
      `trotz unserer Zahlungserinnerung vom ${f(day(-21))} ist Ihr Mietkonto weiterhin im Rückstand. Offen sind die Mieten für ${f(`${month(-1)} und ${month(0)}`)} über insgesamt ${f(eur(total))}.`,
      `Wir bitten Sie dringend, den Rückstand bis spätestens ${f(day(10))} auszugleichen:`,
      `IBAN ${f(IBAN)} · Verwendungszweck ${f(`Rückstand ${t.unit} ${t.object}`)}`,
      'Bitte beachten Sie: Ein Zahlungsrückstand in dieser Höhe kann den Vermieter zur fristlosen Kündigung des Mietverhältnisses berechtigen. Dazu soll es nicht kommen.',
      'Wenn Sie den Betrag nicht auf einmal zahlen können, melden Sie sich bitte bis zu diesem Datum bei uns. Wir bieten Ihnen dann gern eine Ratenzahlung an.',
    ],
    from: 'Mietbuchhaltung',
    basis: '§ 543 Abs. 2 Nr. 3 BGB (fristlose Kündigung bei Zahlungsverzug)',
  }
}

export function prepayment(t: Tenant & { before: number; after: number }): Letter {
  return {
    channel: 'Brief',
    template: 'Anpassung Betriebskostenvorauszahlung',
    to: address(t),
    subject: `Anpassung Ihrer Betriebskostenvorauszahlung ab ${f('1. Januar')}`,
    salutation: greet(t.person),
    body: [
      `auf Grundlage der Betriebskostenabrechnung ${f('2025')} passen wir Ihre monatliche Vorauszahlung an die tatsächlichen Kosten an. So vermeiden wir hohe Nachzahlungen im nächsten Jahr.`,
      `Bisherige Vorauszahlung: ${f(eur(t.before))} · neue Vorauszahlung ab ${f('1. Januar')}: ${f(eur(t.after))}`,
      `Ihre Gesamtmiete ändert sich damit um ${f(eur(t.after - t.before))} im Monat. Wenn Sie uns ein SEPA-Lastschriftmandat erteilt haben, ziehen wir den neuen Betrag automatisch ein; einen Dauerauftrag passen Sie bitte selbst an.`,
    ],
    from: 'Nebenkosten',
    attachments: ['Betriebskostenabrechnung 2025'],
    basis: '§ 560 Abs. 4 BGB',
  }
}

export function statementCover(t: Tenant & { result: number }): Letter {
  const pay = t.result > 0
  return {
    channel: 'Brief',
    template: 'Anschreiben Betriebskostenabrechnung',
    to: address(t),
    subject: `Betriebskostenabrechnung ${f('1.1.–31.12.2025')}, ${f(`${t.object}, ${t.unit}`)}`,
    salutation: greet(t.person),
    body: [
      `anbei erhalten Sie die Betriebskostenabrechnung für den Zeitraum ${f('1. Januar bis 31. Dezember 2025')}.`,
      pay
        ? `Ihre Vorauszahlungen haben die Kosten nicht ganz gedeckt. Es ergibt sich eine Nachzahlung von ${f(eur(t.result))}. Bitte überweisen Sie den Betrag bis zum ${f(day(30))} auf das Mietkonto IBAN ${f(IBAN)}.`
        : `Es ergibt sich ein Guthaben von ${f(eur(-t.result))} zu Ihren Gunsten. Wir überweisen es in den nächsten Tagen auf Ihr bei uns hinterlegtes Konto.`,
      'Gern können Sie die Belege nach Terminvereinbarung bei uns einsehen. Fragen beantworten wir telefonisch, per Mail oder im Mieterportal.',
    ],
    from: 'Nebenkosten',
    attachments: ['Betriebskostenabrechnung 2025', 'Heizkostenabrechnung des Messdienstes'],
    basis: '§ 556 Abs. 3 BGB (Abrechnung innerhalb von 12 Monaten)',
  }
}

export function craftOrder(o: { craft: string; object: string; job: string; amount: number; no: string }): Letter {
  const mail = `auftrag@${o.craft.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '')}.de`
  return {
    channel: 'E-Mail',
    template: 'Handwerkerauftrag',
    to: [mail],
    subject: `Auftrag ${f(o.no)} – ${f(o.job)}, ${f(o.object)}`,
    salutation: 'Sehr geehrte Damen und Herren,',
    body: [
      `vielen Dank für Ihr Angebot. Hiermit beauftragen wir Sie mit folgender Leistung:`,
      `Objekt: ${f(o.object)} · Leistung: ${f(o.job)} · Auftragssumme laut Angebot: ${f(eur(o.amount))} brutto`,
      `Bitte stimmen Sie den Termin direkt mit unserem Hausmeister ${f('Herrn Kaiser, 0170 0000000')} ab. Betroffene Mieter informieren wir, sobald der Termin steht.`,
      `Bitte schicken Sie die Rechnung nach Abnahme mit der Auftragsnummer ${f(o.no)} an rechnungen@… – ohne Auftragsnummer können wir sie nicht zuordnen.`,
    ],
    from: 'Technik',
    attachments: ['Angebot des Handwerkers', 'Fotos der Schadensmeldung'],
  }
}

export function etvInvite(o: { object: string; date: string; agenda: string[] }): Letter {
  return {
    channel: 'Brief',
    template: 'Einladung Eigentümerversammlung',
    to: ['An alle Eigentümerinnen und Eigentümer', `der WEG ${o.object}`],
    subject: `Einladung zur ordentlichen Eigentümerversammlung der WEG ${f(o.object)}`,
    salutation: 'Sehr geehrte Eigentümerinnen und Eigentümer,',
    body: [
      `hiermit laden wir Sie herzlich ein zur ordentlichen Eigentümerversammlung am ${f(o.date)}, ${f('18:00 Uhr')}, im ${f('Gemeinschaftsraum des Objekts')}. Eine Teilnahme per Video ist möglich; den Link erhalten Sie nach Anmeldung.`,
      `Tagesordnung:\n${o.agenda.map((a, i) => `${i + 1}. ${f(a)}`).join('\n')}`,
      'Wenn Sie nicht teilnehmen können, lassen Sie sich gern mit der beiliegenden Vollmacht vertreten. Die Beschlussvorlagen und Angebote finden Sie im Eigentümerportal.',
    ],
    from: 'WEG-Verwaltung',
    attachments: ['Vollmacht', 'Beschlussvorlagen', 'Wirtschaftsplan 2027 (Entwurf)'],
    basis: '§ 24 Abs. 4 WEG (Einladungsfrist mindestens 3 Wochen)',
  }
}

export function rentIncreaseReply(t: Tenant): Letter {
  return {
    channel: 'E-Mail',
    template: 'Antwort Rückfrage Mieterhöhung',
    to: [`${t.person.replace(/^(Fam\.|Frau|Herr) /, '').toLowerCase()}@mail.de`],
    subject: `Re: Mieterhöhung ${f(`${t.object}, ${t.unit}`)}`,
    salutation: greet(t.person),
    body: [
      'vielen Dank für Ihre Nachricht und Ihre Fragen zur angekündigten Mieterhöhung.',
      `Die Nettokaltmiete steigt von ${f('7,90 €/m²')} auf ${f('8,60 €/m²')}. Damit liegt sie innerhalb der ortsüblichen Vergleichsmiete laut Mietspiegel ${f('2025')} für Wohnungen dieser Größe, Lage und Ausstattung. Die Kappungsgrenze von ${f('15 %')} in drei Jahren ist eingehalten.`,
      `Sie haben bis zum ${f('30. November')} Zeit, der Erhöhung zuzustimmen. Die neue Miete gilt dann ab ${f('1. Dezember')}. Gern erläutern wir Ihnen die Einordnung in den Mietspiegel auch telefonisch.`,
    ],
    from: 'Mieterkommunikation',
    basis: '§§ 558, 558b BGB',
  }
}

export function leaseCover(t: Tenant & { start: string; rent: number }): Letter {
  return {
    channel: 'E-Mail',
    template: 'Mietvertrag zur Unterschrift',
    to: [`${t.person.replace(/^(Fam\.|Frau|Herr) /, '').toLowerCase().replace(/ /g, '.')}@mail.de`],
    subject: `Ihr Mietvertrag – ${f(`${t.object}, ${t.unit}`)}`,
    salutation: greet(t.person),
    body: [
      `wir freuen uns, Ihnen die Wohnung ${f(`${t.object}, ${t.unit}`)} ab dem ${f(t.start)} vermieten zu dürfen.`,
      `Anbei erhalten Sie den Mietvertrag zur digitalen Unterschrift. Die Gesamtmiete beträgt ${f(eur(t.rent))} monatlich, die Kaution drei Nettokaltmieten; sie kann in drei Raten gezahlt werden.`,
      `Den Termin für die Wohnungsübergabe schlagen wir Ihnen vor, sobald der Vertrag unterschrieben ist.`,
    ],
    from: 'Vermietung',
    attachments: ['Mietvertrag', 'Hausordnung', 'Energieausweis'],
  }
}

export function tenantReply(t: Tenant & { topic: string; from?: string }): Letter {
  return {
    channel: 'E-Mail',
    template: 'Antwort an Mieter',
    to: [`${t.person.replace(/^(Fam\.|Frau|Herr) /, '').toLowerCase()}@mail.de`],
    subject: `Re: ${f(t.topic)}`,
    salutation: greet(t.person),
    body: [
      `vielen Dank für Ihre Nachricht zu ${f(t.topic)}. Wir haben uns den Vorgang für ${f(`${t.object}, ${t.unit}`)} angesehen.`,
      `${f('Der zuständige Kollege prüft das und meldet sich bis Freitag mit einer verbindlichen Antwort.')} Den Stand können Sie jederzeit im Mieterportal verfolgen.`,
    ],
    from: t.from ?? 'Mieterkommunikation',
  }
}

// ---------------------------------------------------------------------------
// Standard office
// ---------------------------------------------------------------------------

export function invoiceReminder(o: { firm: string; no: string; amount: number; days: number; stage: 1 | 2 }): Letter {
  return {
    channel: 'E-Mail',
    template: o.stage === 1 ? 'Zahlungserinnerung Rechnung' : 'Mahnung Rechnung, Stufe 2',
    to: [`buchhaltung@${o.firm.toLowerCase().replace(/[^a-zäöü]+/g, '-').replace(/^-|-$/g, '')}.de`],
    subject: `${o.stage === 1 ? 'Zahlungserinnerung' : '2. Mahnung'} – Rechnung ${f(o.no)}`,
    salutation: 'Sehr geehrte Damen und Herren,',
    body: [
      `unsere Rechnung ${f(o.no)} über ${f(eur(o.amount))} ist seit ${f(`${o.days} Tagen`)} fällig. Ein Zahlungseingang ist bei uns bisher nicht verbucht.`,
      `Bitte überweisen Sie den Betrag bis zum ${f(day(7))} auf unser Konto IBAN ${f(IBAN)}.`,
      o.stage === 1
        ? 'Sollten Sie die Zahlung bereits veranlasst haben, betrachten Sie diese Nachricht bitte als gegenstandslos.'
        : 'Nach Ablauf dieser Frist müssen wir Verzugszinsen berechnen. Bei Fragen zur Rechnung melden Sie sich bitte direkt bei uns.',
    ],
    from: 'Buchhaltung',
    attachments: [`Rechnung ${o.no}`],
    basis: o.stage === 2 ? '§ 288 BGB (Verzugszinsen)' : undefined,
  }
}

export function offerCover(o: { firm: string; person: string; no: string; amount: number }): Letter {
  return {
    channel: 'E-Mail',
    template: 'Angebot versenden',
    to: [`${o.person.toLowerCase().replace(/ /g, '.')}@${o.firm.toLowerCase().replace(/[^a-zäöü]+/g, '-').replace(/^-|-$/g, '')}.de`],
    subject: `Ihr Angebot ${f(o.no)}`,
    salutation: `Guten Tag ${f(o.person)},`,
    body: [
      `vielen Dank für das gute Gespräch. Wie besprochen erhalten Sie anbei unser Angebot ${f(o.no)} über ${f(eur(o.amount))} netto.`,
      `Es enthält ${f('Einrichtung, Schulung Ihres Teams und die Betreuung in den ersten drei Monaten')}. Das Angebot gilt bis zum ${f(day(30))}.`,
      'Ich melde mich in der kommenden Woche kurz bei Ihnen, um offene Fragen zu klären.',
    ],
    from: 'Vertrieb',
    attachments: [`Angebot ${o.no}`],
  }
}

export function customerReply(o: { person: string; topic: string }): Letter {
  return {
    channel: 'E-Mail',
    template: 'Antwort an Kunden',
    to: [`${o.person.toLowerCase().replace(/ /g, '.')}@mail.de`],
    subject: `Re: ${f(o.topic)}`,
    salutation: `Guten Tag ${f(o.person)},`,
    body: [
      `vielen Dank für Ihre Nachricht zu ${f(o.topic)}. Wir haben uns das angesehen.`,
      `${f('Die Lieferung ist heute rausgegangen und kommt morgen bei Ihnen an.')} Für die Verzögerung bitten wir um Entschuldigung.`,
    ],
    from: 'Kundenservice',
  }
}

// ---------------------------------------------------------------------------

/** The letter behind each decision waiting in the office, by its text. */
export function approvalLetter(text: string): Letter | undefined {
  const map: Record<string, () => Letter> = {
    // Hausverwaltung
    'Antwort an Fam. Yilmaz zur Mieterhöhung freigeben': () => rentIncreaseReply({ person: 'Fam. Yilmaz', object: 'Lindenstr. 12', unit: 'WE 03' }),
    'Auftrag Dachrinne Birkenweg 3 (1.840 €) freigeben': () => craftOrder({ craft: 'Dachdecker Brandt', object: 'Birkenweg 3', job: 'Dachrinne straßenseitig erneuern', amount: 1840, no: 'A-2026-311' }),
    'Mietvertrag Hafenstr. 8, WE 04 freigeben': () => leaseCover({ person: 'Frau Haas', object: 'Hafenstr. 8', unit: 'WE 04', start: '1. November', rent: 1085 }),
    '2. Mahnung an Mieter Lindenstr. 12 freigeben': () => dunning2({ person: 'Herr Schulte', object: 'Lindenstr. 12', unit: 'WE 07', rent: 845, months: 2 }),
    'Nebenkostenabrechnungen Birkenweg 3 (3 Stück) freigeben': () => statementCover({ person: 'Frau Nowak', object: 'Birkenweg 3', unit: 'WE 02', result: 84.2 }),
    'Einladung ETV Parkallee 21 freigeben': () =>
      etvInvite({ object: 'Parkallee 21', date: day(24), agenda: ['Jahresabrechnung 2025', 'Wirtschaftsplan 2027', 'Dachsanierung: Beschluss über die Angebote', 'Entlastung des Verwaltungsbeirats', 'Verschiedenes'] }),
    // Standard office
    'Antwort an Kunde Weber freigeben': () => customerReply({ person: 'Anna Weber', topic: 'Ihre Lieferung' }),
    'Angebot #118 an Kanzlei Brandt freigeben': () => offerCover({ firm: 'Kanzlei Brandt', person: 'Jonas Brandt', no: '#118', amount: 14500 }),
    'Follow-up an Schmidt & Co. freigeben': () => ({ ...customerReply({ person: 'Jonas Schmidt', topic: 'unser Gespräch am Dienstag' }), template: 'Follow-up nach Gespräch' }),
  }
  return map[text]?.()
}

// ---------------------------------------------------------------------------
// Mail merge: one letter per recipient, for the post
// ---------------------------------------------------------------------------

const OWNERS = [
  'Herr Albrecht', 'Frau Lorenz', 'Herr Jansen', 'Frau Krause', 'Fam. Petersen', 'Herr Dr. Brandt', 'Frau Wagner',
  'Herr Keller', 'Fam. Yıldız', 'Frau Sommer', 'Herr Richter', 'Frau Engel', 'Herr Vogt', 'Fam. Lange',
]
const unitNo = (i: number) => `WE ${String(i + 1).padStart(2, '0')}`

/** The owners' meeting invitation, once per owner, each with their own unit and salutation. */
function etvBatch(o: { object: string; date: string; agenda: string[] }): Letter[] {
  const base = etvInvite(o)
  return OWNERS.map((p, i) => ({ ...base, to: [p, `${o.object}, ${unitNo(i)}`, '12345 Musterstadt'], salutation: greet(p) }))
}

/** Service-charge statements for one building, one per tenant with their own result. */
function statementBatch(object: string): Letter[] {
  return [
    ['Frau Nowak', 84.2],
    ['Herr Becker', -57.4],
    ['Fam. Kowalski', 212.9],
  ].map(([person, result], i) => statementCover({ person: String(person), object, unit: unitNo(i + 1), result: Number(result) }))
}

/** Decisions whose letter goes to many people at once. */
export function approvalBatch(text: string): Letter[] | undefined {
  if (text === 'Einladung ETV Parkallee 21 freigeben')
    return etvBatch({ object: 'Parkallee 21', date: day(24), agenda: ['Jahresabrechnung 2025', 'Wirtschaftsplan 2027', 'Dachsanierung: Beschluss über die Angebote', 'Entlastung des Verwaltungsbeirats', 'Verschiedenes'] })
  if (text === 'Nebenkostenabrechnungen Birkenweg 3 (3 Stück) freigeben') return statementBatch('Birkenweg 3')
  return undefined
}

/** Who signs, for the footer of a letter. */
export const signature = (l: Letter) => `${COMPANY.name} · ${l.from}`
