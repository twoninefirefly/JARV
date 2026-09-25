import { BRANCHE } from './branche'
import { COMPANY, DEPARTMENTS } from './data'

/**
 * Who works in the office, and who may decide what.
 *
 * Two areas: the team, where everyone signs in once and then decides what
 * belongs to their department; and management ("Leitung"), which can decide
 * everything, signs off what needs a signature, and sees the sensitive
 * overviews nobody else does.
 *
 * In this demo it all runs in the browser — names, passwords and permissions
 * ship with the page. The real thing checks every one of them on the server.
 */

export type Role = 'leitung' | 'team'

export type User = {
  id: string
  name: string
  title: string
  role: Role
  /** Departments whose decisions this person may take. Management: all. */
  depts: string[]
  initials: string
}

const HV = BRANCHE === 'hausverwaltung'
const initials = (name: string) =>
  name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
const u = (id: string, name: string, title: string, role: Role, depts: string[]): User => ({ id, name, title, role, depts, initials: initials(name) })

const all = DEPARTMENTS.map((d) => d.id)

export const USERS: User[] = HV
  ? [
      u('leitung', COMPANY.chef ?? 'Maria Schneider', 'Geschäftsführung', 'leitung', all),
      u('amueller', 'Anna Müller', 'Mietbuchhaltung & Nebenkosten', 'team', ['miete', 'nebenkosten']),
      u('jweber', 'Jonas Weber', 'Technik & Handwerker', 'team', ['schaden']),
      u('skrueger', 'Sabine Krüger', 'Vermietung', 'team', ['vermietung']),
      u('lschroeder', 'Lea Schröder', 'Mieterkommunikation', 'team', ['mieter']),
      u('thoffmann', 'Tim Hoffmann', 'WEG-Verwaltung', 'team', ['weg']),
    ]
  : [
      u('leitung', COMPANY.chef ?? 'Maria Schneider', 'Geschäftsführung', 'leitung', all),
      u('amueller', 'Anna Müller', 'Finanzen & Verwaltung', 'team', ['finanzen']),
      u('jweber', 'Jonas Weber', 'Vertrieb', 'team', ['vertrieb']),
      u('skrueger', 'Sabine Krüger', 'Kommunikation', 'team', ['kommunikation']),
      u('lschroeder', 'Lea Schröder', 'Content & Marketing', 'team', ['content', 'marketing']),
      u('thoffmann', 'Tim Hoffmann', 'Technik', 'team', ['technik']),
    ]

/** Demo password for every login. The real one is personal and never in the page. */
export const DEMO_PASSWORD = 'demo'

/** Decisions that need management's signature, whoever's department they are in. */
const LEITUNG_ONLY = new Set(
  HV
    ? ['Mietvertrag Hafenstr. 8, WE 04 freigeben', 'Auftrag Dachrinne Birkenweg 3 (1.840 €) freigeben']
    : ['Angebot #118 an Kanzlei Brandt freigeben', 'Monatsbericht August durchsehen'],
)

export const needsLeitung = (text: string) => LEITUNG_ONLY.has(text)

/** Whether this person may decide this item — and if not, why, in a sentence. */
export function mayDecide(user: User | null, deptId: string | undefined, text: string): { ok: boolean; why?: string } {
  if (!user) return { ok: false, why: 'Bitte zuerst anmelden.' }
  if (user.role === 'leitung') return { ok: true }
  if (LEITUNG_ONLY.has(text)) return { ok: false, why: 'Braucht die Unterschrift der Leitung. Sie sieht es in ihrem Bereich und gibt es dort frei.' }
  if (deptId && user.depts.includes(deptId)) return { ok: true }
  const who = USERS.filter((x) => x.role === 'team' && deptId && x.depts.includes(deptId)).map((x) => x.name)
  return { ok: false, why: `Zuständig ist ${who.join(' oder ') || 'die Abteilung'}. Sie können es ansehen, aber nicht freigeben.` }
}

export type Decision = { text: string; dept: string; by: string; name: string; at: string; result: 'Freigegeben' | 'Abgelehnt' }

/** What the team decided earlier today, so management's overview is never empty in a demo. */
export const HISTORY: Decision[] = HV
  ? [
      { text: 'Zahlungserinnerung Am Markt 5, WE 09', dept: 'miete', by: 'amueller', name: 'Anna Müller', at: '08:12', result: 'Freigegeben' },
      { text: 'Handwerkertermin Sanitär Kaya, Lindenstr. 12', dept: 'schaden', by: 'jweber', name: 'Jonas Weber', at: '08:47', result: 'Freigegeben' },
      { text: 'Besichtigung Hafenstr. 8 – 6 Einladungen', dept: 'vermietung', by: 'skrueger', name: 'Sabine Krüger', at: '09:05', result: 'Freigegeben' },
      { text: 'Antwort Lärmbeschwerde Gartenstr. 40', dept: 'mieter', by: 'lschroeder', name: 'Lea Schröder', at: '09:31', result: 'Freigegeben' },
      { text: 'Sonderumlage Dach – Anschreiben', dept: 'weg', by: 'thoffmann', name: 'Tim Hoffmann', at: '09:58', result: 'Abgelehnt' },
      { text: 'Auftrag Heizungswartung Birkenweg 3 (2.380 €)', dept: 'schaden', by: 'leitung', name: COMPANY.chef ?? 'Maria Schneider', at: '10:20', result: 'Freigegeben' },
    ]
  : [
      { text: 'Zahlungserinnerung Rechnung 2026-871', dept: 'finanzen', by: 'amueller', name: 'Anna Müller', at: '08:15', result: 'Freigegeben' },
      { text: 'Follow-up an Hotel Seeblick', dept: 'vertrieb', by: 'jweber', name: 'Jonas Weber', at: '08:52', result: 'Freigegeben' },
      { text: 'Antwort an Praxis Dr. Vogel', dept: 'kommunikation', by: 'skrueger', name: 'Sabine Krüger', at: '09:20', result: 'Freigegeben' },
      { text: 'Karussell „3 Tipps“ veröffentlichen', dept: 'content', by: 'lschroeder', name: 'Lea Schröder', at: '09:44', result: 'Abgelehnt' },
      { text: 'Angebot #117 an Autohaus Krüger', dept: 'vertrieb', by: 'leitung', name: COMPANY.chef ?? 'Maria Schneider', at: '10:05', result: 'Freigegeben' },
    ]

/** Figures only management sees. */
export const SENSITIVE: Array<{ value: string; label: string; note: string }> = HV
  ? [
      { value: '412.380 €', label: 'Mieteingang September', note: '98 % der Sollmiete' },
      { value: '8.940 €', label: 'Mietrückstände gesamt', note: '7 Mieter, 1 mit 2 Monaten' },
      { value: '1,84 Mio. €', label: 'Objekt- und Treuhandkonten', note: 'alle gedeckt, Am Markt 5 knapp' },
      { value: '2,31 Mio. €', label: 'Erhaltungsrücklagen (14 WEGs)', note: '1 WEG unter Zielwert' },
      { value: '38.600 €', label: 'Verwalterhonorare im Monat', note: '+4 % zum Vorjahr' },
      { value: '2', label: 'Offene Rechtsfälle', note: 'Räumungsklage, Mietminderung' },
    ]
  : [
      { value: '186.400 €', label: 'Umsatz September', note: '+8 % zum Vormonat' },
      { value: '23.900 €', label: 'Offene Forderungen', note: '4 Rechnungen überfällig' },
      { value: '94.200 €', label: 'Kontostand heute', note: 'Prognose 90 Tage stabil' },
      { value: '312.000 €', label: 'Pipeline-Wert', note: '12 Deals, 4 in Verhandlung' },
      { value: '61.500 €', label: 'Personalkosten im Monat', note: 'im Plan' },
      { value: '31 %', label: 'Marge', note: 'Ziel 30 %' },
    ]

export const deptName = (id: string) => DEPARTMENTS.find((d) => d.id === id)?.short ?? id
