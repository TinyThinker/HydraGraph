import { AlertTriangle, Sparkles } from 'lucide-react'
import { useSettingsStore, configuredProviders } from '../store/settingsStore'
import { useTreeStore } from '../store/useTreeStore'
import { isDemoTree } from '../lib/demoTree'
import { useImportPicker } from './useImportPicker'

/**
 * The strip under the header when no provider is configured.
 *
 * Two voices on purpose. Looking at the shipped demo tree, nothing is broken —
 * the responses are canned and need no key — so the strip explains what you're
 * looking at. On your own tree, a missing provider really is a blocker and the
 * warning stays. Renders nothing once a provider is configured.
 *
 * The demo voice also offers "Import a backup": an evicted returner boots into
 * the demo too, and the app cannot tell them from a first-time visitor.
 */
export function ProviderBanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const settings = useSettingsStore((s) => s.settings)
  const activeTreeId = useTreeStore((s) => s.activeTreeId)
  const importer = useImportPicker()

  if (configuredProviders(settings).length > 0) return null

  if (isDemoTree(activeTreeId)) {
    return (
      <div
        data-testid="demo-banner"
        className="flex items-center justify-between gap-4 px-4 py-3 bg-indigo-950/40 border-b border-indigo-800/50 text-indigo-200 text-sm"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="flex-shrink-0" />
          <span>
            You're in the demo tree — canned responses from a real session, no API key needed.
            Click any node to read it, open the three siblings below the fan-out with Compare, and
            the $ receipt in the header is already priced.
            {importer.error && (
              <span role="alert" className="block mt-1 text-red-300">
                {importer.error}
              </span>
            )}
          </span>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <button
            onClick={onOpenSettings}
            className="text-indigo-100 underline hover:text-white transition-colors"
          >
            Add a key
          </button>
          <input {...importer.inputProps} data-testid="demo-import-input" />
          <button
            onClick={importer.pick}
            className="text-indigo-300 underline hover:text-white transition-colors text-xs"
          >
            Returning? Import a backup.
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="provider-banner"
      className="flex items-center justify-between px-4 py-3 bg-amber-950/40 border-b border-amber-800/50 text-amber-300 text-sm"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="flex-shrink-0" />
        <span>
          No LLM provider configured. Add an OpenRouter API key, or point at a running Ollama
          server, to start generating.
        </span>
      </div>
      <button
        onClick={onOpenSettings}
        className="text-amber-200 underline hover:text-amber-100 transition-colors flex-shrink-0 ml-4"
      >
        Open settings
      </button>
    </div>
  )
}
