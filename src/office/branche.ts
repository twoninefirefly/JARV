/**
 * Which industry the office is dressed for.
 *
 * `?branche=hausverwaltung` (or `#hausverwaltung`) picks it from a link; the
 * switch on the lock screen remembers the choice in the browser, which is what
 * works on hosts that drop the query string. Everything else reads `BRANCHE`
 * once at load, so switching reloads the page.
 */

import { HV_KUNDE, KUNDE } from './kunden'

export type Branche = 'standard' | 'hausverwaltung'

export const BRANCHEN: Array<{ id: Branche; label: string }> = [
  { id: 'standard', label: 'Firma' },
  { id: 'hausverwaltung', label: 'Hausverwaltung' },
]

const KEY = 'office.branche'
const valid = (v: string | null | undefined): v is Branche => BRANCHEN.some((b) => b.id === v)

function read(): Branche {
  // A customer demo is always dressed for that customer's trade.
  if (KUNDE) return KUNDE.branche
  const fromUrl = new URLSearchParams(location.search).get('branche') ?? location.hash.slice(1)
  if (valid(fromUrl)) return fromUrl
  // A build made for a customer (VITE_HV_KUNDE) opens as that customer, on any
  // device and any fresh link — nothing left over in the browser can undo that.
  if (HV_KUNDE) return HV_KUNDE.branche
  try {
    const stored = localStorage.getItem(KEY)
    if (valid(stored)) return stored
  } catch {
    // Storage can be blocked; the default is fine then.
  }
  return 'standard'
}

export const BRANCHE: Branche = read()

export function setBranche(b: Branche) {
  try {
    localStorage.setItem(KEY, b)
  } catch {
    // Without storage the link parameter still works.
  }
  const url = new URL(location.href)
  if (url.searchParams.has('branche')) url.searchParams.set('branche', b)
  url.hash = ''
  history.replaceState(null, '', url.toString())
  location.reload()
}
