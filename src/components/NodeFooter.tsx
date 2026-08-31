import { memo, useState } from 'react'
import { Trash2, GitBranch, Zap, Shield } from 'lucide-react'
import { useTreeStore, collectSubtreeIds } from '../store/useTreeStore'
import { SystemPromptEditor } from './SystemPromptEditor'
import { ModelPicker } from './ModelPicker'
import type { TurnNodeData } from '../types'

export const NodeFooter = memo(function NodeFooter({ node }: { node: TurnNodeData }) {
  const [confirmCount, setConfirmCount] = useState<number | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const deleteNodeSubtree = useTreeStore((s) => s.deleteNodeSubtree)
  const addNode = useTreeStore((s) => s.addNode)
  const defaultModel = useTreeStore((s) => s.settings.defaultModel)
  const isRoot = node.parentId === null

  const handleBranch = () => {
    addNode({
      id: crypto.randomUUID(),
      treeId: node.treeId,
      parentId: node.id,
      childrenIds: [],
      userPrompt: '',
      assistantResponse: '',
      positionX: node.positionX + node.childrenIds.length * 350,
      positionY: node.positionY + 250,
      isCollapsed: false,
      status: 'idle',
      modelUsed: defaultModel,
      timestamp: Date.now(),
    })
  }

  return (
    <>
      {/* Delete confirmation */}
      {confirmCount !== null && (
        <div className="bg-red-950/40 border-t border-red-800/50 px-3 py-2 text-xs text-red-200">
          <div className="mb-2">Remove {confirmCount} node{confirmCount === 1 ? '' : 's'}? This can't be undone.</div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await deleteNodeSubtree(node.id)
                setConfirmCount(null)
              }}
              className="flex-1 bg-red-700 hover:bg-red-600 text-white px-2 py-1 rounded text-xs font-medium transition-colors nodrag"
            >
              Remove {confirmCount}
            </button>
            <button
              onClick={() => setConfirmCount(null)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-2 py-1 rounded text-xs font-medium transition-colors nodrag"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700">
        <button
          onClick={() => setModelPickerOpen((v) => !v)}
          disabled={node.status === 'streaming'}
          title="Change the model for this node"
          className={`flex items-center gap-1 text-xs nodrag transition-colors ${
            node.status === 'streaming'
              ? 'opacity-50 cursor-not-allowed text-slate-500'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <Zap size={10} />
          {node.modelUsed}
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditorOpen(!editorOpen)}
            title="Edit this node's system prompt"
            className={`text-xs nodrag transition-colors ${node.systemPromptOverride ? 'text-amber-400 hover:text-amber-300' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Shield size={12} />
          </button>
          <button
            onClick={() => {
              if (!isRoot) {
                const count = collectSubtreeIds(node.id, useTreeStore.getState().nodes).size
                setConfirmCount(count)
              }
            }}
            disabled={isRoot}
            title={isRoot ? "The root node can't be deleted" : 'Delete this node and all descendants'}
            className={`text-xs nodrag transition-colors ${isRoot ? 'text-slate-700 cursor-not-allowed' : 'text-slate-500 hover:text-red-400'}`}
          >
            <Trash2 size={12} />
          </button>
          <button
            onClick={handleBranch}
            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors nodrag"
          >
            <GitBranch size={12} /> Branch
          </button>
        </div>
      </div>

      {/* System prompt editor overlay */}
      {editorOpen && <SystemPromptEditor node={node} onClose={() => setEditorOpen(false)} />}

      {/* Model picker overlay */}
      {modelPickerOpen && <ModelPicker node={node} onClose={() => setModelPickerOpen(false)} />}
    </>
  )
})
