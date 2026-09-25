import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { COMPANY } from './data'
import { BRANCHE } from './branche'
import { useOffice } from './state'

/**
 * The setup plan: how the office gets from this demo to a customer's real
 * work, step by step, with what we do and what they bring.
 *
 * It sits inside the demo so the pitch can go straight from "this is what it
 * does" to "this is how we get there", and prints to a clean PDF to send on.
 */

const HV = BRANCHE === 'hausverwaltung'

/** Printing is blocked inside a sandboxed frame (the hosted demo), so the button only shows where it works. */
const canPrint = (() => {
  try {
    return window.self === window.top
  } catch {
    return false
  }
})()

const SYSTEMS = HV
  ? ['E-Mail-Postfächer (Microsoft 365, Google, IMAP)', 'Hausverwaltungssoftware (Domus, Karthago, Immoware24 …)', 'Bankkonten und Objektkonten (EBICS, FinAPI)', 'Mieter- und Eigentümerportal (Casavi, Facilioo …)', 'Telefonanlage', 'Messdienst (Techem, ista, Brunata …)', 'Immobilienportale (ImmoScout24, Immowelt)', 'Dokumentenablage / DMS']
  : ['E-Mail-Postfächer (Microsoft 365, Google, IMAP)', 'CRM (HubSpot, Pipedrive …)', 'Buchhaltung (lexoffice, sevDesk, DATEV)', 'Bankkonten', 'Kalender und Telefonanlage', 'Projekt- und Ticket-Tools', 'Social-Media- und Werbekonten', 'Dokumentenablage']

const STEPS: Array<{ title: string; when: string; we: string[]; you: string[] }> = [
  {
    title: 'Aufnahme',
    when: 'Woche 1',
    we: [
      'Abläufe jeder Abteilung aufnehmen: Was kommt rein, wer entscheidet, was geht raus',
      'Systeme, Postfächer und Zugänge erfassen',
      `Ihre Vorlagen und 20–50 echte, versendete Schreiben einsammeln${HV ? ' (Mahnungen, Abrechnungen, Antworten an Mieter …)' : ''}`,
    ],
    you: ['Zwei Workshops à 2 Stunden mit den Abteilungsleitungen', 'Beispielschreiben und Vorlagen bereitstellen'],
  },
  {
    title: 'Anbindung',
    when: 'Woche 2–3',
    we: [
      'Systeme anbinden – zuerst nur lesend',
      'Vertrag zur Auftragsverarbeitung (DSGVO) vor dem ersten Datensatz',
      'Anmeldung für jede Person im Team und für die Leitung: wer sieht was, wer gibt was frei',
      'Das Agenten-Büro startet morgens mit dem Rechner – einmal anmelden, dann gemerkt',
    ],
    you: ['Zugänge über Ihre IT oder den Hersteller freigeben', 'Auftragsverarbeitungsvertrag unterschreiben'],
  },
  {
    title: 'Vorlagen & Regeln',
    when: 'Woche 3–4',
    we: [
      'Ihre Vorlagen übernehmen und vereinheitlichen – Ihr Wortlaut, Ihr Briefkopf',
      'Freigaberegeln festlegen: was immer, was nach der Testphase automatisch, was nie',
      'Ton und Stil für freie Antworten aus Ihren echten Schreiben lernen',
    ],
    you: ['Vorlagen einmal abnehmen', `Rechtlich heikle Vorlagen einmal prüfen lassen${HV ? ' (Anwalt oder Verband)' : ''}`],
  },
  {
    title: 'Schattenbetrieb',
    when: 'Woche 4–6',
    we: ['Die Agenten bereiten alles vor – Ihr Team versendet noch selbst', 'Jeden Unterschied zwischen Entwurf und Versand auswerten und nachschärfen', 'Wöchentlicher Stand: Trefferquote je Bereich'],
    you: ['Feedback mit einem Klick: passt / passt nicht', 'Kurzer wöchentlicher Termin (30 Min.)'],
  },
  {
    title: 'Stufenweiser Start',
    when: 'ab Woche 6',
    we: ['Standardfälle laufen automatisch, heikle Schreiben weiter mit Freigabe', 'Bereich für Bereich, erst wenn die Trefferquote stimmt', 'Schreibzugriff erst jetzt, pro Bereich freigeschaltet'],
    you: ['Freigaben im Agenten-Büro erteilen – am Rechner oder am Handy'],
  },
  {
    title: 'Übergabe & Betreuung',
    when: 'laufend',
    we: ['Schulung Ihres Teams', 'Fester Ansprechpartner', 'Monatlicher Bericht: was lief, was gespart wurde', 'Neue Vorlagen und Abläufe, wenn Sie sie brauchen'],
    you: ['Wünsche und neue Abläufe melden'],
  },
]

const RULES = HV
  ? [
      { tone: 'warn', title: 'Immer mit Ihrer Freigabe', items: ['Mahnungen', 'Mieterhöhungen', 'Nebenkostenabrechnungen', 'Einladungen zur Eigentümerversammlung', 'Handwerkeraufträge ab einem Betrag, den Sie festlegen'] },
      { tone: 'ok', title: 'Nach der Testphase automatisch', items: ['Eingangsbestätigungen', 'Handwerker- und Ablesetermine an Mieter', 'Antworten auf Standardfragen (Müll, Schlüssel, Hausordnung)', 'Zuordnung von Belegen und Zahlungen'] },
      { tone: 'bad', title: 'Nie automatisch', items: ['Kündigungen und Räumung', 'Anwalts- und Gerichtssachen', 'Streit mit Versicherungen', 'Alles, was Sie ausschließen'] },
    ]
  : [
      { tone: 'warn', title: 'Immer mit Ihrer Freigabe', items: ['Angebote', 'Mahnungen', 'Newsletter und Veröffentlichungen', 'Ausgaben ab einem Betrag, den Sie festlegen'] },
      { tone: 'ok', title: 'Nach der Testphase automatisch', items: ['Eingangsbestätigungen', 'Terminbestätigungen', 'Standardfragen im Chat', 'Zuordnung von Belegen und Zahlungen'] },
      { tone: 'bad', title: 'Nie automatisch', items: ['Kündigungen', 'Verträge', 'Rechtsstreitigkeiten', 'Alles, was Sie ausschließen'] },
    ]

const SAFETY = [
  'Vertrag zur Auftragsverarbeitung nach DSGVO, bevor die erste Mail gelesen wird',
  'Zugänge zuerst nur lesend – schreiben dürfen die Agenten erst nach dem Schattenbetrieb',
  'Jede Aktion protokolliert: wer hat was wann freigegeben',
  'Zwei Bereiche: das Team entscheidet in seinen Abteilungen, die Leitung unterschreibt und sieht die sensiblen Zahlen',
  'Jede Freigabe mit Namen und Uhrzeit – nachvollziehbar, wer was entschieden hat',
  'Jederzeit abschaltbar – Ihr Team kann alles wie bisher selbst erledigen',
]

export default function Setup() {
  const open = useOffice((s) => s.setup)
  const close = useOffice((s) => s.showSetup)
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && close(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open, close])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="setup-backdrop"
            className="ws-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            onClick={() => close(false)}
          />
          <motion.section
            key="setup"
            className="ws setup"
            role="dialog"
            aria-modal="true"
            aria-label="Einrichtung"
            initial={{ opacity: 0, y: 30, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, pointerEvents: 'none', transition: { duration: 0.18 } }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
          >
            <header className="ws-head">
              <span className="sheet__icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 6h16M4 12h10M4 18h6M17 15l2 2 4-4" />
                </svg>
              </span>
              <div className="ws-head__title">
                <h2>So wird Ihr Agenten-Büro eingerichtet</h2>
                <div className="eyebrow">{COMPANY.name} · in 6 Schritten · 4–8 Wochen</div>
              </div>
              {canPrint && (
                <button className="btn btn--small setup__print" onClick={() => window.print()}>
                  Als PDF speichern
                </button>
              )}
              <button className="icon-btn" onClick={() => close(false)} aria-label="Einrichtung schließen">
                ✕
              </button>
            </header>

            <div className="setup__body">
              {COMPANY.logo && <img className="setup__logo" src={COMPANY.logo} alt={COMPANY.name} />}
              <p className="body body--lead">
                Wir richten alles ein, Ihr Team arbeitet in der Zeit weiter wie gewohnt. Die Agenten übernehmen erst, wenn sie im Schattenbetrieb gezeigt haben,
                dass sie es können – und alles Wichtige geht weiter über Ihren Tisch.
              </p>

              <ol className="setup__steps">
                {STEPS.map((s, i) => (
                  <li key={s.title}>
                    <span className="setup__num">{i + 1}</span>
                    <div>
                      <div className="setup__steptitle">
                        <b>{s.title}</b>
                        <span className="eyebrow">{s.when}</span>
                      </div>
                      <div className="setup__cols">
                        <div>
                          <span className="eyebrow">Wir</span>
                          <ul>
                            {s.we.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <span className="eyebrow">Sie</span>
                          <ul>
                            {s.you.map((x) => (
                              <li key={x}>{x}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>

              <h3 className="setup__h">Was rausgeht – und wer es freigibt</h3>
              <div className="setup__rules">
                {RULES.map((r) => (
                  <div key={r.title} className={`setup__rule setup__rule--${r.tone}`}>
                    <b>{r.title}</b>
                    <ul>
                      {r.items.map((x) => (
                        <li key={x}>{x}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="ws-note">
                Jedes Schreiben kommt aus Ihrer eigenen Vorlage. Die Agenten setzen nur Namen, Beträge und Fristen aus Ihren Systemen ein – und Sie sehen vor
                der Freigabe genau, was eingesetzt wurde.
              </p>

              <div className="setup__two">
                <div>
                  <h3 className="setup__h">Was angebunden wird</h3>
                  <ul className="setup__list">
                    {SYSTEMS.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="setup__h">Sicherheit & Datenschutz</h3>
                  <ul className="setup__list">
                    {SAFETY.map((x) => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  )
}
