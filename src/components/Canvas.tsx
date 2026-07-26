import { useRef, useCallback, useMemo } from 'react'
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
  const { nodes, updateNode } = useTreeStore()
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const rfNodes = useMemo<Node<TurnNodeData>[]>(
    () =>
      Array.from(nodes.values()).map((n) => ({
        id: n.id,
        type: 'turnNode',
        position: { x: n.positionX, y: n.positionY },
        data: n as TurnNodeData,
      })),
    [nodes],
  )

  const edges = useMemo(
    () =>
      Array.from(nodes.values())
        .filter((n) => n.parentId !== null)
        .map((n) => ({
          id: `${n.parentId}-${n.id}`,
          source: n.parentId!,
          target: n.id,
          type: 'smoothstep',
          style: { stroke: '#4f46e5', strokeWidth: 2 },
        })),
    [nodes],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<TurnNodeData>>[]) => {
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
      applyNodeChanges(changes, rfNodes)
    },
    [rfNodes, updateNode],
  )

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={rfNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
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
