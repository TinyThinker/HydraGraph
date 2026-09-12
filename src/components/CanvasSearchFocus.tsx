import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useTreeStore } from '../store/useTreeStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { useSearchNav } from './useSearchNav'
import { NODE_WIDTH, NODE_HEIGHT } from '../lib/nodeDimensions'

/**
 * Fly the viewport to a search hit and make it the active node.
 *
 * Selection goes through useSelectionStore (the sole owner of `selected`) —
 * useCanvasGraph derives the flag onto the React Flow wrapper. Marking the hit
 * via an imperative setNodes() instead would be erased the next time the store's
 * node map changed identity, and would also leave the chat pane pointing at the
 * previous node.
 */
export function CanvasSearchFocus() {
  const targetId = useSearchNav((s) => s.targetId)
  const nonce = useSearchNav((s) => s.nonce)
  const { setCenter } = useReactFlow()

  useEffect(() => {
    if (!targetId || nonce === 0) return

    const n = useTreeStore.getState().nodes.get(targetId)
    if (!n) return

    setCenter(n.positionX + NODE_WIDTH / 2, n.positionY + NODE_HEIGHT / 2, { zoom: 1.2, duration: 500 })
    useSelectionStore.getState().setSelectedNodeId(targetId)
  }, [nonce, targetId, setCenter])

  return null
}
