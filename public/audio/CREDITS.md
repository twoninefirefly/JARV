# Audio credits

All three tracks are by **Kevin MacLeod** (incompetech.com), licensed
**Creative Commons Attribution 4.0**. Free to use commercially — including in a
monetised YouTube video — provided the attribution below appears somewhere the
audience can see it (a description box is fine).

| File | Track | Used for |
|---|---|---|
| `ambient.mp3` | *Ossuary 6 – Air* | Low bed looping under the interface |
| `work.mp3` | *Mechanolith* | Rises while a tool is running |

## Attribution to paste into a video description

```
Music by Kevin MacLeod (incompetech.com)
  "Ossuary 6 - Air"   — Licensed under Creative Commons: By Attribution 4.0
  "Mechanolith"       — Licensed under Creative Commons: By Attribution 4.0
http://creativecommons.org/licenses/by/4.0/
```

## Why not the actual Iron Man score

Disney/Marvel run one of the most aggressive Content ID operations on YouTube.
Real film score or JARVIS dialogue in an upload means a near-certain claim,
demonetisation, or a strike — on a video whose whole point is to be seen. These
tracks are in the same register and cost you a line of text instead.

## The missing boot cue

`boot-music.mp3` is deliberately absent. The file that shipped here had an
English voice-over baked into it — "Hello, let me introduce myself, I am
Jarvis" — which cannot be removed without an audio editor and which fought with
the spoken introduction the app now produces itself (see `INTRO_LINE` in
`src/config.ts`, spoken in whatever voice is configured, in whatever language it
is written in). Rather than ship a recording that talks over the app in the
wrong language, the file is gone.

Nothing is broken by its absence: `track()` in `src/lib/music.ts` treats a
missing cue as a layer that simply is not there. The boot still has its
synthesised start-up sound and the spoken introduction.

To put music back, drop any instrumental MP3 in here named `boot-music.mp3`.
Around ten seconds suits the sequence. Sources: incompetech.com, Pixabay Music
(CC0, no attribution required), or the YouTube Audio Library. Make sure it has
no voice-over in it.

## Replacing them

Drop in any MP3 with the same filename and it takes over — nothing in the code
references the track names. Other sources worth a look: incompetech.com (same
licence), Pixabay Music (CC0, no attribution at all), and the YouTube Audio
Library.

The short interface sounds — wake pips, tool ticks, the completion chime — are
not files. They're synthesised in Web Audio in `src/lib/sfx.ts`, so there's
nothing to download and nothing to credit. Drop `wake.mp3`, `listen.mp3`,
`tool.mp3`, `done.mp3` or `error.mp3` in here to override any of them.
