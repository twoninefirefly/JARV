import { useEffect, useRef, useState } from 'react'
import { bindFilm, FILM_SRC } from '../lib/film'

/**
 * The element the intro film plays in.
 *
 * Mounted for the whole session rather than only during the boot, which is the
 * point: `preload="auto"` starts buffering while the ignition screen is still
 * up, so by the time anyone presses the button the clip has usually arrived and
 * can be armed. Mount it inside the boot and it would begin loading at the
 * exact moment it is needed, which is the arrangement that guarantees a stall.
 *
 * Muted is not a stylistic choice. An unmuted video cannot autoplay in any
 * current browser, and the clip carries no sound of its own — the boot's audio
 * is the start-up cue and the spoken introduction.
 */
export function Film() {
  const ref = useRef<HTMLVideoElement | null>(null)
  const [on, setOn] = useState(false)

  useEffect(() => bindFilm(ref.current, setOn), [])

  return (
    <video
      ref={ref}
      className={`film${on ? ' film-on' : ''}`}
      src={FILM_SRC}
      preload="auto"
      muted
      playsInline
      // Nothing here is content: it is a flourish over an interface that says
      // the same thing in text. A screen reader announcing it would be noise.
      aria-hidden="true"
    />
  )
}
