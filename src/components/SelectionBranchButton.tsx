import { GitBranch } from 'lucide-react'
import { useSelectionStore } from '../store/useSelectionStore'
import { useComposerStore } from '../store/useComposerStore'
import { useTextSelection } from './useTextSelection'

/** Gap between the highlighted passage and the button floating above it. */
const OFFSET_Y = 44
const EDGE_PAD = 8

/**
 * Floating "Branch on this" affordance for a highlighted passage.
 *
 * Clicking it makes the passage's own turn the active node and seeds the
 * composer with it as a quote, so the fork happens off the turn being read
 * rather than wherever the selection happened to be. The prompt itself is still
 * the user's to write — this only removes the retyping.
 *
 * Mounted once, app-wide: it works on any container tagged `data-node-id`.
 */
export function SelectionBranchButton() {
  const selection = useTextSelection()
  if (selection === null) return null

  const { nodeId, text, rect } = selection

  const branch = () => {
    useSelectionStore.getState().selectAndFocus(nodeId)
    useComposerStore.getState().seedQuote(text)
    window.getSelection?.()?.removeAllRanges()
  }

  return (
    <button
      type="button"
      data-testid="branch-on-selection"
      // Keep the highlight alive: a plain mousedown would collapse the
      // selection before the click handler ever reads it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={branch}
      style={{
        top: Math.max(EDGE_PAD, rect.top - OFFSET_Y),
        left: Math.max(EDGE_PAD, rect.left + rect.width / 2),
      }}
      className="fixed z-50 -translate-x-1/2 flex items-center gap-1.5 rounded-full border border-indigo-400/40 bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-indigo-950/50 transition-colors hover:bg-indigo-500"
    >
      <GitBranch size={13} />
      Branch on this
    </button>
  )
}
