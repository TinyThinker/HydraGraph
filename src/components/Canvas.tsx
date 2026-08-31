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

export function Canvas() {
  const nodes = useTreeStore((s) => s.nodes)
  const updateNode = useTreeStore((s) => s.updateNode)
  const isDragging = useRef(false)
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const nodeWrapperCache = useRef<Map<string, Node<TurnNodeData>>>(new Map())

  const rfNodesFromStore = useMemo<Node<TurnNodeData>[]>(
    () => {
      const result: Node<TurnNodeData>[] = []
      const seenIds = new Set<string>()

      Array.from(nodes.values()).forEach((n) => {
        seenIds.add(n.id)
        const cached = nodeWrapperCache.current.get(n.id)

        // Reuse cached wrapper if the data reference is the same
        if (cached && cached.data === n) {
          result.push(cached)
        } else {
          // Create new wrapper and cache it
          const newWrapper: Node<TurnNodeData> = {
            id: n.id,
            type: 'turnNode',
            position: { x: n.positionX, y: n.positionY },
            data: n as TurnNodeData,
          }
          nodeWrapperCache.current.set(n.id, newWrapper)
          result.push(newWrapper)
        }
      })

      // Clean up cache entries for removed nodes
      for (const id of nodeWrapperCache.current.keys()) {
        if (!seenIds.has(id)) {
          nodeWrapperCache.current.delete(id)
        }
      }

      return result
    },
    [nodes],
  )

  const [localNodes, setLocalNodes] = useState(rfNodesFromStore)

  // Sync store → local only when not dragging (avoids fighting the drag)
  useEffect(() => {
    if (!isDragging.current) setLocalNodes(rfNodesFromStore)
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
        onNodeDragStart={() => { isDragging.current = true }}
        onNodeDragStop={() => { isDragging.current = false }}
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
