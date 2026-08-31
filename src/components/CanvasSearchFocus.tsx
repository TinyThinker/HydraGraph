import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useTreeStore } from '../store/useTreeStore'
import { useSearchNav } from './useSearchNav'

export function CanvasSearchFocus() {
  const targetId = useSearchNav((s) => s.targetId)
  const nonce = useSearchNav((s) => s.nonce)
  const { setCenter, setNodes } = useReactFlow()

  useEffect(() => {
    if (!targetId || nonce === 0) return

    const n = useTreeStore.getState().nodes.get(targetId)
    if (!n) return

    const w = n.width ?? 320
    const h = n.height ?? 240

    setCenter(n.positionX + w / 2, n.positionY + h / 2, { zoom: 1.2, duration: 500 })
    setNodes((nds) => nds.map((x) => ({ ...x, selected: x.id === targetId })))

    const t = setTimeout(
      () => setNodes((nds) => nds.map((x) => (x.id === targetId ? { ...x, selected: false } : x))),
      1600
    )

    return () => clearTimeout(t)
  }, [nonce, targetId, setCenter, setNodes])

  return null
}
