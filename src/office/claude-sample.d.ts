/**
 * The part of the claude.ai artifact runtime the office uses: `sample`, which
 * asks Claude on the viewer's own account.
 *
 * Inside a published artifact `window.claude` exists before any script runs,
 * but it only promises `use()`; the capability itself arrives through the
 * promise, or `null` where it can never run. Everywhere else (npm start, a
 * saved copy of the page) there is no `window.claude` at all, which is why
 * every member here is optional. Only the options the office passes are typed.
 */

type SampleTurn = { role: 'user' | 'assistant'; content: string }

type SampleOptions = {
  /** Called as the answer is written; `text` is the whole answer so far. */
  onText?(update: { text: string; delta?: string }): void
  signal?: AbortSignal
  modelTier?: 'quick' | 'default'
  cache?: boolean
}

type SampleFn = (input: string | SampleTurn[], opts?: SampleOptions) => Promise<{ text: string }>

/** What a failed call rejects with: a plain object, never an Error. `text` is the part that may stay on screen. */
type SampleError = { code: string; message?: string; text?: string }

interface Window {
  claude?: {
    use?(name: 'sample'): Promise<SampleFn | null>
  }
}
