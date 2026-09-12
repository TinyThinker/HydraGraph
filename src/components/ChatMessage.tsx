import { memo } from 'react'
import { useTreeStore } from '../store/useTreeStore'
import { useCatalogStore } from '../store/catalogStore'
import { MarkdownContent } from './MarkdownContent'
import { MessageActions } from './MessageActions'
import { useThrottledText } from './useThrottledText'
import { turnCostUSD, formatUSD } from '../lib/pricing'
import type { TurnNode } from '../types'

interface ChatMessageProps {
  node: TurnNode
  isActive: boolean
  onSelect: (id: string) => void
}

/**
 * One turn of the ancestry stream: an optional right-aligned user bubble and a
 * left-aligned assistant bubble with full Markdown + token telemetry. Clicking
 * anywhere in the turn selects its node.
 */
export const ChatMessage = memo(function ChatMessage({ node, isActive, onSelect }: ChatMessageProps) {
  const liveText = useTreeStore((s) => s.liveText.get(node.id))
  const isStreaming = liveText !== undefined || node.status === 'streaming'
  const answer = liveText !== undefined ? liveText : node.assistantResponse
  // In-flight text settles on a throttle so a long response doesn't re-parse
  // its whole Markdown document on every token; the final text is published
  // the moment streaming stops.
  const settledAnswer = useThrottledText(answer, isStreaming)

  const models = useCatalogStore((s) => s.models)
  const hasTokens = node.inputTokens != null && node.outputTokens != null
  const cost = turnCostUSD(node, models)

  return (
    <div
      onClick={() => onSelect(node.id)}
      className={`cursor-pointer rounded-lg px-2 py-2 space-y-2 transition-colors ${
        isActive ? 'bg-slate-800/60 ring-1 ring-indigo-500/60' : 'hover:bg-slate-800/30'
      }`}
      data-testid="chat-message"
      data-node-id={node.id}
    >
      {node.userPrompt && (
        <div className="flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-3 py-2 text-sm text-white whitespace-pre-wrap break-words">
            {node.userPrompt}
          </div>
        </div>
      )}

      {(answer || isStreaming || node.status === 'error' || node.userPrompt) && (
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-slate-800 px-3 py-2 text-slate-200">
            {node.status === 'error' && node.errorMessage ? (
              <p className="text-xs text-red-300 whitespace-pre-wrap break-words">⚠ {node.errorMessage}</p>
            ) : (
              <MarkdownContent markdown={settledAnswer || '…'} />
            )}
            <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
              <span>{node.modelUsed}</span>
              {isStreaming && <span className="text-cyan-400 animate-pulse">streaming…</span>}
              {!isStreaming && hasTokens && (
                <span>
                  {node.inputTokens!.toLocaleString()} in · {node.outputTokens!.toLocaleString()} out tokens
                  {cost != null && ` · ${formatUSD(cost)}`}
                </span>
              )}
              <span className="ml-auto">
                <MessageActions node={node} isActive={isActive} />
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})
