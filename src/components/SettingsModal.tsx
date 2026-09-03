import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useSettingsStore } from '../store/settingsStore'
import { ProviderSelect } from './ProviderSelect'
import { ModelSelect } from './ModelSelect'
import { SettingsCredentialField } from './SettingsCredentialField'
import type { LLMProvider } from '../types'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
}

const EMPTY_DRAFT = {
  provider: 'openrouter' as LLMProvider,
  openRouterApiKey: '',
  openRouterBaseUrl: '',
  ollamaBaseUrl: '',
  defaultModel: '',
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const settings = useSettingsStore((s) => s.settings)
  const updateSettings = useSettingsStore((s) => s.updateSettings)

  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setDraft({
        provider: settings.provider,
        openRouterApiKey: settings.openRouterApiKey ?? '',
        openRouterBaseUrl: settings.openRouterBaseUrl ?? '',
        ollamaBaseUrl: settings.ollamaBaseUrl,
        defaultModel: settings.defaultModel,
      })
    }
  }, [open, settings])

  if (!open) return null

  // Every slot is written on Save regardless of the selected provider, so the
  // HeaderBar "no provider configured" banner logic stays unchanged.
  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSettings({
        provider: draft.provider,
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

  const setField = (field: keyof typeof draft, value: string) =>
    setDraft((prev) => ({ ...prev, [field]: value }))

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-96 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-200">Settings</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-300 transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <ProviderSelect
            value={draft.provider}
            onChange={(value) => setDraft((prev) => ({ ...prev, provider: value }))}
          />

          <SettingsCredentialField
            provider={draft.provider}
            openRouterApiKey={draft.openRouterApiKey}
            openRouterBaseUrl={draft.openRouterBaseUrl}
            ollamaBaseUrl={draft.ollamaBaseUrl}
            onChange={setField}
          />

          <div>
            <label
              htmlFor="settings-default-model"
              className="block text-xs font-medium text-slate-400 mb-2"
            >
              Default model
            </label>
            <ModelSelect
              id="settings-default-model"
              ariaLabel="Default model"
              provider={draft.provider}
              value={draft.defaultModel}
              onChange={(m) => setDraft((d) => ({ ...d, defaultModel: m }))}
            />
          </div>
        </div>

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
