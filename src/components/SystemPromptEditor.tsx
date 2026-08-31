import { memo, useState, useMemo } from 'react'
import { useTreeStore } from '../store/useTreeStore'
import { resolveContextPayload } from '../lib/contextEngine'
import type { TurnNodeData } from '../types'

export const SystemPromptEditor = memo(function SystemPromptEditor({
  node,
  onClose,
}: {
  node: TurnNodeData
  onClose: () => void
}) {
  const [draft, setDraft] = useState(() => node.systemPromptOverride ?? '')
  const updateNode = useTreeStore((s) => s.updateNode)
  const markDescendantsStale = useTreeStore((s) => s.markDescendantsStale)
  const trees = useTreeStore((s) => s.trees)
  const activeTreeId = useTreeStore((s) => s.activeTreeId)

  // Compute inherited prompt via resolveContextPayload at parent
  const inherited = useMemo(() => {
    if (!node.parentId) {
      // Root node: inherit tree default
      const tree = trees.find((t) => t.id === activeTreeId)
      return tree?.defaultSystemPrompt ?? 'You are a helpful AI research assistant.'
    }
    // Non-root: resolve at parent to get what this node inherits
    const nodes = useTreeStore.getState().nodes
    const tree = trees.find((t) => t.id === activeTreeId)
    const dsp = tree?.defaultSystemPrompt ?? 'You are a helpful AI research assistant.'
    return resolveContextPayload(node.parentId, nodes, dsp).systemPrompt
  }, [node.parentId, activeTreeId, trees])

  const handleSave = async () => {
    const v = draft.trim()
    await updateNode(node.id, { systemPromptOverride: v || undefined })
    await markDescendantsStale(node.id)
    onClose()
  }

  const handleClear = async () => {
    await updateNode(node.id, { systemPromptOverride: undefined })
    await markDescendantsStale(node.id)
    onClose()
  }

  return (
    <div className="nodrag absolute left-2 right-2 top-10 z-20 bg-slate-900 border border-slate-600 rounded-lg shadow-2xl p-3 space-y-2 max-h-[80%] overflow-y-auto">
      <div className="text-xs font-semibold text-slate-300">System prompt for this node</div>

      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500">Inherited</div>
        <div className="text-xs text-slate-400 whitespace-pre-wrap break-words bg-slate-800 rounded p-2 max-h-24 overflow-y-auto">
          {inherited}
        </div>
      </div>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Leave empty to inherit the prompt above."
        rows={4}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 nodrag"
      />

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-1.5 rounded-lg transition-colors nodrag"
        >
          Save
        </button>
        {node.systemPromptOverride && (
          <button
            onClick={handleClear}
            className="flex-1 bg-amber-700 hover:bg-amber-600 text-white text-xs py-1.5 rounded-lg transition-colors nodrag"
          >
            Clear override
          </button>
        )}
        <button
          onClick={onClose}
          className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs py-1.5 rounded-lg transition-colors nodrag"
        >
          Cancel
        </button>
      </div>
    </div>
  )
})
