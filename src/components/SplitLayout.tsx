import { useCallback, useEffect, useRef, useState } from 'react'
import { Canvas } from './Canvas'
import { ChatStreamView } from './ChatStreamView'
import { ChatInputBar } from './ChatInputBar'

const MIN_RATIO = 0.2
const MAX_RATIO = 0.8

function clampRatio(value: number): number {
  return Math.min(MAX_RATIO, Math.max(MIN_RATIO, value))
}

/**
 * Splits the main viewport into a 40% Graph pane (left) and a 60% Chat pane
 * (right) with a draggable vertical divider to resize the ratio.
 */
export function SplitLayout() {
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [ratio, setRatio] = useState(0.4)

  const onPointerMove = useCallback((event: PointerEvent) => {
    if (!draggingRef.current) return
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.width === 0) return
    setRatio(clampRatio((event.clientX - rect.left) / rect.width))
  }, [])

  const stopDragging = useCallback(() => {
    draggingRef.current = false
  }, [])

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopDragging)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stopDragging)
    }
  }, [onPointerMove, stopDragging])

  return (
    <div ref={containerRef} className="flex-1 min-h-0 flex">
      <div
        className="min-h-0 min-w-0"
        style={{ width: `${ratio * 100}%` }}
        data-testid="graph-pane"
      >
        <Canvas />
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        onPointerDown={(event) => {
          event.preventDefault()
          draggingRef.current = true
        }}
        className="w-1 shrink-0 cursor-col-resize bg-slate-700 hover:bg-indigo-500"
        data-testid="split-divider"
      />
      <div
        className="min-h-0 min-w-0 flex-1 border-l border-slate-800 bg-slate-900 flex flex-col"
        data-testid="chat-pane"
      >
        <ChatStreamView />
        <ChatInputBar />
      </div>
    </div>
  )
}
