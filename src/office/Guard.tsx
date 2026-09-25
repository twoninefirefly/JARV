import { Component, type ReactNode } from 'react'

/**
 * Keeps one part of the page from taking the whole page down.
 *
 * Without a boundary, one error anywhere in React unmounts everything, and
 * the office goes black mid-pitch. With it, the part that failed is rebuilt
 * from a clean state after `onError` has put the store somewhere safe, and
 * everything around it keeps running.
 */
export class Guard extends Component<{ children: ReactNode; name: string; onError?: () => void; fallback?: ReactNode }, { gen: number; failed: boolean; errors: number }> {
  state = { gen: 0, failed: false, errors: 0 }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error(`[${this.props.name}]`, error)
    this.props.onError?.()
    // Rebuild on the next frame; stop retrying if it keeps failing straight away.
    if (this.state.errors < 3) requestAnimationFrame(() => this.setState((s) => ({ failed: false, gen: s.gen + 1, errors: s.errors + 1 })))
    setTimeout(() => this.setState({ errors: 0 }), 10_000)
  }

  render() {
    if (this.state.failed) return this.props.fallback ?? null
    return <div key={this.state.gen} style={{ display: 'contents' }}>{this.props.children}</div>
  }
}
