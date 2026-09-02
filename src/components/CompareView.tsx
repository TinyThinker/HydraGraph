import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useCompareStore } from '../store/useCompareStore'
import { useTreeStore } from '../store/useTreeStore'
import { CompareColumn } from './CompareColumn'
import { getAncestryChain } from '../lib/ancestry'
import { estimateContextTokens } from '../lib/contextEstimate'

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
  const allPromptsIdentical =
    columns.length > 1 && columns.every((n) => n.userPrompt === columns[0].userPrompt)

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
      <div className="flex flex-col flex-1 min-h-0">
        <p className="shrink-0 px-4 pt-3 text-xs text-slate-500">
          {allPromptsIdentical
            ? 'Identical context through the parent turn — the prompt below is the same for every column; only the model / persona and the answer differ.'
            : "Columns share the parent's context but were asked slightly different follow-ups."}
        </p>
        {allPromptsIdentical && (
          <p className="shrink-0 mx-4 mt-2 px-3 py-2 rounded border border-slate-800 bg-slate-900 text-xs text-slate-400 whitespace-pre-wrap break-words">
            {columns[0].userPrompt}
          </p>
        )}
        <div className="flex gap-4 overflow-x-auto p-4 flex-1 min-h-0">
          {columns.map((n) => (
            <CompareColumn key={n.id} node={n} promptHidden={allPromptsIdentical} />
          ))}
        </div>
      </div>
    </div>
  )
}
