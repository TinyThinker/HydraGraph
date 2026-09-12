import { useEffect, useState } from 'react'
import { MIN_SELECTION_CHARS } from '../lib/quotePrompt'

export interface NodeTextSelection {
  /** The turn the highlighted passage belongs to. */
  nodeId: string
  /** The highlighted text, trimmed. */
  text: string
  /** Viewport rect of the highlight, for positioning the branch affordance. */
  rect: { top: number; left: number; width: number; height: number }
}

const EMPTY_RECT = { top: 0, left: 0, width: 0, height: 0 }

/** Nearest ancestor element tagged with a node id, if any. */
function hostNodeId(container: Node | null): string | null {
  const start = container instanceof Element ? container : (container?.parentElement ?? null)
  const host = start?.closest('[data-node-id]')
  return host?.getAttribute('data-node-id') ?? null
}

/**
 * Range geometry, defensively.
 *
 * This runs inside a `selectionchange` listener, where a throw would take out
 * every other listener on the event. `Range.getBoundingClientRect` is also
 * absent in jsdom, so the fallback keeps the affordance testable — it just
 * anchors to the viewport corner instead of the passage.
 */
function rectOf(range: Range): typeof EMPTY_RECT {
  if (typeof range.getBoundingClientRect !== 'function') return EMPTY_RECT
  try {
    const r = range.getBoundingClientRect()
    return { top: r.top, left: r.left, width: r.width, height: r.height }
  } catch {
    return EMPTY_RECT
  }
}

/**
 * The current text selection, when it lies inside a rendered turn.
 *
 * Any surface that wants to offer "branch on this" only has to tag its
 * container with `data-node-id` — the chat bubbles, the reader panel and the
 * compare columns all do. Selections anywhere else (the composer, the header,
 * plain page chrome) resolve to `null`.
 */
export function useTextSelection(): NodeTextSelection | null {
  const [selection, setSelection] = useState<NodeTextSelection | null>(null)

  useEffect(() => {
    const read = () => {
      const sel = typeof window.getSelection === 'function' ? window.getSelection() : null
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelection(null)
        return
      }

      const text = sel.toString().trim()
      if (text.length < MIN_SELECTION_CHARS) {
        setSelection(null)
        return
      }

      const range = sel.getRangeAt(0)
      const nodeId = hostNodeId(range.commonAncestorContainer)
      if (nodeId === null) {
        setSelection(null)
        return
      }

      setSelection({ nodeId, text, rect: rectOf(range) })
    }

    document.addEventListener('selectionchange', read)
    return () => document.removeEventListener('selectionchange', read)
  }, [])

  return selection
}
