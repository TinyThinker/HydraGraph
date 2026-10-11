import { useState } from 'react'

interface OllamaOriginsHintProps {
  /** Force the hint open — `SettingsModal` sets it after a network failure. */
  open: boolean
}

const CODE_CLASS =
  'block whitespace-pre-wrap break-all rounded bg-slate-950 px-2 py-1.5 font-mono text-[11px] text-slate-200'

/**
 * The `OLLAMA_ORIGINS` fix, shown next to the Ollama option with this page's
 * own origin filled in, plus Chrome's Local Network Access prompt. Once
 * opened (by the user or by `open`) it stays open until the user closes it.
 */
export function OllamaOriginsHint({ open }: OllamaOriginsHintProps) {
  const [userOpen, setUserOpen] = useState(false)
  const origin = window.location.origin

  return (
    <details
      data-testid="ollama-origins-hint"
      open={open || userOpen}
      onToggle={(e) => setUserOpen(e.currentTarget.open)}
      className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs leading-relaxed"
    >
      <summary className="cursor-pointer font-medium text-slate-300">
        Requests to Ollama failing?
      </summary>
      <div className="mt-2 space-y-2 text-slate-400">
        <p>
          Ollama only answers websites listed in <code>OLLAMA_ORIGINS</code>. This is the cause
          when requests fail instantly. Start Ollama with this site allowed:
        </p>
        <code className={CODE_CLASS}>{`OLLAMA_ORIGINS="${origin}" ollama serve`}</code>
        <p>On macOS with the Ollama app, set it once, then quit and reopen Ollama:</p>
        <code className={CODE_CLASS}>{`launchctl setenv OLLAMA_ORIGINS "${origin}"`}</code>
        <p>
          Chrome asks permission before a website can reach apps on your computer. Choose
          Allow. If you blocked it, change it in the site settings (icon left of the address
          bar).
        </p>
      </div>
    </details>
  )
}
