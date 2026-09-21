import { AlertTriangle, ExternalLink } from 'lucide-react'

const DEFAULT_HOST = 'openrouter.ai'
const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'
const KEY_SETTINGS_URL = 'https://openrouter.ai/settings/keys'

/**
 * The host the key will actually be sent to, derived the same way
 * `streamingClient.streamOpenRouter` derives it: empty base URL falls back to
 * the OpenRouter default. `null` when the value doesn't parse as a URL — which
 * is itself worth flagging, since nothing else in the form validates it.
 */
function destinationHost(baseUrl: string): string | null {
  try {
    return new URL(baseUrl.trim() || DEFAULT_BASE_URL).host
  } catch {
    return null
  }
}

interface KeyGuidanceProps {
  /** The draft base URL, so the destination updates as it is edited. */
  openRouterBaseUrl: string
  /** Whether a key is *persisted* — a typed-but-unsaved key has nothing to forget. */
  hasStoredKey: boolean
  onForget: () => void
}

/**
 * What someone needs to know before pasting an OpenRouter key into a browser
 * app they don't control: save it (OpenRouter shows it once), scope it (a spend
 * limit is the real control — blast radius, not secrecy), where it gets sent,
 * and how to take it back out.
 *
 * Presentational. Lives apart from `SettingsCredentialField` so neither file
 * crosses the 150-line component cap.
 */
export function KeyGuidance({ openRouterBaseUrl, hasStoredKey, onForget }: KeyGuidanceProps) {
  const host = destinationHost(openRouterBaseUrl)
  const isDefaultHost = host === DEFAULT_HOST

  return (
    <div data-testid="key-guidance" className="space-y-3 text-xs leading-relaxed">
      <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-3">
        <p className="text-slate-300">
          <span className="font-medium text-slate-200">Save it. </span>
          OpenRouter shows this key only once. Save it in your password manager before
          continuing.
        </p>

        <p className="text-slate-300">
          <span className="font-medium text-slate-200">Scope it. </span>
          Use a dedicated key with a spend limit for this app.{' '}
          <a
            href={KEY_SETTINGS_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-indigo-400 underline hover:text-indigo-300"
          >
            OpenRouter key settings
            <ExternalLink size={11} />
          </a>
        </p>

        <p className="text-slate-400">
          This is an early build shared for testing. The key is stored in this browser,
          and your trees live only on this machine.
        </p>
      </div>

      <p
        data-testid="key-destination"
        className={isDefaultHost ? 'text-slate-500' : 'text-amber-300'}
      >
        {isDefaultHost ? (
          <>Key is sent to {host}</>
        ) : (
          <span className="inline-flex items-start gap-1.5">
            <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
            <span>
              Non-default destination — the key will be sent to{' '}
              <span className="font-medium">{host ?? openRouterBaseUrl.trim()}</span>, not{' '}
              {DEFAULT_HOST}.
            </span>
          </span>
        )}
      </p>

      {hasStoredKey && (
        <button
          type="button"
          onClick={onForget}
          className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-200 bg-red-950/60 border border-red-900 hover:bg-red-900/60 transition-colors"
        >
          Forget key
        </button>
      )}
    </div>
  )
}
