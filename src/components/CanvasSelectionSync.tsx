import { useEffect } from 'react'
import { useOnSelectionChange, useReactFlow } from '@xyflow/react'
import { useSelectionStore } from '../store/useSelectionStore'
import { useTreeStore } from '../store/useTreeStore'

/**
 * Two-way bridge between React Flow selection and the shared useSelectionStore:
 * - canvas click -> store (so the chat pane can follow the active node)
 * - store.selectAndFocus (chat click) -> canvas pan + node highlight
 * Renders nothing.
 */
export function CanvasSelectionSync() {
  const focusNonce = useSelectionStore((s) => s.focusNonce)
  const { setCenter, setNodes } = useReactFlow()

  useOnSelectionChange({
    onChange: ({ nodes }) =>
      useSelectionStore.getState().setSelectedNodeId(nodes[0]?.id ?? null),
  })

  useEffect(() => {
    if (focusNonce === 0) return
    const id = useSelectionStore.getState().selectedNodeId
    if (!id) return
    const node = useTreeStore.getState().nodes.get(id)
    if (!node) return

    const w = node.width ?? 320
    const h = node.height ?? 240
    setCenter(node.positionX + w / 2, node.positionY + h / 2, { zoom: 1.2, duration: 500 })
    setNodes((nds) => nds.map((x) => ({ ...x, selected: x.id === id })))
  }, [focusNonce, setCenter, setNodes])

  return null
}
