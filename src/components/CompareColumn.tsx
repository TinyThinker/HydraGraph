import { useTreeStore } from '../store/useTreeStore'
import { MarkdownContent } from './MarkdownContent'
import { turnCostUSD, formatUSD } from '../lib/pricing'
import type { TurnNode } from '../types'

/**
 * One sibling's column in {@link CompareView}. Pure rendering — the only store
 * read is this node's live streaming text.
 */
export function CompareColumn({
  node,
  promptHidden = false,
}: {
  node: TurnNode
  promptHidden?: boolean
}) {
  const live = useTreeStore((s) => s.liveText.get(node.id))
  const cost = turnCostUSD(node)
  const body = live ?? (node.assistantResponse || '…')

  return (
    <div className="w-80 shrink-0 flex flex-col border border-slate-800 rounded-lg bg-slate-900 overflow-hidden">
      <div className="shrink-0 border-b border-slate-800 px-3 py-2">
        <div className="text-sm font-medium text-slate-200 flex items-center gap-2 flex-wrap">
          <span>{node.modelUsed || 'unknown model'}</span>
          {node.provider && <span className="text-xs text-slate-500">{node.provider}</span>}
          {node.systemPromptOverride && (
            <span
              className="text-[10px] uppercase tracking-wide rounded bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5"
              title={node.systemPromptOverride.slice(0, 120)}
            >
              persona
            </span>
          )}
        </div>
        {node.inputTokens != null && node.outputTokens != null && (
          <div className="text-xs text-slate-500 mt-1">
            {node.inputTokens.toLocaleString()} in · {node.outputTokens.toLocaleString()} out
            {cost != null && ` · ${formatUSD(cost)}`}
          </div>
        )}
      </div>
      {!promptHidden && (
        <p className="shrink-0 px-3 py-2 text-xs text-slate-500 whitespace-pre-wrap break-words border-b border-slate-800/60">
          {node.userPrompt}
        </p>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 text-sm text-slate-200">
        {node.status === 'error' ? (
          <p className="text-red-400 whitespace-pre-wrap break-words">
            {node.errorMessage || 'Generation failed.'}
          </p>
        ) : (
          <MarkdownContent markdown={body} />
        )}
      </div>
    </div>
  )
}
