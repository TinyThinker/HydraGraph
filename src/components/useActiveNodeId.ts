import { useSelectionStore } from '../store/useSelectionStore'
import { useTreeStore } from '../store/useTreeStore'

/**
 * The node the chat pane and input bar act on: the explicitly selected node,
 * falling back to the active tree's root when nothing is selected yet (fresh
 * load, or selection cleared by clicking empty canvas).
 */
export function useActiveNodeId(): string | null {
  const selectedNodeId = useSelectionStore((s) => s.selectedNodeId)
  const rootId = useTreeStore((s) => {
    for (const n of s.nodes.values()) {
      if (n.parentId === null) return n.id
    }
    return null
  })
  return selectedNodeId ?? rootId
}
