import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useCompareStore } from '../store/useCompareStore'
import { useTreeStore } from '../store/useTreeStore'
import { MarkdownContent } from './MarkdownContent'
import { getAncestryChain } from '../lib/ancestry'
import { estimateContextTokens } from '../lib/contextEstimate'
import { turnCostUSD, formatUSD } from '../lib/pricing'
import type { TurnNode } from '../types'

function Column({ node, index }: { node: TurnNode; index: number }) {
  const liveText = useTreeStore((s) => s.liveText)
  const cost = turnCostUSD(node)
  const body = liveText.get(node.id) ?? (node.assistantResponse || '…')
  return (
    <div className="w-80 shrink-0 flex flex-col border border-slate-800 rounded-lg bg-slate-900 overflow-hidden">
      <div className="shrink-0 border-b border-slate-800 px-3 py-2">
        <div className="text-sm font-medium text-slate-200 flex items-center gap-2 flex-wrap">
          <span>{node.modelUsed || `#${index}`}</span>
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
      <p className="shrink-0 px-3 py-2 text-xs text-slate-500 whitespace-pre-wrap break-words border-b border-slate-800/60">
        {node.userPrompt}
      </p>
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

export function CompareView() {
  const open = useCompareStore((s) => s.open)
  const anchorId = useCompareStore((s) => s.anchorId)
  const excludedIds = useCompareStore((s) => s.excludedIds)
  const toggle = useCompareStore((s) => s.toggle)
  const close = useCompareStore((s) => s.close)
  const nodes = useTreeStore((s) => s.nodes)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open || !anchorId) return null
  const anchor = nodes.get(anchorId)
  if (!anchor) return null

  const siblings = (
    anchor.parentId != null
      ? [...nodes.values()].filter((n) => n.parentId === anchor.parentId)
      : [anchor]
  ).sort((a, b) => a.timestamp - b.timestamp)

  const hasParent = anchor.parentId != null
  const inheritedTurns = hasParent ? getAncestryChain(nodes, anchor.parentId).length : 0
  const sharedTokens = hasParent ? estimateContextTokens(anchor.parentId as string, nodes) : 0
  const columns = siblings.filter((n) => !excludedIds.has(n.id))

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/95 flex flex-col">
      <div className="shrink-0 border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Compare siblings</h2>
          <button
            onClick={close}
            title="Close"
            aria-label="Close"
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          {hasParent ? (
            <>
              All {inheritedTurns} columns inherit the same context (~
              {sharedTokens.toLocaleString()} tokens). Columns differ only in model / persona
              and the answer below.
            </>
          ) : (
            'Root node — nothing above it to share.'
          )}
        </p>
        <div className="flex gap-3 flex-wrap mt-2">
          {siblings.map((n, i) => (
            <label key={n.id} className="flex items-center gap-1.5 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={!excludedIds.has(n.id)}
                onChange={() => toggle(n.id)}
              />
              {n.modelUsed || `#${i}`}
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto p-4 flex-1 min-h-0">
        {columns.map((n) => (
          <Column key={n.id} node={n} index={siblings.indexOf(n)} />
        ))}
      </div>
    </div>
  )
}
