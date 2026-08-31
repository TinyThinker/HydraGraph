import { memo, useState, useEffect } from 'react'
import { Pencil, RotateCw, Square } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'
import type { TurnNodeData } from '../types'

export const PromptSection = memo(function PromptSection({ node }: { node: TurnNodeData }) {
  const submitPrompt = useTreeStore((s) => s.submitPrompt)
  const cancelGeneration = useTreeStore((s) => s.cancelGeneration)

  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)
  const [editDraft, setEditDraft] = useState('')

  // Close editor if streaming starts elsewhere
  useEffect(() => {
    if (node.status === 'streaming') {
      setEditing(false)
    }
  }, [node.status])

  const handleSend = async () => {
    if (!draft.trim()) return
    await submitPrompt(node.id, draft.trim())
    setDraft('')
  }

  const handleSaveEdit = async () => {
    if (!editDraft.trim()) return
    await submitPrompt(node.id, editDraft.trim())
    setEditing(false)
  }

  const handleClickEdit = () => {
    setEditDraft(node.userPrompt)
    setEditing(true)
  }

  const handleClickRegenerate = async () => {
    await submitPrompt(node.id, node.userPrompt)
  }

  // Fresh node: textarea + Send button
  if (!node.userPrompt) {
    return (
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs text-slate-400 mb-1 font-medium">👤 User</div>
        <div className="space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Ask something…"
            rows={3}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 nodrag"
          />
          <button
            onClick={handleSend}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium py-1.5 rounded-lg transition-colors nodrag"
          >
            Send
          </button>
        </div>
      </div>
    )
  }

  // Streaming: show prompt + Cancel button
  if (node.status === 'streaming') {
    return (
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs text-slate-400 mb-1 font-medium">👤 User</div>
        <div className="space-y-2">
          <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{node.userPrompt}</p>
          <button
            onClick={() => cancelGeneration(node.id)}
            className="w-full bg-red-600 hover:bg-red-500 text-white text-xs font-medium py-1.5 rounded-lg transition-colors nodrag flex items-center justify-center gap-2"
          >
            <Square size={12} />
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // Editing: textarea + Save & run + Cancel buttons
  if (editing) {
    return (
      <div className="px-3 pt-3 pb-2">
        <div className="text-xs text-slate-400 mb-1 font-medium">👤 User</div>
        <div className="space-y-2">
          <textarea
            value={editDraft}
            onChange={(e) => setEditDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit() } }}
            autoFocus
            rows={3}
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500 nodrag"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveEdit}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium py-1.5 rounded-lg transition-colors nodrag"
            >
              Save & run
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium py-1.5 rounded-lg transition-colors nodrag"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Idle or error, has prompt, not editing: show prompt + Edit + Regenerate buttons
  return (
    <div className="px-3 pt-3 pb-2">
      <div className="text-xs text-slate-400 mb-1 font-medium">👤 User</div>
      <div className="space-y-2">
        <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">{node.userPrompt}</p>
        <div className="flex gap-2 mt-2">
          <button
            onClick={handleClickEdit}
            className="nodrag flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300 transition-colors"
            title="Edit prompt"
          >
            <Pencil size={12} />
            Edit
          </button>
          <button
            onClick={handleClickRegenerate}
            className="nodrag flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            title="Regenerate response"
          >
            <RotateCw size={12} />
            Regenerate
          </button>
        </div>
      </div>
    </div>
  )
})
