import { useEffect, useState } from 'react'
import { Copy, Check, X } from 'lucide-react'
import { useReaderPanel } from './useReaderPanel'
import { useTreeStore } from '../store/useTreeStore'
import { MarkdownContent } from './MarkdownContent'
import { MessageActions } from './MessageActions'
import { NodeDispatchControls } from './NodeDispatchControls'
import { estimateContextTokens, CONTEXT_WARN_TOKENS } from '../lib/contextEstimate'

export function ReaderPanel() {
  const nodeId = useReaderPanel((s) => s.nodeId)
  const close = useReaderPanel((s) => s.close)
  const node = useTreeStore((s) => (nodeId ? s.nodes.get(nodeId) : undefined))
  const liveText = useTreeStore((s) => (nodeId ? s.liveText.get(nodeId) : undefined))
  const nodes = useTreeStore((s) => s.nodes)
  const [copied, setCopied] = useState(false)

  const estTokens = node ? estimateContextTokens(node.id, nodes) : 0

  // Close on Escape key
  useEffect(() => {
    if (!nodeId) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [nodeId, close])

  // Reset copied state after 1.5s
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  if (!nodeId || !node) return null

  const fullResponse = liveText ?? node.assistantResponse

  const handleCopy = async () => {
    if (!navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(fullResponse)
      setCopied(true)
    } catch {
      // Silently fail
    }
  }

  return (
    <div className="w-[28rem] max-w-[40vw] shrink-0 border-l border-slate-800 bg-slate-900 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Full text</h2>
        <div className="flex items-center gap-2">
          <MessageActions node={node} isActive />
          <button
            onClick={handleCopy}
            title="Copy response"
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
          </button>
          <button
            onClick={close}
            title="Close"
            aria-label="Close"
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
        {/* Context info */}
        <div className="text-xs text-slate-400 space-y-1">
          <div>Estimated context: ~{estTokens.toLocaleString()} tokens</div>
          {node?.inputTokens != null && node?.outputTokens != null && (
            <div>Last generation: {node.inputTokens.toLocaleString()} in · {node.outputTokens.toLocaleString()} out</div>
          )}
          {estTokens > CONTEXT_WARN_TOKENS && (
            <div className="text-amber-400">Deep context — approaching typical model limits.</div>
          )}
        </div>

        <NodeDispatchControls node={node} />

        {/* User prompt */}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">User prompt</p>
          <p className="text-sm text-slate-200 whitespace-pre-wrap break-words">
            {node.userPrompt}
          </p>
        </div>

        {/* Assistant response */}
        <div>
          <p className="text-xs font-medium text-slate-400 mb-1">Assistant response</p>
          {fullResponse ? (
            <div className="text-sm text-slate-200">
              <MarkdownContent markdown={fullResponse} />
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No response yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}
