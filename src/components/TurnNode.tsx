import { memo } from 'react'
import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/react'
import { Shield, History, ChevronRight, ChevronDown } from 'lucide-react'
import { useTreeStore, collectSubtreeIds } from '../store/useTreeStore'
import { useReaderPanel } from './useReaderPanel'
import { useRenderTally } from '../lib/renderTally'
import { ResponseArea } from './ResponseArea'
import { PromptSection } from './PromptSection'
import { NodeFooter } from './NodeFooter'
import { ContextMeter } from './ContextMeter'
import { estimateContextTokens } from '../lib/contextEstimate'
import type { TurnNodeData } from '../types'

// Bounds only the DOM render of response text; stored text is never truncated
const RENDERED_TEXT_CAP = 2000

const ringClass: Record<string, string> = { idle: 'ring-2 ring-indigo-500', streaming: 'ring-2 ring-cyan-400 animate-pulse', error: 'ring-2 ring-red-500' }

export const TurnNodeComponent = memo(function TurnNodeComponent({ data, selected }: NodeProps<Node<TurnNodeData>>) {
  useRenderTally(data.id)
  const liveText = useTreeStore((s) => s.liveText.get(data.id))
  const openReader = useReaderPanel((s) => s.open)
  const toggleCollapse = useTreeStore((s) => s.toggleCollapse)
  const hiddenCount = useTreeStore((s) => (data.isCollapsed || data.childrenIds.length > 0 ? collectSubtreeIds(data.id, s.nodes).size - 1 : 0))
  const contextTokens = useTreeStore((s) => estimateContextTokens(data.id, s.nodes))

  // Compute responseText: use liveText if streaming, otherwise use stored response
  const responseText = liveText !== undefined ? liveText : data.assistantResponse

  // Cap rendered text to last N characters; stored text is never truncated
  const isTruncated = responseText.length > RENDERED_TEXT_CAP
  const visibleText = isTruncated ? responseText.slice(-RENDERED_TEXT_CAP) : responseText

  return (
    <div
      className={`relative w-full h-full flex flex-col overflow-hidden rounded-xl bg-slate-900 border border-slate-700 shadow-xl ${ringClass[data.status] ?? ringClass.idle} ${data.stale ? 'opacity-70' : ''}`}
      onDoubleClick={() => openReader(data.id)}
    >
      <NodeResizer minWidth={280} minHeight={200} isVisible={selected} lineClassName="!border-indigo-500" handleClassName="!bg-indigo-500 !border-slate-800" />
      <Handle type="target" position={Position.Top} className="!bg-indigo-500 !border-slate-800" />

      {/* System prompt badge */}
      {data.systemPromptOverride && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-700 text-amber-400 text-xs font-medium">
          <Shield size={12} />
          <span className="truncate">{data.systemPromptOverride}</span>
        </div>
      )}

      {/* Stale badge */}
      {data.stale && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-amber-800/40 bg-amber-950/30 text-amber-300 text-xs font-medium">
          <History size={12} />
          <span>An ancestor changed after this answer was generated — it may be out of date.</span>
        </div>
      )}

      {/* Collapse/expand control */}
      {(data.isCollapsed || data.childrenIds.length > 0) && (
        <button
          onClick={() => toggleCollapse(data.id)}
          className="nodrag flex items-center gap-1 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border-b border-slate-700 w-full"
        >
          {data.isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          <span>{data.isCollapsed ? `Show ${hiddenCount} hidden` : 'Collapse subtree'}</span>
        </button>
      )}

      {/* Context meter */}
      <ContextMeter
        tokens={contextTokens}
        inputTokens={data.inputTokens}
        outputTokens={data.outputTokens}
        status={data.status}
      />

      {/* User prompt */}
      <PromptSection node={data} />

      {/* Assistant response */}
      <ResponseArea
        responseText={responseText}
        isTruncated={isTruncated}
        visibleText={visibleText}
        onOpenFullText={() => openReader(data.id)}
      />

      {/* Error message */}
      {data.status === 'error' && data.errorMessage && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg mx-3 mb-2 p-2">
          <div className="text-xs text-red-400 font-medium mb-1">⚠ Error</div>
          <p className="max-h-32 overflow-y-auto text-xs text-red-300 whitespace-pre-wrap break-words">{data.errorMessage}</p>
        </div>
      )}

      <NodeFooter node={data} />

      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500 !border-slate-800" />
    </div>
  )
})
