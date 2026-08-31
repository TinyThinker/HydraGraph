import { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import { applyNodeChanges, type Node, type NodeChange } from '@xyflow/react'
import { useTreeStore } from '../store/useTreeStore'
import type { TurnNodeData } from '../types'

const DEFAULT_NODE_WIDTH = 320
const DEFAULT_NODE_HEIGHT = 240

// Pure helper: accept every store update, but keep the dragged node's live
// local position instead of the (stale) stored one.
function mergeDragPosition(
  incoming: Node<TurnNodeData>[],
  prev: Node<TurnNodeData>[],
  dragId: string | null,
): Node<TurnNodeData>[] {
  if (!dragId) return incoming
  const localPos = prev.find((n) => n.id === dragId)?.position
  if (!localPos) return incoming
  return incoming.map((n) => (n.id === dragId ? { ...n, position: localPos } : n))
}

type TimerEntry = { timer: ReturnType<typeof setTimeout>; x: number; y: number }
type ResizeTimerEntry = { timer: ReturnType<typeof setTimeout>; w: number; h: number }

// Owns the store->React Flow node/edge derivation, the referentially-stable
// wrapper cache, the drag-vs-store position merge, and the debounced persistence
// of positions and resize dimensions. Canvas is left as a thin JSX shell.
export function useCanvasGraph() {
  const nodes = useTreeStore((s) => s.nodes)
  const updateNode = useTreeStore((s) => s.updateNode)
  const draggingIdRef = useRef<string | null>(null)
  const debounceTimers = useRef<Map<string, TimerEntry>>(new Map())
  const resizeTimers = useRef<Map<string, ResizeTimerEntry>>(new Map())
  const nodeWrapperCache = useRef<Map<string, Node<TurnNodeData>>>(new Map())

  // Reuse each node's RF wrapper object while its store object is unchanged, so
  // repositioning one node does not hand every other card a new `data` prop.
  const rfNodesFromStore = useMemo<Node<TurnNodeData>[]>(() => {
    const cache = nodeWrapperCache.current
    const result = Array.from(nodes.values()).map((n) => {
      const cached = cache.get(n.id)
      if (cached && cached.data === n) return cached
      const wrapper: Node<TurnNodeData> = {
        id: n.id,
        type: 'turnNode',
        position: { x: n.positionX, y: n.positionY },
        width: n.width ?? DEFAULT_NODE_WIDTH,
        height: n.height ?? DEFAULT_NODE_HEIGHT,
        data: n as TurnNodeData,
      }
      cache.set(n.id, wrapper)
      return wrapper
    })
    for (const id of cache.keys()) if (!nodes.has(id)) cache.delete(id)
    return result
  }, [nodes])

  const [localNodes, setLocalNodes] = useState(rfNodesFromStore)

  // Always accept store changes; only the dragged node keeps its local position.
  useEffect(() => {
    setLocalNodes((prev) => mergeDragPosition(rfNodesFromStore, prev, draggingIdRef.current))
  }, [rfNodesFromStore])

  // Cleanup on unmount: flush pending position + resize writes, clear timers.
  useEffect(() => {
    const timers = debounceTimers.current
    const resizes = resizeTimers.current
    return () => {
      for (const [id, entry] of timers.entries()) {
        useTreeStore.getState().updateNode(id, { positionX: entry.x, positionY: entry.y })
        clearTimeout(entry.timer)
      }
      timers.clear()
      for (const [id, entry] of resizes.entries()) {
        useTreeStore.getState().updateNode(id, { width: entry.w, height: entry.h })
        clearTimeout(entry.timer)
      }
      resizes.clear()
    }
  }, [])

  const structureKey = useMemo(
    () => Array.from(nodes.values()).map((n) => `${n.id}>${n.parentId}`).sort().join('|'),
    [nodes],
  )
  // Edges derive purely from the structure key, so they keep a stable reference
  // until the parent/child structure actually changes.
  const edges = useMemo(
    () =>
      structureKey
        .split('|')
        .filter(Boolean)
        .map((pair) => pair.split('>'))
        .filter(([, parentId]) => parentId !== 'null')
        .map(([id, parentId]) => ({
          id: `${parentId}-${id}`,
          source: parentId,
          target: id,
          type: 'smoothstep',
          style: { stroke: '#4f46e5', strokeWidth: 2 },
        })),
    [structureKey],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<TurnNodeData>>[]) => {
      // Apply immediately for smooth drag/resize — no waiting on store/Dexie.
      setLocalNodes((nds) => applyNodeChanges(changes, nds))
      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          const { id, position } = change
          const existing = debounceTimers.current.get(id)
          if (existing) clearTimeout(existing.timer)
          const timer = setTimeout(() => {
            updateNode(id, { positionX: position.x, positionY: position.y })
            debounceTimers.current.delete(id)
          }, 300)
          debounceTimers.current.set(id, { timer, x: position.x, y: position.y })
        }
        if (change.type === 'dimensions' && change.dimensions) {
          const { id, dimensions, resizing } = change
          const existing = resizeTimers.current.get(id)
          if (existing) clearTimeout(existing.timer)
          if (resizing === false) {
            updateNode(id, { width: dimensions.width, height: dimensions.height })
            resizeTimers.current.delete(id)
          } else {
            const timer = setTimeout(() => {
              updateNode(id, { width: dimensions.width, height: dimensions.height })
              resizeTimers.current.delete(id)
            }, 300)
            resizeTimers.current.set(id, { timer, w: dimensions.width, h: dimensions.height })
          }
        }
      }
    },
    [updateNode],
  )

  return { localNodes, edges, onNodesChange, draggingIdRef, debounceTimers }
}
