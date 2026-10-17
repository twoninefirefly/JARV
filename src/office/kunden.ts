import bormannLogo from './kunden/bormann.png?inline'

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
}

export const KUNDEN: Record<string, Kunde> = {
  bormann: { name: 'Bormann Immobilien', logo: bormannLogo, mark: [92, 0, 233, 283], chef: 'Martin Bormann', chef2: 'Kim Bormann', branche: 'hausverwaltung' },
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
