import { X, Plus } from 'lucide-react'
import { useReportStore } from '../store/useReportStore'
import { useTreeStore } from '../store/useTreeStore'
import { ReportComposer } from './ReportComposer'

/**
 * Right-side panel for reports, same frame as ReaderPanel. Shows the composer
 * while composing (or when the tree has no report), otherwise the active report.
 */
export function ReportPanel() {
  const panelOpen = useReportStore((s) => s.panelOpen)
  const composing = useReportStore((s) => s.composing)
  const generating = useReportStore((s) => s.generating)
  const liveText = useReportStore((s) => s.liveText)
  const activeReportId = useReportStore((s) => s.activeReportId)
  const report = useTreeStore((s) =>
    s.trees.find((t) => t.id === s.activeTreeId)?.reports?.find((r) => r.id === activeReportId),
  )

  if (!panelOpen) return null
  const showComposer = composing || (!report && !generating)
  const { compose, closePanel, cancel } = useReportStore.getState()

  return (
    <div className="w-[28rem] max-w-[40vw] shrink-0 border-l border-slate-800 bg-slate-900 flex flex-col overflow-hidden">
      <div className="shrink-0 border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">{showComposer ? 'New report' : 'Report'}</h2>
        <div className="flex items-center gap-2">
          {generating && (
            <button onClick={cancel} className="rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-200 hover:bg-slate-600">
              Stop
            </button>
          )}
          {!showComposer && !generating && (
            <button
              onClick={() => compose()}
              title="New report"
              aria-label="New report"
              className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Plus size={16} />
            </button>
          )}
          <button
            onClick={closePanel}
            title="Close"
            aria-label="Close report panel"
            className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
        {showComposer ? (
          <ReportComposer />
        ) : (
          <div className="whitespace-pre-wrap text-sm text-slate-200">{liveText ?? report?.text}</div>
        )}
      </div>
    </div>
  )
}
