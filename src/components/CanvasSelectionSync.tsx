import { useEffect } from 'react'
import { useOnSelectionChange, useReactFlow } from '@xyflow/react'
import { useSelectionStore } from '../store/useSelectionStore'
import { useTreeStore } from '../store/useTreeStore'
import { centerTarget, FOCUS_DURATION } from '../lib/viewportCenter'

/**
 * Bridge + unified auto-center between React Flow selection and useSelectionStore.
 *
 * - canvas click -> useOnSelectionChange -> setSelectedNodeId (so the chat pane
 *   can follow the active node).
 * - ONE auto-center effect (Effect A) watches selectedNodeId AND focusNonce:
 *   whenever either changes and the node exists, it smoothly pans the viewport
 *   so that node is centered (at the current zoom, clamped up to MIN_FOCUS_ZOOM).
 *   Canvas click, chat-pane click, keyboard branch and programmatic
 *   selectAndFocus all converge here -> exactly one setCenter per selection
 *   change, no double-fire with conflicting zoom.
 *
 *   Effect A deliberately does NOT call setNodes() to mark the node selected.
 *   useSelectionStore is the sole owner of `selected`; useCanvasGraph derives it
 *   onto each React Flow wrapper. An imperative setNodes() here would be wiped
 *   the next time the store's node map changed identity, which is what used to
 *   blank the chat pane the instant a response finished streaming.
 * - Effect B watches the tree store's lastSpawnedNodeId: a freshly spawned child
 *   is pushed through selectAndFocus so it, too, ends up centered via Effect A.
 *
 * Renders nothing.
 */
export function CanvasSelectionSync() {
  const selectedNodeId = useSelectionStore((s) => s.selectedNodeId)
  const focusNonce = useSelectionStore((s) => s.focusNonce)
  const lastSpawnedNodeId = useTreeStore((s) => s.lastSpawnedNodeId)
  const { setCenter, getZoom } = useReactFlow()

  useOnSelectionChange({
    onChange: ({ nodes }) =>
      useSelectionStore.getState().setSelectedNodeId(nodes[0]?.id ?? null),
  })

  // Effect A: the single auto-center path.
  useEffect(() => {
    if (!selectedNodeId) return
    const node = useTreeStore.getState().nodes.get(selectedNodeId)
    if (!node) return

    const t = centerTarget(node, getZoom())
    setCenter(t.x, t.y, { zoom: t.zoom, duration: FOCUS_DURATION })
  }, [selectedNodeId, focusNonce, setCenter, getZoom])

  // Effect B: route a fresh spawn through the same select + center path.
  useEffect(() => {
    if (!lastSpawnedNodeId) return
    if (!useTreeStore.getState().nodes.has(lastSpawnedNodeId)) return
    useSelectionStore.getState().selectAndFocus(lastSpawnedNodeId)
  }, [lastSpawnedNodeId])

  return null
}
