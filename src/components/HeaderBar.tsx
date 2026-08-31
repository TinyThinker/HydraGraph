import { useState } from 'react'
import { Settings, AlertTriangle } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'
import { SettingsModal } from './SettingsModal'

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'

export function HeaderBar() {
  const [modalOpen, setModalOpen] = useState(false)
  const activeTreeId = useTreeStore((s) => s.activeTreeId)
  const trees = useTreeStore((s) => s.trees)
  const settings = useTreeStore((s) => s.settings)

  const activeTree = activeTreeId ? trees.find((t) => t.id === activeTreeId) : null
  const title = activeTree?.title ?? 'Untitled'

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
        <span className="text-slate-200 font-medium">{title}</span>
        <button
          onClick={() => setModalOpen(true)}
          className="text-slate-400 hover:text-slate-200 transition-colors p-2"
        >
          <Settings size={20} />
        </button>
      </div>
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
