import { ReactFlow, Background, BackgroundVariant, Controls } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTreeStore } from '../store/useTreeStore'
import { TurnNodeComponent } from './TurnNode'
import { useCanvasGraph } from './useCanvasGraph'

const nodeTypes = { turnNode: TurnNodeComponent }

export function Canvas() {
  const updateNode = useTreeStore((s) => s.updateNode)
  const { localNodes, edges, onNodesChange, draggingIdRef, debounceTimers } = useCanvasGraph()

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
          if (existing) clearTimeout(existing.timer)
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
