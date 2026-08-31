import { useState } from 'react'
import { Settings, AlertTriangle, LayoutGrid } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'
import { SettingsModal } from './SettingsModal'
import { TreeSwitcher } from './TreeSwitcher'

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'

export function HeaderBar() {
  const [modalOpen, setModalOpen] = useState(false)
  const [confirmRelayout, setConfirmRelayout] = useState(false)
  const settings = useTreeStore((s) => s.settings)
  const relayoutActiveTree = useTreeStore((s) => s.relayoutActiveTree)

  // Banner is shown if no provider is configured: no Gemini key, no OpenRouter key,
  // and Ollama is either unconfigured or still at the default untested URL
  const hasGeminiKey = settings?.geminiApiKey?.trim()
  const hasOpenRouterKey = settings?.openRouterApiKey?.trim()
  const ollamaUrl = settings?.ollamaBaseUrl?.trim() || ''
  const isOllamaConfigured = ollamaUrl && ollamaUrl !== DEFAULT_OLLAMA_URL
  const needsProvider = !hasGeminiKey && !hasOpenRouterKey && !isOllamaConfigured

  return (
    <>
      <div className="h-12 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900">
        <TreeSwitcher />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setConfirmRelayout(true)}
            className="text-slate-400 hover:text-slate-200 transition-colors p-2"
            title="Re-run auto-layout for the whole tree"
          >
            <LayoutGrid size={20} />
          </button>
          <button
            onClick={() => setModalOpen(true)}
            className="text-slate-400 hover:text-slate-200 transition-colors p-2"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>
      {confirmRelayout && (
        <div className="bg-amber-950/40 border-b border-amber-800/50 text-amber-300 text-sm px-4 py-3">
          <div className="mb-2">Re-running auto-layout will discard your manual node positions.</div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await relayoutActiveTree()
                setConfirmRelayout(false)
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1 rounded transition-colors nodrag"
            >
              Re-layout
            </button>
            <button
              onClick={() => setConfirmRelayout(false)}
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium px-3 py-1 rounded transition-colors nodrag"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {needsProvider && (
        <div className="flex items-center justify-between px-4 py-3 bg-amber-950/40 border-b border-amber-800/50 text-amber-300 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="flex-shrink-0" />
            <span>No LLM provider configured. Add a Gemini or OpenRouter API key, or point at a running Ollama server, to start generating.</span>
          </div>
          <button
            onClick={() => setModalOpen(true)}
            className="text-amber-200 underline hover:text-amber-100 transition-colors flex-shrink-0 ml-4"
          >
            Open settings
          </button>
        </div>
      )}
      <SettingsModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
