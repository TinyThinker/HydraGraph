import { memo, useState } from 'react'
import { Handle, Position, NodeResizer, type NodeProps, type Node } from '@xyflow/react'
import { Zap, GitBranch, Shield, Trash2, History } from 'lucide-react'
import { useTreeStore, collectSubtreeIds } from '../store/useTreeStore'
import { useReaderPanel } from './useReaderPanel'
import { useRenderTally } from '../lib/renderTally'
import { ResponseArea } from './ResponseArea'
import { PromptSection } from './PromptSection'
import type { TurnNodeData } from '../types'

// Bounds only the DOM render of response text; stored text is never truncated
const RENDERED_TEXT_CAP = 2000

const ringClass: Record<string, string> = { idle: 'ring-2 ring-indigo-500', streaming: 'ring-2 ring-cyan-400 animate-pulse', error: 'ring-2 ring-red-500' }

export const TurnNodeComponent = memo(function TurnNodeComponent({ data, selected }: NodeProps<Node<TurnNodeData>>) {
  useRenderTally(data.id)
  const addNode = useTreeStore((s) => s.addNode)
  const defaultModel = useTreeStore((s) => s.settings.defaultModel)
  const liveText = useTreeStore((s) => s.liveText.get(data.id))
  const openReader = useReaderPanel((s) => s.open)
  const deleteNodeSubtree = useTreeStore((s) => s.deleteNodeSubtree)
  const [confirmCount, setConfirmCount] = useState<number | null>(null)
  const isRoot = data.parentId === null

  // Compute responseText: use liveText if streaming, otherwise use stored response
  const responseText = liveText !== undefined ? liveText : data.assistantResponse

  // Cap rendered text to last N characters; stored text is never truncated
  const isTruncated = responseText.length > RENDERED_TEXT_CAP
  const visibleText = isTruncated ? responseText.slice(-RENDERED_TEXT_CAP) : responseText

  const handleBranch = () => {
    addNode({
      id: crypto.randomUUID(),
      treeId: data.treeId,
      parentId: data.id,
      childrenIds: [],
      userPrompt: '',
      assistantResponse: '',
      positionX: data.positionX + data.childrenIds.length * 350,
      positionY: data.positionY + 250,
      isCollapsed: false,
      status: 'idle',
      modelUsed: defaultModel,
      timestamp: Date.now(),
    })
  }

  return (
    <div
      className={`w-full h-full flex flex-col overflow-hidden rounded-xl bg-slate-900 border border-slate-700 shadow-xl ${ringClass[data.status] ?? ringClass.idle} ${data.stale ? 'opacity-70' : ''}`}
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

      {/* Delete confirmation */}
      {confirmCount !== null && (
        <div className="bg-red-950/40 border-t border-red-800/50 px-3 py-2 text-xs text-red-200">
          <div className="mb-2">Remove {confirmCount} node{confirmCount === 1 ? '' : 's'}? This can't be undone.</div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await deleteNodeSubtree(data.id)
                setConfirmCount(null)
              }}
              className="flex-1 bg-red-700 hover:bg-red-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors nodrag"
            >
              Remove {confirmCount}
            </button>
            <button
              onClick={() => setConfirmCount(null)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded text-xs font-medium transition-colors nodrag"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700">
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Zap size={10} />{data.modelUsed}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!isRoot) {
                const count = collectSubtreeIds(data.id, useTreeStore.getState().nodes).size
                setConfirmCount(count)
              }
            }}
            disabled={isRoot}
            title={isRoot ? "The root node can't be deleted" : 'Delete this node and all descendants'}
            className={`text-xs nodrag transition-colors ${isRoot ? 'text-slate-700 cursor-not-allowed' : 'text-slate-500 hover:text-red-400'}`}
          >
            <Trash2 size={12} />
          </button>
          <button
            onClick={handleBranch}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors nodrag"
          >
            <GitBranch size={12} /> Branch
          </button>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500 !border-slate-800" />
    </div>
  )
})
