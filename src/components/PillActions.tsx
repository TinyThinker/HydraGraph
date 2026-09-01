import { memo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { useTreeStore, collectSubtreeIds } from '../store/useTreeStore'
import type { TurnNodeData } from '../types'

/**
 * Selection-scoped affordances for a canvas station pill. Currently just the
 * delete control + inline confirmation, lifted verbatim from the old NodeFooter.
 * The trigger button always renders (tests query it while unselected); only the
 * visual prominence is gated on `selected`.
 */
export const PillActions = memo(function PillActions({
  node,
  selected,
}: {
  node: TurnNodeData
  selected: boolean
}) {
  const [confirmCount, setConfirmCount] = useState<number | null>(null)
  const deleteNodeSubtree = useTreeStore((s) => s.deleteNodeSubtree)
  const isRoot = node.parentId === null

  return (
    <div
      className={`nodrag absolute -top-2 -right-2 z-10 transition-opacity ${
        selected ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <button
        onClick={() => {
          if (isRoot) return
          setConfirmCount(collectSubtreeIds(node.id, useTreeStore.getState().nodes).size)
        }}
        disabled={isRoot}
        title={isRoot ? "The root node can't be deleted" : 'Delete this node and all descendants'}
        className={`nodrag rounded-full border border-slate-700 bg-slate-800 p-1 shadow transition-colors ${
          isRoot ? 'text-slate-700 cursor-not-allowed' : 'text-slate-400 hover:text-red-400'
        }`}
      >
        <Trash2 size={12} />
      </button>

      {confirmCount !== null && (
        <div className="absolute right-0 top-7 w-52 rounded-lg border border-red-800/50 bg-red-950/95 px-3 py-2 text-xs text-red-200 shadow-xl">
          <div className="mb-2">
            Remove {confirmCount} node{confirmCount === 1 ? '' : 's'}? This can't be undone.
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await deleteNodeSubtree(node.id)
                setConfirmCount(null)
              }}
              className="nodrag flex-1 rounded bg-red-700 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-red-600"
            >
              Remove {confirmCount}
            </button>
            <button
              onClick={() => setConfirmCount(null)}
              className="nodrag flex-1 rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
})
