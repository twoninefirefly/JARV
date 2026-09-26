/**
 * The phone version: one page to scroll in portrait instead of the full-screen
 * office with its side sheet. Chosen once at load — on a phone held upright,
 * or forced with ?mobile or <html data-mobile="1"> (the link sent to customers).
 */
const forced = (() => {
  try {
    return new URLSearchParams(location.search).has('mobile') || document.documentElement.dataset.mobile === '1'
  } catch {
    return false
  }
})()

export const MOBILE = forced || (window.matchMedia('(max-width: 700px)').matches && window.innerHeight > window.innerWidth)
