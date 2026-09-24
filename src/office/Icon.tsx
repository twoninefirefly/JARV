import type { IconName } from './data'

/** Line icons in the style of the department badges — 24px grid, 1.6 stroke. */
const PATHS: Record<IconName, string> = {
  chat: 'M4 12a8 7 0 1 1 3.2 5.6L4 19l1-3.4A6.7 6.7 0 0 1 4 12Z',
  megaphone: 'M4 10v4h3l7 4V6l-7 4H4Zm3 4 1.2 4.5h2.3L9.5 14M17.5 9.5a3.5 3.5 0 0 1 0 5',
  box: 'M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Zm0 0v0M4 7.5 12 12l8-4.5M12 12v9M8 5.3l8 4.4',
  clapper: 'M4 10h16v9H4v-9Zm0 0 1-4.5L19 3l1 4.5-16 2.5Zm4.5-5.7 2 3.6m3-4.6 2 3.6',
  handshake:
    'M3 8.5 6.5 6l3 1.5L12 6l3 1.5L17.5 6 21 8.5v4l-3 1-4.5 4-2-1-2 1L7 14l-4-1.5v-4Zm6.5-1-3 3.2c.9 1 2.3 1 3.2 0L12 8.5l4.5 4.5M11 15l1.5 1.5M13 13.5l1.8 1.8',
  euro: 'M17 6.5A6.5 6.5 0 1 0 17 17.5M5 10h9M5 14h9',
  brain:
    'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 1V6a2.5 2.5 0 0 0-3-2Zm6 0a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 1',
}

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

/** The four-point spark used in front of every agent name. */
export function Spark({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2c.6 4.6 2.4 7.4 7 8.2v1.6c-4.6.8-6.4 3.6-7 8.2h-1.6c-.6-4.6-2.4-7.4-7-8.2v-1.6c4.6-.8 6.4-3.6 7-8.2H12Z" />
    </svg>
  )
}
