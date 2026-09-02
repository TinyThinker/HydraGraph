import { useState } from 'react'
import { SendHorizontal, Split } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { useActiveNodeId } from './useActiveNodeId'
import { FanOutModal } from './FanOutModal'

/**
 * Fixed bottom input for the chat pane. Submitting forks a fresh child off the
 * active node, dispatches the prompt into it, and moves the active selection to
 * that new child (which also re-focuses the graph).
 */
export function ChatInputBar() {
  const forkAndSubmit = useTreeStore((s) => s.forkAndSubmit)
  const activeId = useActiveNodeId()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [fanOpen, setFanOpen] = useState(false)

  const send = async () => {
    const text = draft.trim()
    if (!text || !activeId || busy) return
    setBusy(true)
    setDraft('')
    try {
      const childId = await forkAndSubmit(activeId, text)
      if (childId) useSelectionStore.getState().selectAndFocus(childId)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="shrink-0 border-t border-slate-800 bg-slate-900 p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={activeId ? 'Reply on this branch…' : 'Select a node to start…'}
          disabled={!activeId || busy}
          rows={2}
          data-testid="chat-input"
          className="flex-1 resize-none rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!draft.trim() || !activeId || busy}
          data-testid="chat-send"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
        >
          <SendHorizontal size={16} />
        </button>
        <button
          onClick={() => setFanOpen(true)}
          disabled={!activeId}
          title="Fan-out to several models"
          data-testid="chat-fanout"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-slate-200 transition-colors hover:bg-slate-600 disabled:opacity-40"
        >
          <Split size={16} />
        </button>
      </div>
      <FanOutModal open={fanOpen} onClose={() => setFanOpen(false)} />
    </div>
  )
}
