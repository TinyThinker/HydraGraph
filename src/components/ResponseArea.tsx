import { memo } from 'react'
import { MarkdownContent } from './MarkdownContent'

const RENDERED_TEXT_CAP = 2000

interface ResponseAreaProps {
  responseText: string
  isTruncated: boolean
  visibleText: string
  onOpenFullText: () => void
}

export const ResponseArea = memo(function ResponseArea({
  responseText,
  isTruncated,
  visibleText,
  onOpenFullText,
}: ResponseAreaProps) {
  if (!responseText) return null

  return (
    <div className="px-3 pb-3 border-t border-slate-700 pt-2 flex-1 min-h-0 flex flex-col">
      <div className="text-xs text-slate-400 mb-1 font-medium">🤖 Assistant</div>
      {isTruncated && (
        <div className="text-xs text-slate-500 mb-2">
          Showing the last {RENDERED_TEXT_CAP.toLocaleString()} characters of a longer response.
          <button
            title="Open the full response"
            onClick={onOpenFullText}
            className="ml-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors nodrag"
          >
            Open full text
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto text-sm text-slate-200 break-words">
        <MarkdownContent markdown={visibleText} />
      </div>
    </div>
  )
})
