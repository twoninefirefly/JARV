import bormannLogo from './kunden/bormann.png?inline'

/**
 * Personalised demos for one prospect: name, logo and trade in one place.
 *
 * `?kunde=bormann` picks one and the browser remembers it; `?kunde=` clears it.
 * A build can bake one in with `VITE_KUNDE=bormann`, for hosts that drop the
 * query string. The logo is inlined, so the page stays a single bundle.
 */

export type Kunde = { name: string; logo: string; branche: 'standard' | 'hausverwaltung' }

export const KUNDEN: Record<string, Kunde> = {
  bormann: { name: 'Bormann Immobilien', logo: bormannLogo, branche: 'hausverwaltung' },
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
  if (id === null || id === undefined) id = import.meta.env.VITE_KUNDE as string | undefined
  return (id && KUNDEN[id.toLowerCase()]) || null
}

export const KUNDE = read()
