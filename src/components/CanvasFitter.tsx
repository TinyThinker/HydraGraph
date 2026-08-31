import { useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useTreeStore } from '../store/useTreeStore'

export function CanvasFitter() {
  const nonce = useTreeStore((s) => s.fitViewNonce)
  const { fitView } = useReactFlow()

  useEffect(() => {
    if (nonce > 0) {
      fitView({ duration: 400 })
    }
  }, [nonce, fitView])

  return null
}
