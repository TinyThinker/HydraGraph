import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useSettingsStore } from '../store/settingsStore'
import { ProviderSelect } from './ProviderSelect'
import { ModelSelect } from './ModelSelect'
import { SettingsCredentialField } from './SettingsCredentialField'
import { KeyGuidance } from './KeyGuidance'
import { DataLocationNote } from './DataLocationNote'
import { ConnectionTest } from './ConnectionTest'
import { SettingsFooter } from './SettingsFooter'
import { useConnectionTest } from './useConnectionTest'
import { SettingsSteps } from './SettingsSteps'
import { useSetupSteps } from './useSetupSteps'
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
  const forgetApiKey = useSettingsStore((s) => s.forgetApiKey)

  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [saving, setSaving] = useState(false)
  const test = useConnectionTest(draft)
  const resetTest = test.reset
  const setup = useSetupSteps(draft, test.state)

  // Copy settings into the draft only when the modal opens. Background writes
  // (durability, export stamps) change `settings` while it is open and must
  // not wipe what the user is typing. Closing drops the test result and aborts
  // a probe still in flight.
  useEffect(() => {
    if (!open) {
      resetTest()
      return
    }
    const s = useSettingsStore.getState().settings
    setDraft({
      provider: s.provider,
      openRouterApiKey: s.openRouterApiKey ?? '',
      openRouterBaseUrl: s.openRouterBaseUrl ?? '',
      ollamaBaseUrl: s.ollamaBaseUrl,
      defaultModel: s.defaultModel,
    })
  }, [open, resetTest])

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

  // Wipe both copies: the persisted row and the field being edited. The draft
  // does not re-sync from settings while open, so this clear is required.
  const handleForget = async () => {
    await forgetApiKey()
    setDraft((prev) => ({ ...prev, openRouterApiKey: '' }))
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
          <SettingsSteps steps={setup.steps} current={setup.current} />
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
            ollamaHintOpen={test.result?.ok === false && test.result.kind === 'network'}
            guidance={
              <KeyGuidance
                openRouterBaseUrl={draft.openRouterBaseUrl}
                hasStoredKey={Boolean(settings.openRouterApiKey?.trim())}
                onForget={() => void handleForget()}
              />
            }
          />
          <ConnectionTest state={test.state} result={test.result} onRun={() => void test.run()} />

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
          <DataLocationNote />
        </div>

        <SettingsFooter saving={saving} onCancel={onClose} onSave={() => void handleSave()} />
      </div>
    </div>
  )
}
