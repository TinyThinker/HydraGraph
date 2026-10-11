import { CheckCircle2, XCircle } from 'lucide-react'
import type { ProbeResult } from '../lib/connectionProbe'
import type { ConnectionTestState } from './useConnectionTest'

interface ConnectionTestProps {
  state: ConnectionTestState
  result: ProbeResult | null
  onRun: () => void
}

/**
 * "Test connection" button plus one result line. Presentational: the state
 * lives in `SettingsModal` (via `useConnectionTest`) because the Ollama hint
 * and the step row read it too.
 */
export function ConnectionTest({ state, result, onRun }: ConnectionTestProps) {
  const testing = state === 'testing'

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onRun}
        disabled={testing}
        className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {testing ? 'Testing…' : 'Test connection'}
      </button>

      {state === 'ok' && result?.ok && (
        <p role="status" className="flex items-start gap-1.5 text-xs text-emerald-400">
          <CheckCircle2 size={14} className="mt-px shrink-0" />
          <span>{result.detail ?? 'Connected.'}</span>
        </p>
      )}

      {state === 'fail' && result && !result.ok && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-red-400">
          <XCircle size={14} className="mt-px shrink-0" />
          <span>{result.message}</span>
        </p>
      )}
    </div>
  )
}
