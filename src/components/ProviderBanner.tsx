import { AlertTriangle, Sparkles } from 'lucide-react'
import { useSettingsStore, configuredProviders } from '../store/settingsStore'
import { useTreeStore } from '../store/useTreeStore'
import { isDemoTree } from '../lib/demoTree'

/**
 * The strip under the header when no provider is configured.
 *
 * Two voices on purpose. Looking at the shipped demo tree, nothing is broken —
 * the responses are canned and need no key — so the strip explains what you're
 * looking at. On your own tree, a missing provider really is a blocker and the
 * warning stays. Renders nothing once a provider is configured.
 */
export function ProviderBanner({ onOpenSettings }: { onOpenSettings: () => void }) {
  const settings = useSettingsStore((s) => s.settings)
  const activeTreeId = useTreeStore((s) => s.activeTreeId)

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
          </span>
        </div>
        <button
          onClick={onOpenSettings}
          className="text-indigo-100 underline hover:text-white transition-colors flex-shrink-0"
        >
          Add a key
        </button>
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
