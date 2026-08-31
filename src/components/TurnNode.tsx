import { memo, useState } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { Zap, GitBranch, Shield, Square } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'
import { useRenderTally } from '../lib/renderTally'
import { MarkdownContent } from './MarkdownContent'
import type { TurnNodeData } from '../types'

// Bounds only the DOM render of response text; stored text is never truncated
const RENDERED_TEXT_CAP = 2000

const ringClass: Record<string, string> = { idle: 'ring-2 ring-indigo-500', streaming: 'ring-2 ring-cyan-400 animate-pulse', error: 'ring-2 ring-red-500' }

export const TurnNodeComponent = memo(function TurnNodeComponent({ data }: NodeProps<Node<TurnNodeData>>) {
  useRenderTally(data.id)
  const addNode = useTreeStore((s) => s.addNode)
  const submitPrompt = useTreeStore((s) => s.submitPrompt)
  const cancelGeneration = useTreeStore((s) => s.cancelGeneration)
  const defaultModel = useTreeStore((s) => s.settings.defaultModel)
  const liveText = useTreeStore((s) => s.liveText.get(data.id))
  const [draft, setDraft] = useState('')

  // Compute responseText: use liveText if streaming, otherwise use stored response
  const responseText = liveText !== undefined ? liveText : data.assistantResponse

  // Cap rendered text to last N characters; stored text is never truncated
  const isTruncated = responseText.length > RENDERED_TEXT_CAP
  const visibleText = isTruncated ? responseText.slice(-RENDERED_TEXT_CAP) : responseText

  const handleSend = () => {
    if (!draft.trim()) return
    submitPrompt(data.id, draft.trim())
    setDraft('')
  }

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
    <div className={`w-80 rounded-xl bg-slate-900 border border-slate-700 shadow-xl ${ringClass[data.status] ?? ringClass.idle}`}>
      <Handle type="target" position={Position.Top} className="!bg-indigo-500 !border-slate-800" />

      {/* System prompt badge */}
      {data.systemPromptOverride && (
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-700 text-amber-400 text-xs font-medium">
          <Shield size={12} />
          <span className="truncate">{data.systemPromptOverride}</span>
        </div>
      )}

      {/* User prompt */}
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs text-slate-400 mb-1 font-medium">👤 User</div>
        {data.userPrompt ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{data.userPrompt}</p>
            {data.status === 'streaming' && (
              <button
                onClick={() => cancelGeneration(data.id)}
                className="w-full bg-red-600 hover:bg-red-500 text-white text-xs font-medium py-1.5 rounded-lg transition-colors nodrag flex items-center justify-center gap-2"
              >
                <Square size={12} />
                Cancel
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Ask something…"
              rows={3}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 nodrag"
            />
            <button
              onClick={handleSend}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium py-1.5 rounded-lg transition-colors nodrag"
            >
              Send
            </button>
          </div>
        )}
      </div>

      {/* Assistant response */}
      {responseText && (
        <div className="px-3 pb-3 border-t border-slate-700 pt-2">
          <div className="text-xs text-slate-400 mb-1 font-medium">🤖 Assistant</div>
          {isTruncated && (
            <div className="text-xs text-slate-500 mb-2">
              Showing the last {RENDERED_TEXT_CAP.toLocaleString()} characters of a longer response.
              <button
                disabled
                title="Full-text view arrives in a later update"
                className="ml-2 text-xs text-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed nodrag"
              >
                Open full text
              </button>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto text-sm text-slate-200 break-words">
            <MarkdownContent markdown={visibleText} />
          </div>
        </div>
      )}

      {/* Error message */}
      {data.status === 'error' && data.errorMessage && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-lg mx-3 mb-2 p-2">
          <div className="text-xs text-red-400 font-medium mb-1">⚠ Error</div>
          <p className="max-h-32 overflow-y-auto text-xs text-red-300 whitespace-pre-wrap break-words">{data.errorMessage}</p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700">
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Zap size={10} />{data.modelUsed}
        </span>
        <button
          onClick={handleBranch}
          className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors nodrag"
        >
          <GitBranch size={12} /> Branch
        </button>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-indigo-500 !border-slate-800" />
    </div>
  )
})
