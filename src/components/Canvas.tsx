import { ReactFlow, Background, BackgroundVariant, Controls } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { TurnNodeComponent } from './TurnNode'
import { useCanvasGraph } from './useCanvasGraph'
import { CanvasFitter } from './CanvasFitter'
import { CanvasSearchFocus } from './CanvasSearchFocus'
import { CanvasSelectionSync } from './CanvasSelectionSync'
import { CanvasViewport } from './CanvasViewport'

const nodeTypes = { turnNode: TurnNodeComponent }

export function Canvas() {
  const { localNodes, edges, onNodesChange } = useCanvasGraph()

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={localNodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        nodesDraggable={false}
        panOnDrag
        panOnScroll
        panOnScrollSpeed={0.5}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={null}
        disableKeyboardA11y
        className="bg-slate-950"
      >
        <Background variant={BackgroundVariant.Dots} color="#1e293b" gap={24} size={1.5} />
        <Controls className="[&>button]:bg-slate-800 [&>button]:border-slate-700 [&>button]:text-slate-300" />
        <CanvasFitter />
        <CanvasSearchFocus />
        <CanvasSelectionSync />
        <CanvasViewport />
      </ReactFlow>
    </div>
  )
}
