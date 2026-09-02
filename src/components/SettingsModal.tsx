import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useSettingsStore } from '../store/settingsStore'
import { MaskedInput } from './MaskedInput'
import { ProviderSelect } from './ProviderSelect'
import type { LLMProvider } from '../types'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const settings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  const [draft, setDraft] = useState({
    provider: 'gemini' as LLMProvider,
    geminiApiKey: '',
    openRouterApiKey: '',
    openRouterBaseUrl: '',
    ollamaBaseUrl: '',
    defaultModel: '',
  })

  const [showGeminiKey, setShowGeminiKey] = useState(false)
  const [showOpenRouterKey, setShowOpenRouterKey] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft({
        provider: settings.provider,
        geminiApiKey: settings.geminiApiKey ?? '',
        openRouterApiKey: settings.openRouterApiKey ?? '',
        openRouterBaseUrl: settings.openRouterBaseUrl ?? '',
        ollamaBaseUrl: settings.ollamaBaseUrl,
        defaultModel: settings.defaultModel,
      })
      setShowGeminiKey(false)
      setShowOpenRouterKey(false)
    }
  }, [open, settings])

  if (!open) return null

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings({
        provider: draft.provider,
        geminiApiKey: draft.geminiApiKey.trim() || undefined,
        openRouterApiKey: draft.openRouterApiKey.trim() || undefined,
        openRouterBaseUrl: draft.openRouterBaseUrl.trim() || undefined,
        ollamaBaseUrl: draft.ollamaBaseUrl.trim(),
        defaultModel: draft.defaultModel.trim(),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (field: keyof typeof draft, value: string) => {
    setDraft((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-96 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-200">Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300 transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <ProviderSelect
            value={draft.provider}
            onChange={(value) => setDraft((prev) => ({ ...prev, provider: value }))}
          />
          <MaskedInput
            label="Gemini API key"
            value={draft.geminiApiKey}
            onChange={(value) => handleChange('geminiApiKey', value)}
            placeholder="sk-..."
            showPassword={showGeminiKey}
            onToggleShow={() => setShowGeminiKey(!showGeminiKey)}
          />

          <MaskedInput
            label="OpenRouter API key"
            value={draft.openRouterApiKey}
            onChange={(value) => handleChange('openRouterApiKey', value)}
            placeholder="sk-..."
            showPassword={showOpenRouterKey}
            onToggleShow={() => setShowOpenRouterKey(!showOpenRouterKey)}
          />

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              OpenRouter base URL
            </label>
            <input
              type="text"
              value={draft.openRouterBaseUrl}
              onChange={(e) => handleChange('openRouterBaseUrl', e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="https://openrouter.ai/api/v1"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Ollama base URL
            </label>
            <input
              type="text"
              value={draft.ollamaBaseUrl}
              onChange={(e) => handleChange('ollamaBaseUrl', e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="http://localhost:11434"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-2">
              Default model
            </label>
            <input
              type="text"
              value={draft.defaultModel}
              onChange={(e) => handleChange('defaultModel', e.target.value)}
              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="gemini-2.5-flash"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-slate-200 bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
