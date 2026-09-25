/**
 * Sound: the spoken greeting after sign-in. Urgent messages are silent
 * notifications on screen.
 *
 * The greeting uses the browser's own German voice. A studio voice (e.g.
 * ElevenLabs) can replace it with recorded clips per person and time of day.
 */

const KEY = 'office.sound'
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === 'off'
  } catch {
    return false
  }
})()

export const isMuted = () => muted
export function setMuted(m: boolean) {
  muted = m
  try {
    localStorage.setItem(KEY, m ? 'off' : 'on')
  } catch {
    // fine for this visit
  }
  if (m) window.speechSynthesis?.cancel()
}

/** „Guten Morgen, Anna“ — once, after signing in, in a female German voice if there is one. */
export function greet(firstName: string, now = new Date()) {
  if (muted || !('speechSynthesis' in window)) return
  const h = now.getHours()
  const text = `${h < 11 ? 'Guten Morgen' : h < 18 ? 'Guten Tag' : 'Guten Abend'}, ${firstName}.`
  const speak = () => {
    const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('de'))
    const female = /anna|petra|helena|katja|marlene|vicki|hedda|female|frau|google deutsch|seraphina|amala|elke/i
    const voice = voices.find((v) => female.test(v.name)) ?? voices[0]
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'de-DE'
    if (voice) u.voice = voice
    u.rate = 0.95
    u.pitch = 1.05
    u.volume = 0.9
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(u)
  }
  // Voices load asynchronously on first use.
  if (window.speechSynthesis.getVoices().length) speak()
  else window.speechSynthesis.addEventListener('voiceschanged', speak, { once: true })
}
