/**
 * The voice history every voice-driven element draws from.
 *
 * A wave is only readable as "that was a syllable" if it keeps the strength it
 * was born with all the way across. A shader has no memory, so the memory
 * lives here: the last couple of seconds of level, sampled on a fixed clock,
 * newest first. Each consumer maps distance to age — a wave at distance d was
 * emitted d / speed seconds ago, and is exactly as bright as the voice was then.
 * One buffer, filled once, so the core, the figure and the halo all carry the
 * same sentence at the same moment.
 */
export const HIST = 64
/** Seconds between history samples. 64 x 30ms = just under two seconds. */
export const HIST_STEP = 0.03

/**
 * GLSL for reading the history, shared so every shader samples it the same
 * way. Expects `uniform float uHist[HIST];` to be declared by the includer.
 */
export const VOICE_AT = /* glsl */ `
  float voiceAt(float age) {
    float i = age / ${HIST_STEP.toFixed(3)};
    if (i < 0.0 || i > ${(HIST - 1).toFixed(1)}) return 0.0;
    int i0 = int(floor(i));
    int i1 = min(i0 + 1, ${HIST - 1});
    return mix(uHist[i0], uHist[i1], fract(i));
  }
`
