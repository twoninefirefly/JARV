import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useIsPresent } from 'framer-motion'

/**
 * One stack for every dialog in the office: the work window, the signature
 * and confirmation on top of it, print, reply, search, colour, setup and the
 * Leitung area.
 *
 * Each dialog used to listen for Escape on its own, so one key press closed
 * the confirmation and the window under it together — mid-pitch, at the
 * signature. Here only the dialog on top hears Escape. Focus moves into a
 * dialog when it opens and back to whatever opened it when it closes, and
 * everything behind it is inert, so Tab never wanders into the top bar, the
 * side panel or the 3D badges.
 */

type Entry = {
  el: HTMLElement
  close: RefObject<() => void>
  closable: RefObject<boolean>
}

const stack: Entry[] = []

/** True while any dialog is open; the office's own shortcuts stand back then. */
export const isModalOpen = () => stack.length > 0

/**
 * Never made inert: the backdrops stay clickable to close, an emergency
 * notice stays reachable, the lock screen can always come down, and live
 * regions keep announcing (an inert status is not read out).
 */
const KEEP = '.ws-backdrop, .sig__backdrop, .notice, .lock, [aria-live]'

/** How many open dialogs hold each element inert; only the last one lets it go. */
const holds = new Map<HTMLElement, number>()

const hold = (s: HTMLElement, touched: HTMLElement[]) => {
  const n = holds.get(s)
  if (n) {
    holds.set(s, n + 1)
    s.inert = true
    touched.push(s)
  } else if (!s.inert) {
    holds.set(s, 1)
    s.inert = true
    touched.push(s)
  }
}

/**
 * Inert one sibling of the dialog's path — or, for a wrapper that only
 * groups (the error guards are display: contents) or holds something that
 * must stay live, its children one by one. A notice that turns up later in
 * such a wrapper is then not swallowed by an inert parent.
 */
const sweep = (s: Element, touched: HTMLElement[]) => {
  if (!(s instanceof HTMLElement) || s.matches(KEEP)) return
  if (getComputedStyle(s).display === 'contents' || s.querySelector(KEEP)) {
    for (const c of Array.from(s.children)) sweep(c, touched)
    return
  }
  hold(s, touched)
}

let listening = false
const onKey = (e: KeyboardEvent) => {
  if (e.key !== 'Escape' || e.isComposing) return
  const top = stack[stack.length - 1]
  if (!top) return
  // The top dialog owns Escape: nothing underneath, and nothing in the office, reacts to it.
  e.preventDefault()
  e.stopImmediatePropagation()
  if (top.closable.current) top.close.current()
}

/**
 * Where focus goes back to. A dialog that replaces another one in the same
 * step (signature drawn → confirm it, Leitung area → a window) opens while
 * focus is still on a button of the first, which is gone a moment later; it
 * then inherits where the first one would have returned to.
 */
let handoff: { el: HTMLElement; back: HTMLElement | null } | null = null

const headingOf = (el: HTMLElement) => el.querySelector<HTMLElement>('h2, h3')

const focusInto = (el: HTMLElement) => {
  const h = headingOf(el)
  if (h) h.tabIndex = -1
  ;(h ?? el).focus({ preventScroll: true })
}

/**
 * Makes `ref` a modal dialog while it is mounted. `closable = false` swallows
 * Escape without closing, as while letters are printing. Inside
 * AnimatePresence the dialog leaves the stack the moment its exit animation
 * starts, so the page behind is live again at once and focus does not wait
 * for the fade.
 */
export function useModal(ref: RefObject<HTMLElement | null>, onClose: () => void, closable = true) {
  const close = useRef(onClose)
  const can = useRef(closable)
  // Up to date before the browser can deliver the next key, so Esc never sees last render's rule.
  useLayoutEffect(() => {
    close.current = onClose
    can.current = closable
  })
  const active = useIsPresent()
  // What had focus when the dialog first rendered — before any autoFocus inside it took over.
  const [opener] = useState(() => document.activeElement as HTMLElement | null)

  useEffect(() => {
    const el = ref.current
    if (!active || !el) return
    let back = opener
    if (back && handoff?.el.contains(back)) back = handoff.back
    if (back && el.contains(back)) back = null

    const entry: Entry = { el, close, closable: can }
    stack.push(entry)
    if (!listening) {
      document.addEventListener('keydown', onKey, true)
      listening = true
    }

    // A dialog opened over another one may live inside a part the first one made inert.
    const lifted: HTMLElement[] = []
    for (let n = el.parentElement; n && n.id !== 'root'; n = n.parentElement)
      if (holds.has(n) && n.inert) {
        n.inert = false
        lifted.push(n)
      }
    const touched: HTMLElement[] = []
    for (let n: HTMLElement | null = el; n && n.id !== 'root' && n.parentElement; n = n.parentElement)
      for (const s of Array.from(n.parentElement.children)) if (s !== n) sweep(s, touched)

    el.setAttribute('aria-modal', 'true')
    const h = headingOf(el)
    if (h) {
      h.id ||= `dlg-${Math.random().toString(36).slice(2, 8)}`
      el.setAttribute('aria-labelledby', h.id)
    }
    if (!el.contains(document.activeElement)) focusInto(el)

    return () => {
      stack.splice(stack.indexOf(entry), 1)
      for (const s of touched) {
        const n = (holds.get(s) ?? 1) - 1
        if (n > 0) holds.set(s, n)
        else {
          holds.delete(s)
          s.inert = false
        }
      }
      for (const n of lifted) if (holds.has(n)) n.inert = true
      handoff = { el, back }
      // Focus goes back after the key or click that closed the dialog is fully
      // handled: Enter in the search closes it on keydown, and a button that
      // got focus before the keypress would be pressed by the same Enter.
      setTimeout(() => {
        // Only if focus is still ours: another dialog may have taken it already.
        const now = document.activeElement
        if (now && now !== document.body && !el.contains(now)) return
        if (back?.isConnected && !back.closest('[inert]')) back.focus({ preventScroll: true })
        else if (stack.length) focusInto(stack[stack.length - 1].el)
      })
    }
  }, [active, ref, opener])
}
