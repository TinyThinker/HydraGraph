import { useState, type ReactNode } from 'react'
import { MaskedInput } from './MaskedInput'
import { useCatalogStore } from '../store/catalogStore'
import type { LLMProvider } from '../types'

const INPUT_CLASS =
  'w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

/** Coarse "x ago" for the catalog freshness line; "never" when unfetched. */
function relative(ts: number | null): string {
  if (ts === null) return 'never'
  const diffM = Math.floor((Date.now() - ts) / 60_000)
  if (diffM < 1) return 'just now'
  if (diffM < 60) return `${diffM}m ago`
  const diffH = Math.floor(diffM / 60)
  if (diffH < 24) return `${diffH}h ago`
  return new Date(ts).toLocaleDateString()
}

export type CredentialField = 'openRouterApiKey' | 'openRouterBaseUrl' | 'ollamaBaseUrl'

interface SettingsCredentialFieldProps {
  provider: LLMProvider
  openRouterApiKey: string
  openRouterBaseUrl: string
  ollamaBaseUrl: string
  onChange: (field: CredentialField, value: string) => void
  /**
   * Slot rendered directly under the key input, so nothing sits between pasting
   * a key and being told what to do with it. Dropped on the Ollama branch,
   * which has no key to guide.
   */
  guidance?: ReactNode
}

/**
 * The single credential control under the provider dropdown. Renders the
 * OpenRouter key (+ Advanced base URL + a "Refresh prices" catalog action) or
 * the plain Ollama URL, switched on `provider`. Presentational apart from the
 * catalog-store read/refresh.
 */
export function SettingsCredentialField({
  provider,
  openRouterApiKey,
  openRouterBaseUrl,
  ollamaBaseUrl,
  onChange,
  guidance,
}: SettingsCredentialFieldProps) {
  const [showKey, setShowKey] = useState(false)
  const source = useCatalogStore((s) => s.source)
  const fetchedAt = useCatalogStore((s) => s.fetchedAt)
  const loading = useCatalogStore((s) => s.status) === 'loading'

  if (provider === 'ollama') {
    return (
      <div>
        <label htmlFor="settings-ollama-url" className="block text-xs font-medium text-slate-400 mb-2">
          Ollama URL
        </label>
        <input
          id="settings-ollama-url"
          type="text"
          value={ollamaBaseUrl}
          onChange={(e) => onChange('ollamaBaseUrl', e.target.value)}
          className={INPUT_CLASS}
          placeholder="http://localhost:11434"
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <MaskedInput
        id="settings-openrouter-key"
        label="OpenRouter API key"
        value={openRouterApiKey}
        onChange={(v) => onChange('openRouterApiKey', v)}
        placeholder="sk-..."
        showPassword={showKey}
        onToggleShow={() => setShowKey((s) => !s)}
      />

      {guidance}

      <details>
        <summary className="cursor-pointer text-xs font-medium text-slate-400">Advanced</summary>
        <div className="mt-2">
          <label
            htmlFor="settings-openrouter-url"
            className="block text-xs font-medium text-slate-400 mb-2"
          >
            OpenRouter base URL
          </label>
          <input
            id="settings-openrouter-url"
            type="text"
            value={openRouterBaseUrl}
            onChange={(e) => onChange('openRouterBaseUrl', e.target.value)}
            className={INPUT_CLASS}
            placeholder="https://openrouter.ai/api/v1"
          />
        </div>
      </details>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void useCatalogStore.getState().loadCatalog(true)}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Refreshing…' : 'Refresh prices'}
        </button>
        <span className="text-xs text-slate-500">{`${source} · updated ${relative(fetchedAt)}`}</span>
      </div>
    </div>
  )
}
