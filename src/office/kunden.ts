import bormannLogo from './kunden/bormann.png?inline'
import hukicLogo from './kunden/hukic.png?inline'

/**
 * Personalised demos for one prospect: name, logo and trade in one place.
 *
 * `?kunde=bormann` picks one and the browser remembers it; `?kunde=` clears it.
 * For hosts that drop the query string, a build can make one the face of the
 * Hausverwaltung demo with `VITE_HV_KUNDE=bormann`, while "Firma" stays the
 * neutral example. The logo is inlined, so the page stays a single bundle.
 */

export type Kunde = {
  name: string
  logo: string
  /** Where the bare mark sits inside the logo image, [x, y, w, h] — used on the landing pad. */
  mark?: [number, number, number, number]
  /** Who signs in to the management area. */
  chef?: string
  /** A second person in management. */
  chef2?: string
  branche: 'standard' | 'hausverwaltung'
  /** A group of companies. With one, the WEG floor becomes the holding's (gruppe.ts). */
  gruppe?: Gruppe
  /** The brand colour, read off the logo, for the accents that carry the customer's identity. */
  farbe?: string
  /** Where letters are dated. Set only where a source names the seat; otherwise the letters keep „Musterstadt“. */
  ort?: string
}

export type Gesellschaft = {
  name: string
  /** Short name for log lines and tight table cells. */
  kurz: string
  register: string
  /** What the company does in the group. Read off its name and the network, so an assumption until confirmed. */
  aufgabe: string
  /** The shareholder above it, as drawn in the network. */
  mutter?: string
  /** Where the line to `mutter` comes from: a register source, or only the network graph. */
  mutterQuelle?: 'register' | 'grafik'
  /** Whether the register entry was confirmed in a source, or only seen in a search snippet. */
  belegt: boolean
  /** What is still open about this company, shown with its record so nobody reads more into it than the sources say. */
  hinweis?: string
}

export type Gruppe = {
  gesellschaften: Gesellschaft[]
  /** The group's own service company, which joins the pool of tradesmen. */
  service?: string
  /** Where the register data came from, shown beside it. */
  quelle: string
}

// A build made for one customer (VITE_HV_KUNDE) leaves the others out, so a
// sales preview never ships another prospect's name or logo. The value is read
// bare, without a method call, so the bundler can fold the conditions and drop
// the unused entry together with its inlined logo. Dev, the neutral build and
// the `?kunde=` switch keep every customer.
const ONLY = import.meta.env.VITE_HV_KUNDE

const bormann: Kunde = {
  name: 'Bormann Immobilien',
  logo: bormannLogo,
  mark: [92, 0, 233, 283],
  chef: 'Martin Bormann',
  chef2: 'Kim Bormann',
  branche: 'hausverwaltung',
  farbe: '#9f5b47',
}

// Register data from the agent office's live research (public/buero.html),
// shareholder lines from the network graph. MH 11's number came from a
// search snippet only, so it stays marked unconfirmed.
const hukic: Kunde = {
  name: 'Hukic Gruppe',
  logo: hukicLogo,
  mark: [94, 6, 224, 268],
  chef: 'Kenan Hukic',
  branche: 'hausverwaltung',
  farbe: '#3d8a9a',
  // The research found Sitz Berlin for all six companies.
  ort: 'Berlin',
  gruppe: {
    quelle: 'Registerrecherche Agenten-Büro, 16.10.2026',
    service: 'Huck Service GmbH',
    gesellschaften: [
      { name: 'Hukic Holding GmbH', kurz: 'Holding', register: 'AG Charlottenburg, HRB 176694 B', aufgabe: 'Holding', belegt: true },
      // Only this line has a source naming the Holding as Gesellschafterin; the
      // two below it are drawn in the network graph and nowhere else.
      { name: 'Muki Immobilien GmbH', kurz: 'Muki Immobilien', register: 'AG Charlottenburg, HRB 173776 B', aufgabe: 'Bestand', mutter: 'Hukic Holding GmbH', mutterQuelle: 'register', belegt: true },
      { name: 'Hukic Immobilien UG (haftungsbeschränkt)', kurz: 'Hukic Immobilien', register: 'AG Charlottenburg, HRB 215022 B', aufgabe: 'Bestand', mutter: 'Muki Immobilien GmbH', mutterQuelle: 'grafik', belegt: true },
      { name: 'Huck Service GmbH', kurz: 'Huck Service', register: 'AG Charlottenburg, HRB 161560 B', aufgabe: 'Service & Hausmeister', mutter: 'Hukic Holding GmbH', mutterQuelle: 'grafik', belegt: true },
      {
        name: 'MH 11 GmbH',
        kurz: 'MH 11',
        register: 'AG Charlottenburg, HRB 222653 B',
        aufgabe: 'Komplementärin der KG',
        belegt: false,
        hinweis: 'Registernummer nur aus Suchtreffer, nicht in der gespeicherten Recherche',
      },
      {
        name: 'HUKIC Real Estate GmbH & Co. KG',
        kurz: 'HUKIC Real Estate',
        register: 'AG Charlottenburg, HRA 57928',
        aufgabe: 'Objektgesellschaft Wohnen',
        mutter: 'MH 11 GmbH',
        mutterQuelle: 'register',
        belegt: true,
        // One partner holds one membership, so the snippet cannot be right on both counts.
        hinweis: 'Treffer nennt MH 11 als Komplementärin und Kommanditistin – Registerauszug klärt',
      },
    ],
  },
}

export const KUNDEN: Record<string, Kunde> = {
  ...(!ONLY || ONLY === 'bormann' ? { bormann } : {}),
  ...(!ONLY || ONLY === 'hukic' ? { hukic } : {}),
}

const KEY = 'office.kunde'

function read(): Kunde | null {
  const params = new URLSearchParams(location.search)
  let id: string | null | undefined = params.get('kunde')
  try {
    if (id !== null) {
      if (id) localStorage.setItem(KEY, id)
      else localStorage.removeItem(KEY)
    } else {
      id = localStorage.getItem(KEY)
    }
  } catch {
    // Storage can be blocked; the link still works for this visit.
  }
  return (id && KUNDEN[id.toLowerCase()]) || null
}

/** Chosen by link: fixes the trade and hides the switch. */
export const KUNDE = read()

/** Built in: shown whenever the Hausverwaltung demo runs without a choice of its own. */
export const HV_KUNDE: Kunde | null = KUNDEN[String(import.meta.env.VITE_HV_KUNDE ?? '').toLowerCase()] ?? null
