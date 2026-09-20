import { useMemo } from 'react'
import { useTreeStore } from '../store/useTreeStore'
import { useCatalogStore } from '../store/catalogStore'
import { treeCostSummary } from '../lib/treeCost'
import { formatUSD } from '../lib/pricing'

/**
 * Per-tree cost receipt: this branched tree's actual spend vs. the same turns
 * replayed as one linear thread, and the gap ("context you didn't pay for").
 * Pure presentational — reads the store, takes no props.
 */
export function CostReceipt() {
  const nodes = useTreeStore((s) => s.nodes)
  const models = useCatalogStore((s) => s.models)
  const summary = useMemo(() => treeCostSummary(nodes, models), [nodes, models])

  const { turns, forks } = useMemo(() => {
    let turns = 0
    let forks = 0
    for (const node of nodes.values()) {
      if (node.userPrompt.length > 0) turns++
      if (node.childrenIds.length >= 2) forks++
    }
    return { turns, forks }
  }, [nodes])

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-md p-3 text-xs tabular-nums text-slate-300 w-80">
      {summary.pricedTurns === 0 ? (
        <div className="text-slate-500">No priced turns yet.</div>
      ) : (
        <>
          <div className="flex justify-between gap-4">
            <span>
              This tree · {turns} turns · {forks} forks
            </span>
            <span>{formatUSD(summary.actual)}</span>
          </div>
          <div className="flex justify-between gap-4 mt-1">
            <span>Same {turns} turns, one linear thread</span>
            <span>{formatUSD(summary.counterfactual)}</span>
          </div>
          <div className="flex justify-between gap-4 mt-1 text-emerald-400">
            <span>Context you didn't pay for</span>
            <span>
              {formatUSD(summary.saved)} saved · {Math.round(summary.savedPct * 100)}%
            </span>
          </div>
        </>
      )}
      {(summary.unpricedTurns > 0 || summary.unmeasuredTurns > 0) && (
        <div className="mt-2 text-slate-500 space-y-0.5">
          {summary.unmeasuredTurns > 0 && (
            <div>{excludedLine(summary.unmeasuredTurns, 'no token counts recorded')}</div>
          )}
          {summary.unpricedTurns > 0 && (
            <div>{excludedLine(summary.unpricedTurns, 'unknown model pricing')}</div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * The two exclusion causes read identically in the UI but mean different
 * things — an unfinished turn vs. a model the catalog has no price for.
 * Reporting both as "unknown model pricing" sent people to the model picker
 * to fix a turn that had simply errored.
 */
function excludedLine(count: number, reason: string): string {
  return `${count} turn${count === 1 ? '' : 's'} excluded — ${reason}`
}
