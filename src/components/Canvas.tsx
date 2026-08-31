import { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  applyNodeChanges,
  type Node,
  type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTreeStore } from '../store/useTreeStore'
import type { TurnNodeData } from '../types'
import { TurnNodeComponent } from './TurnNode'

const nodeTypes = { turnNode: TurnNodeComponent }

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

export function Canvas() {
  const nodes = useTreeStore((s) => s.nodes)
  const updateNode = useTreeStore((s) => s.updateNode)
  const draggingIdRef = useRef<string | null>(null)
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
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

  const structureKey = useMemo(
    () =>
      Array.from(nodes.values())
        .map((n) => `${n.id}>${n.parentId}`)
        .sort()
        .join('|'),
    [nodes],
  )

  // Edges are derived purely from the structure key, so they keep a stable
  // reference until the parent/child structure actually changes.
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
      // Apply immediately for smooth drag — no waiting on store/Dexie
      setLocalNodes((nds) => applyNodeChanges(changes, nds))

      for (const change of changes) {
        if (change.type === 'position' && change.position) {
          const { id, position } = change
          const existing = debounceTimers.current.get(id)
          if (existing) clearTimeout(existing)
          const timer = setTimeout(() => {
            updateNode(id, { positionX: position.x, positionY: position.y })
            debounceTimers.current.delete(id)
          }, 300)
          debounceTimers.current.set(id, timer)
        }
      }
    },
    [updateNode],
  )

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={localNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStart={(_event, node) => { draggingIdRef.current = node.id }}
        onNodeDragStop={(_event, node) => {
          const existing = debounceTimers.current.get(node.id)
          if (existing) clearTimeout(existing)
          updateNode(node.id, { positionX: node.position.x, positionY: node.position.y })
          debounceTimers.current.delete(node.id)
          draggingIdRef.current = null
        }}
        fitView
        deleteKeyCode={null}
        className="bg-slate-950"
      >
        <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={24} size={1.5} />
        <Controls className="[&>button]:bg-slate-800 [&>button]:border-slate-700 [&>button]:text-slate-300" />
      </ReactFlow>
    </div>
  )
}
