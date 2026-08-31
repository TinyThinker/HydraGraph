import { AlertTriangle } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'
import { CONTEXT_WARN_TOKENS } from '../lib/contextEstimate'

export function ContextMeter({ tokens, inputTokens, outputTokens, status }: { tokens: number | null; inputTokens?: number; outputTokens?: number; status?: 'idle' | 'streaming' | 'error' }) {
  const isAnyStreaming = useTreeStore((s) => s.liveText.size > 0)

  // Hide during any streaming
  if (isAnyStreaming || status === 'streaming') {
    return null
  }

  // Show actual token counts if available
  if (inputTokens != null && outputTokens != null) {
    return (
      <div className="px-3 pt-2">
        <div className="text-[10px] text-slate-500">
          context sent: {inputTokens.toLocaleString()} in · {outputTokens.toLocaleString()} out tokens
        </div>
      </div>
    )
  }

  // Show estimate with optional warning
  if (tokens != null) {
    return (
      <div className="px-3 pt-2 space-y-0.5">
        <div className="text-[10px] text-slate-500">
          ~{tokens.toLocaleString()} tokens of context
        </div>
        {tokens > CONTEXT_WARN_TOKENS && (
          <div className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-950/30 border border-amber-800/40 rounded px-2 py-1">
            <AlertTriangle size={10} />
            <span>Deep context — this chain is approaching typical model limits.</span>
          </div>
        )}
      </div>
    )
  }

  return null
}
