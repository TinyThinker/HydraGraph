import { memo, useState, useMemo } from 'react'
import { useTreeStore } from '../store/useTreeStore'
import type { TurnNodeData } from '../types'

const MODELS_BY_PROVIDER: Record<'gemini' | 'openrouter' | 'ollama', string[]> = {
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  openrouter: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.1-70b-instruct'],
  ollama: ['llama3.1', 'llama3.2', 'mistral', 'qwen2.5'],
}

interface ModelPickerProps {
  node: TurnNodeData
  onClose: () => void
}

export const ModelPicker = memo(function ModelPicker({ node, onClose }: ModelPickerProps) {
  const updateNode = useTreeStore((s) => s.updateNode)
  const settingsProvider = useTreeStore((s) => s.settings.provider)
  const defaultModel = useTreeStore((s) => s.settings.defaultModel)
  const [customModel, setCustomModel] = useState('')

  const provider = node.provider ?? settingsProvider

  // Build option list: curated models first, then union in defaultModel and node.modelUsed, dedupe, preserve order
  const optionList = useMemo(() => {
    const curated = MODELS_BY_PROVIDER[provider] ?? []
    const seen = new Set(curated)
    const result = [...curated]

    // Add defaultModel if not already present
    if (!seen.has(defaultModel)) {
      result.push(defaultModel)
      seen.add(defaultModel)
    }

    // Add node.modelUsed if not already present
    if (!seen.has(node.modelUsed)) {
      result.push(node.modelUsed)
    }

    return result
  }, [provider, defaultModel, node.modelUsed])

  const choose = async (m: string) => {
    const v = m.trim()
    if (!v) return
    await updateNode(node.id, { modelUsed: v })
    onClose()
  }

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      choose(customModel)
    }
  }

  return (
    <div className="nodrag absolute left-2 right-2 bottom-10 z-20 bg-slate-900 border border-slate-600 rounded-lg shadow-2xl p-3 space-y-2 max-h-[80%] overflow-y-auto">
      <div className="text-xs font-semibold text-slate-300">Model for this node</div>
      <div className="text-[10px] text-slate-500">Provider: {provider}</div>

      {/* Option list */}
      <div className="space-y-1">
        {optionList.map((m) => (
          <button
            key={m}
            onClick={() => choose(m)}
            className={`nodrag w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${
              m === node.modelUsed
                ? 'bg-indigo-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-slate-600 my-2" />

      {/* Free-text input */}
      <div className="space-y-1.5">
        <input
          value={customModel}
          onChange={(e) => setCustomModel(e.target.value)}
          onKeyDown={handleCustomKeyDown}
          placeholder="Custom model name…"
          className="nodrag w-full text-xs px-2 py-1.5 rounded bg-slate-800 border border-slate-600 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <div className="flex gap-1">
          <button
            onClick={() => choose(customModel)}
            disabled={!customModel.trim()}
            className="nodrag flex-1 text-xs px-2 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Set
          </button>
          <button
            onClick={onClose}
            className="nodrag flex-1 text-xs px-2 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
})
