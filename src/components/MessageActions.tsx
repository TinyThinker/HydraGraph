import { useState } from 'react'
import { PlugZap, RotateCcw, Square } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'
import { useSettingsModalStore } from '../store/useSettingsModalStore'
import type { TurnNode } from '../types'

const BTN =
  'nodrag inline-flex items-center gap-1 rounded-md border border-slate-600 px-2 py-0.5 ' +
  'text-[11px] font-medium text-slate-300 transition-colors hover:bg-slate-700 ' +
  'hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed'

// Bad key (401/403 from either provider) or a request that never got an answer
// (Chrome / Safari / Firefox wording for a fetch TypeError).
const CONNECTION_ERROR = /^(OpenRouter|Ollama) 40[13]\b|failed to fetch|load failed|networkerror/i

/**
 * The recovery controls for a single turn: Stop while it streams, Retry after an
 * error, Regenerate an idle answer. All three route through the existing store
 * actions (`cancelGeneration` / `submitPrompt`) — the point of this component is
 * that those capabilities have a live surface again.
 *
 * Regenerate only shows on the active turn (it is a deliberate re-run); Retry
 * always shows on an errored turn so a bad key or rate limit is never a dead end.
 * When the error looks like auth or network, "Check connection" opens Settings.
 */
export function MessageActions({
  node,
  isActive = false,
}: {
  node: TurnNode
  isActive?: boolean
}) {
  const submitPrompt = useTreeStore((s) => s.submitPrompt)
  const cancelGeneration = useTreeStore((s) => s.cancelGeneration)
  const [busy, setBusy] = useState(false)

  if (node.status === 'streaming') {
    return (
      <button
        type="button"
        className={BTN}
        onClick={() => cancelGeneration(node.id)}
        title="Stop generating"
      >
        <Square size={11} /> Stop
      </button>
    )
  }

  // Nothing to retry/regenerate without a prompt (e.g. the tree root).
  if (!node.userPrompt) return null

  const isError = node.status === 'error'
  if (!isError && !isActive) return null

  const run = async () => {
    if (busy) return
    setBusy(true)
    try {
      await submitPrompt(node.id, node.userPrompt)
    } finally {
      setBusy(false)
    }
  }

  const retry = (
    <button
      type="button"
      className={BTN}
      onClick={run}
      disabled={busy}
      title={isError ? 'Retry this turn' : 'Regenerate this response'}
    >
      <RotateCcw size={11} /> {isError ? 'Retry' : 'Regenerate'}
    </button>
  )
  if (!isError || !CONNECTION_ERROR.test(node.errorMessage ?? '')) return retry

  return (
    <span className="inline-flex gap-1">
      {retry}
      <button
        type="button"
        className={BTN}
        onClick={() => useSettingsModalStore.getState().openSettings()}
        title="Open Settings and test the connection"
      >
        <PlugZap size={11} /> Check connection
      </button>
    </span>
  )
}
