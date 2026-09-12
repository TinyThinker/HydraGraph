/**
 * Batches streamed token chunks into one store commit per animation frame.
 *
 * A provider emits deltas far faster than a screen refreshes — a fast model on
 * a warm connection lands 50-100 `onToken` calls a second, and a fan-out
 * multiplies that by the number of branches. Committing each one separately
 * means a Zustand `set`, a `liveText` Map copy, and a React render per delta,
 * none of which the user can perceive between frames.
 *
 * This sits at the network boundary (the `onToken` callback in `submitPrompt`),
 * NOT inside `appendTokenDelta` — that action keeps its synchronous contract so
 * direct callers and tests still see the store update immediately.
 *
 * Pure timing utility: no store access, no React, no Dexie.
 */

export interface TokenCoalescer {
  /** Queue a chunk; schedules a flush on the next frame if one isn't pending. */
  push: (chunk: string) => void
  /** Commit whatever is buffered right now, synchronously. */
  flush: () => void
  /** Drop the buffer and any pending frame without committing. */
  cancel: () => void
}

function schedule(fn: () => void): number {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(fn)
  return setTimeout(fn, 16) as unknown as number
}

function unschedule(handle: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(handle)
  else clearTimeout(handle)
}

/**
 * `commit` receives the concatenation of every chunk pushed since the last
 * flush. It is never called with an empty string.
 */
export function createTokenCoalescer(commit: (text: string) => void): TokenCoalescer {
  let buffer = ''
  let handle: number | null = null

  const drain = () => {
    handle = null
    if (buffer === '') return
    const text = buffer
    buffer = ''
    commit(text)
  }

  return {
    push(chunk) {
      if (chunk === '') return
      buffer += chunk
      if (handle === null) handle = schedule(drain)
    },
    flush() {
      if (handle !== null) {
        unschedule(handle)
        handle = null
      }
      drain()
    },
    cancel() {
      if (handle !== null) {
        unschedule(handle)
        handle = null
      }
      buffer = ''
    },
  }
}
