import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useTreeStore } from '../store/useTreeStore'
import { useSearchNav } from './useSearchNav'
import { NODE_WIDTH, NODE_HEIGHT } from '../lib/nodeDimensions'

export function CanvasSearchFocus() {
  const targetId = useSearchNav((s) => s.targetId)
  const nonce = useSearchNav((s) => s.nonce)
  const { setCenter, setNodes } = useReactFlow()

  useEffect(() => {
    if (!targetId || nonce === 0) return

    const n = useTreeStore.getState().nodes.get(targetId)
    if (!n) return

    setCenter(n.positionX + NODE_WIDTH / 2, n.positionY + NODE_HEIGHT / 2, { zoom: 1.2, duration: 500 })
    setNodes((nds) => nds.map((x) => ({ ...x, selected: x.id === targetId })))

    const t = setTimeout(
      () => setNodes((nds) => nds.map((x) => (x.id === targetId ? { ...x, selected: false } : x))),
      1600
    )

    return () => clearTimeout(t)
  }, [nonce, targetId, setCenter, setNodes])

  return null
}
