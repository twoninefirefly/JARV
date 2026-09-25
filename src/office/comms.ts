import { useEffect } from 'react'
import { DEPARTMENTS } from './data'
import { useOffice } from './state'
import { BRANCHE } from './branche'
import { HV_CRAFTS, HV_OBJECTS, HV_PEOPLE, HV_ROUTES } from './hausverwaltung'

/**
 * The agents talking to each other, through the brain.
 *
 * Every message leaves one department, passes the brain — which files it and
 * decides who needs it — and lands with the right colleague elsewhere. This
 * is the part a customer never sees in a chatbot: work moving between
 * departments without anyone forwarding it.
 */

export type Message = {
  id: number
  from: { dept: string; agent: string }
  to: { dept: string; agent: string }
  text: string
  /** What the brain did with it. */
  filed: string
  time: string
}

const FIRMS = ['Kanzlei Brandt', 'Schmidt & Co.', 'Weber Immobilien', 'Hotel Seeblick', 'Autohaus Krüger', 'Praxis Dr. Vogel']
const PEOPLE = ['Anna Weber', 'Jonas Schmidt', 'Lea Fischer', 'Paul Wagner', 'Mia Becker']

// [from dept, from agent, to dept, to agent, message, what the brain did]
const BASE_ROUTES: Array<[string, string, string, string, string, string]> = [
  ['kommunikation', 'Posteingang', 'vertrieb', 'Lead-Wache', 'Neue Anfrage von {firm}', 'als Lead einsortiert'],
  ['kommunikation', 'Posteingang', 'finanzen', 'Belege', 'Rechnung von {firm} im Postfach', 'Beleg zugeordnet'],
  ['vertrieb', 'Nach-Call', 'finanzen', 'Rechnungen', 'Auftrag {firm} gewonnen, bitte Rechnung vorbereiten', 'Rechnungsentwurf angelegt'],
  ['vertrieb', 'Pipeline', 'marketing', 'Kampagnen', '3 neue Leads kamen aus der Herbst-Kampagne', 'Kampagne bewertet'],
  ['content', 'Auswertung', 'marketing', 'Anzeigen', 'Reel „Einblick“ läuft 3× besser als der Schnitt', 'als Anzeige vorgeschlagen'],
  ['technik', 'Tickets', 'kommunikation', 'Antwort-Entwurf', 'Ticket #2291 gelöst, Kunde informieren', 'Antwort entworfen'],
  ['kommunikation', 'Telefon', 'technik', 'Tickets', '{person} meldet: Login geht nicht', 'Ticket angelegt'],
  ['finanzen', 'Mahnwesen', 'vertrieb', 'Vertriebs-Lead', '{firm} zahlt seit 14 Tagen nicht', 'im CRM vermerkt'],
  ['marketing', 'Newsletter', 'content', 'Texte', 'Brauche 3 Themen für den Oktober-Newsletter', 'Themen geliefert'],
  ['kommunikation', 'Terminierung', 'vertrieb', 'Call-Briefing', 'Termin mit {firm} morgen 10:00 bestätigt', 'Briefing eingeplant'],
  ['technik', 'Monitoring', 'kommunikation', 'Eskalation', 'Telefonanlage antwortet langsam', 'Team informiert'],
  ['finanzen', 'Liquidität', 'marketing', 'Budget', 'Werbebudget Oktober freigegeben: 6.000 €', 'Budget verteilt'],
  ['content', 'Veröffentlichung', 'kommunikation', 'Chat', 'Reel ist live, Fragen im Chat erwartet', 'Antworten vorbereitet'],
  ['vertrieb', 'Lead-Wache', 'kommunikation', 'Terminierung', '{firm} möchte ein Erstgespräch', 'Terminvorschläge verschickt'],
]

const HV = BRANCHE === 'hausverwaltung'
const ROUTES = HV ? HV_ROUTES : BASE_ROUTES

let seq = 0

function make(i: number, at: Date): Message {
  const [fd, fa, td, ta, text, filed] = ROUTES[i % ROUTES.length]
  const people = HV ? HV_PEOPLE : PEOPLE
  const fill = (s: string) =>
    s
      .replace('{firm}', FIRMS[(i * 7) % FIRMS.length])
      .replace('{person}', people[(i * 3) % people.length])
      .replace('{object}', HV_OBJECTS[(i * 5) % HV_OBJECTS.length])
      .replace('{craft}', HV_CRAFTS[(i * 2) % HV_CRAFTS.length])
  return {
    id: ++seq,
    from: { dept: fd, agent: fa },
    to: { dept: td, agent: ta },
    text: fill(text),
    filed,
    time: `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
  }
}

export const deptOf = (id: string) => DEPARTMENTS.find((d) => d.id === id)

/** Starts the traffic once the office is unlocked; one message every few seconds. */
export function useComms(running: boolean) {
  const post = useOffice((s) => s.post)
  useEffect(() => {
    if (!running) return
    const now = Date.now()
    // A short backlog, so the feed is never empty on first look.
    for (let k = 6; k >= 1; k--) post(make(k * 5, new Date(now - k * 4 * 60_000)), false)
    let i = 0
    const t = setInterval(() => post(make(i++, new Date()), true), 4200)
    return () => clearInterval(t)
  }, [running, post])
}
