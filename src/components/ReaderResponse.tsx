import { MarkdownContent } from './MarkdownContent'
import { useThrottledText } from './useThrottledText'

/**
 * The assistant-response body of the reader panel.
 *
 * Split out of `ReaderPanel` so the streaming throttle can be a hook: the panel
 * returns `null` before it knows which node it is showing, and hooks cannot run
 * after an early return.
 */
export function ReaderResponse({ text, live }: { text: string; live: boolean }) {
  const settled = useThrottledText(text, live)

  if (!settled) {
    return <p className="text-sm text-slate-500 italic">No response yet.</p>
  }

  return (
    <div className="text-sm text-slate-200">
      <MarkdownContent markdown={settled} />
    </div>
  )
}
