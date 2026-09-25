/**
 * Sound: soft notification chimes and the spoken greeting after sign-in.
 *
 * The chimes are synthesised, no audio files: two warm bell tones with a
 * slow attack and a little echo — calm enough for an office, clear enough
 * to notice. Damage chimes once, an emergency twice.
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

let ctx: AudioContext | null = null
function audio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Browsers only allow sound after a click; the sign-in click unlocks it. */
export function primeAudio() {
  audio()
}

/** One soft bell: a sine with a quieter octave, slow in, long out, through an echo. */
function bell(ac: AudioContext, out: AudioNode, freq: number, at: number, gain = 0.16) {
  for (const [mult, g] of [
    [1, 1],
    [2, 0.28],
    [3.01, 0.08],
  ] as const) {
    const o = ac.createOscillator()
    const v = ac.createGain()
    o.type = 'sine'
    o.frequency.value = freq * mult
    v.gain.setValueAtTime(0, at)
    v.gain.linearRampToValueAtTime(gain * g, at + 0.025)
    v.gain.exponentialRampToValueAtTime(0.0001, at + 1.6 / mult)
    o.connect(v).connect(out)
    o.start(at)
    o.stop(at + 1.8)
  }
}

function chain(ac: AudioContext) {
  // A warm low-pass and a short echo: lounge rather than alarm.
  const lp = ac.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 3200
  const delay = ac.createDelay()
  delay.delayTime.value = 0.23
  const fb = ac.createGain()
  fb.gain.value = 0.28
  const wet = ac.createGain()
  wet.gain.value = 0.35
  lp.connect(ac.destination)
  lp.connect(delay)
  delay.connect(fb).connect(delay)
  delay.connect(wet).connect(ac.destination)
  return lp
}

/** 1 = something needs attention (damage), 2 = emergency: the motif twice, a little higher. */
export function chime(level: 1 | 2) {
  if (muted) return
  const ac = audio()
  if (!ac) return
  const out = chain(ac)
  const t = ac.currentTime + 0.02
  // A rising major sixth, E5 → C#6: friendly, not shrill.
  const motif = (at: number, lift = 1) => {
    bell(ac, out, 659.25 * lift, at)
    bell(ac, out, 1108.73 * lift, at + 0.18, 0.13)
  }
  motif(t)
  if (level === 2) motif(t + 0.75, 1.06)
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
