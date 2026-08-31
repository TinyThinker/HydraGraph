import { useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'
import type { ConversationTree } from '../types'

interface TreeSwitcherRowProps {
  tree: ConversationTree
  isActive: boolean
  onSelect: () => void | Promise<void>
  onClosePanel: () => void
}

function formatWhen(ts: number): string {
  const now = Date.now()
  const diffMs = now - ts
  const diffS = Math.floor(diffMs / 1000)
  const diffM = Math.floor(diffS / 60)
  const diffH = Math.floor(diffM / 60)

  if (diffS < 60) return 'just now'
  if (diffM < 60) return `${diffM}m ago`
  if (diffH < 24) return `${diffH}h ago`
  return new Date(ts).toLocaleDateString()
}

export function TreeSwitcherRow({ tree, isActive, onSelect, onClosePanel }: TreeSwitcherRowProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const renameTree = useTreeStore((s) => s.renameTree)
  const deleteTree = useTreeStore((s) => s.deleteTree)

  const handleRename = async () => {
    const next = window.prompt('Rename tree', tree.title)
    if (next && next.trim() && next.trim() !== tree.title) {
      await renameTree(tree.id, next.trim())
    }
  }

  const handleDelete = async () => {
    await deleteTree(tree.id)
    setConfirmDelete(false)
    onClosePanel()
  }

  if (confirmDelete) {
    return (
      <div className="px-3 py-2">
        <div className="bg-red-950/40 border border-red-800/50 rounded px-2 py-2">
          <div className="text-xs text-red-200 mb-2">Delete this tree and all its nodes? This can't be undone.</div>
          <div className="flex gap-1">
            <button
              onClick={handleDelete}
              className="flex-1 bg-red-700 hover:bg-red-600 text-white text-xs font-medium px-2 py-1 rounded transition-colors"
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium px-2 py-1 rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-3 py-2 hover:bg-slate-800 transition-colors">
      <div className="flex items-start gap-2">
        <button
          onClick={onSelect}
          className={`flex-1 text-left transition-colors ${
            isActive ? 'text-indigo-300 font-medium' : 'text-slate-300'
          }`}
        >
          <div className="text-sm truncate">{tree.title}</div>
          <div className="text-[10px] text-slate-500 truncate">{formatWhen(tree.updatedAt)}</div>
        </button>
        <div className="flex gap-1 flex-shrink-0">
          <button
            onClick={handleRename}
            className="text-slate-500 hover:text-slate-300 transition-colors p-1"
            title="Rename tree"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-slate-500 hover:text-red-400 transition-colors p-1"
            title="Delete tree"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
