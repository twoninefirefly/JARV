#!/usr/bin/env node
/**
 * Trim an MP3 to a length, without re-encoding and without ffmpeg.
 *
 *   node scripts/trim-audio.mjs ~/Downloads/suno.mp3 public/audio/boot-music.mp3 12
 *
 * An MP3 is a plain sequence of self-contained frames, each carrying a fixed
 * number of samples. Cutting between two frames therefore produces a file that
 * is still a valid MP3 — no decoding, no quality loss, no toolchain. That is
 * the whole trick, and it is why this is forty lines rather than a dependency.
 *
 * The cut is abrupt by construction, and it does not matter here: the boot cue
 * is faded out in software 2.6 seconds before the file ends (see playBoot in
 * src/lib/music.ts), so the last moment of the file is never heard at full
 * level. Leave yourself a couple of seconds of tail and the seam is inaudible.
 *
 * What this does NOT do: fade, normalise, convert, or trim anything that is not
 * an MP3. Those need a decoder. Reach for ffmpeg if you want them.
 */

import { readFileSync, writeFileSync } from 'node:fs'

/** kbit/s by bitrate index, for Layer III. MPEG1 and MPEG2/2.5 differ. */
const BITRATE = {
  1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0],
  2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0],
}

/** Hz by sample-rate index, per MPEG version. */
const RATE = {
  3: [44100, 48000, 32000], // MPEG 1
  2: [22050, 24000, 16000], // MPEG 2
  0: [11025, 12000, 8000], // MPEG 2.5
}

function usage(msg) {
  if (msg) console.error(`\n  ${msg}`)
  console.error(`
  node scripts/trim-audio.mjs <quelle.mp3> <ziel.mp3> <sekunden>

  Beispiel:
    node scripts/trim-audio.mjs ~/Downloads/suno.mp3 public/audio/boot-music.mp3 14
`)
  process.exit(1)
}

const [src, dest, secsArg] = process.argv.slice(2)
if (!src || !dest || !secsArg) usage()
const want = Number(secsArg)
if (!Number.isFinite(want) || want <= 0) usage(`"${secsArg}" ist keine Sekundenzahl.`)

let data
try {
  data = readFileSync(src)
} catch (err) {
  usage(`Kann ${src} nicht lesen: ${err.message}`)
}

// Keep any ID3v2 tag at the head. Its length is stored as four 7-bit bytes.
let start = 0
if (data.length > 10 && data.toString('latin1', 0, 3) === 'ID3') {
  start = 10 + ((data[6] << 21) | (data[7] << 14) | (data[8] << 7) | data[9])
}

let at = start
let seconds = 0
let frames = 0
let end = null

while (at + 4 <= data.length) {
  // Frame sync: eleven set bits.
  if (data[at] !== 0xff || (data[at + 1] & 0xe0) !== 0xe0) {
    at++
    continue
  }
  const version = (data[at + 1] >> 3) & 0x03 // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
  const layer = (data[at + 1] >> 1) & 0x03 // 1 = Layer III
  const brIndex = (data[at + 2] >> 4) & 0x0f
  const srIndex = (data[at + 2] >> 2) & 0x03
  const padding = (data[at + 2] >> 1) & 0x01

  const rates = RATE[version]
  const kbps = BITRATE[version === 3 ? 1 : 2][brIndex]
  if (layer !== 1 || !rates || srIndex === 3 || !kbps) {
    at++ // Not a Layer III frame header after all — a false sync.
    continue
  }

  const hz = rates[srIndex]
  const perFrame = version === 3 ? 1152 : 576
  const length =
    Math.floor(((version === 3 ? 144 : 72) * kbps * 1000) / hz) + padding
  if (length < 4) {
    at++
    continue
  }

  if (seconds >= want) {
    end = at
    break
  }

  seconds += perFrame / hz
  frames++
  at += length
}

if (!frames) usage('Darin steckt kein MP3 — ist das wirklich eine .mp3-Datei?')

const cut = end ?? data.length
writeFileSync(dest, data.subarray(0, cut))

const kept = seconds.toFixed(2).replace('.', ',')
console.log(`
  ${frames} Frames behalten = ${kept} s
  ${(cut / 1024 / 1024).toFixed(2)} MB geschrieben nach ${dest}`)
if (end === null) {
  console.log(`
  Hinweis: Die Datei war kürzer als ${want} s und wurde unverändert kopiert.`)
}
console.log('')
