import { useEffect, useRef, useState } from 'react'

/** How long a settled Markdown render is allowed to lag the live text. */
export const MARKDOWN_THROTTLE_MS = 100

/**
 * Trailing-edge throttle for streamed text.
 *
 * Parsing Markdown is O(document), so re-parsing on every token makes a long
 * response quadratic in its own length — and a four-column fan-out pays that
 * four times over. This releases a new value at most once per `delayMs` while
 * `live` is true, which is well under the ~16ms frame budget at any response
 * length a model actually produces.
 *
 * When `live` goes false the latest text is published immediately, so a
 * finished response is never left showing a stale intermediate parse.
 */
export function useThrottledText(text: string, live: boolean, delayMs = MARKDOWN_THROTTLE_MS): string {
  const [settled, setSettled] = useState(text)
  const lastEmitRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The pending release reads the newest text from here rather than closing
  // over the value it was scheduled with, so a token that arrives while a timer
  // is already armed is not published a beat late.
  const latestRef = useRef(text)
  latestRef.current = text

  useEffect(() => {
    // Not streaming: publish synchronously and drop any pending release.
    if (!live) {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setSettled((prev) => (prev === text ? prev : text))
      return
    }

    const elapsed = Date.now() - lastEmitRef.current
    if (elapsed >= delayMs) {
      lastEmitRef.current = Date.now()
      setSettled(text)
      return
    }

    if (timerRef.current !== null) return
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      lastEmitRef.current = Date.now()
      setSettled(latestRef.current)
    }, delayMs - elapsed)
  }, [text, live, delayMs])

  // Release the pending timer if the component goes away mid-stream.
  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    },
    [],
  )

  return settled
}
