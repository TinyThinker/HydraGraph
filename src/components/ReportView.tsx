import { useMemo, useState } from 'react'
import { Copy, Check, Download, RefreshCw, ListChecks, Trash2, History } from 'lucide-react'
import { useReportStore } from '../store/useReportStore'
import { useTreeStore } from '../store/useTreeStore'
import { useCatalogStore } from '../store/catalogStore'
import { ReaderResponse } from './ReaderResponse'
import { collectReportTurns, reportSourceDigest } from '../lib/reportContext'
import { downloadReport } from '../lib/reportDownload'
import { turnCostUSD, formatUSD } from '../lib/pricing'
import type { ConversationTree, TreeReport } from '../types'

const ICON_BUTTON = 'p-1 text-slate-400 hover:text-slate-200 transition-colors'
const date = (ms: number) => new Date(ms).toLocaleDateString()

/** A report is stale once any source turn changed length or a ticked turn is gone. */
function useIsStale(report: TreeReport | undefined): boolean {
  const nodes = useTreeStore((s) => s.nodes)
  return useMemo(() => {
    if (!report) return false
    if (report.leafIds.some((id) => !nodes.has(id))) return true
    return reportSourceDigest(collectReportTurns(report.leafIds, nodes)) !== report.sourceDigest
  }, [report, nodes])
}

function metaLine(report: TreeReport, cost: number | null): string {
  const parts = [report.model]
  if (report.inputTokens != null && report.outputTokens != null) {
    parts.push(`${report.inputTokens.toLocaleString()} in · ${report.outputTokens.toLocaleString()} out`)
  }
  if (cost != null) parts.push(formatUSD(cost))
  parts.push(date(report.updatedAt))
  return parts.join(' · ')
}

export function ReportView({ tree, report }: { tree: ConversationTree; report: TreeReport | undefined }) {
  const liveText = useReportStore((s) => s.liveText)
  const generating = useReportStore((s) => s.generating)
  const models = useCatalogStore((s) => s.models)
  const stale = useIsStale(report)
  const [copied, setCopied] = useState(false)
  const reports = tree.reports ?? []

  if (generating || !report) {
    return <ReaderResponse text={liveText ?? ''} live={generating} />
  }

  const cost = turnCostUSD({ modelUsed: report.model, provider: report.provider, inputTokens: report.inputTokens, outputTokens: report.outputTokens }, models)
  const { generate, compose, setActiveReport } = useReportStore.getState()

  const copy = async () => {
    try {
      await navigator.clipboard?.writeText(report.text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard refused; nothing to show.
    }
  }
  const remove = async () => {
    await useTreeStore.getState().deleteReport(tree.id, report.id)
    const left = reports.filter((r) => r.id !== report.id)
    setActiveReport(left.length ? left[left.length - 1].id : null)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-slate-400">{metaLine(report, cost)}</p>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={copy} title="Copy" aria-label="Copy report" className={ICON_BUTTON}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button onClick={() => downloadReport(tree, report)} title="Download .md" aria-label="Download report" className={ICON_BUTTON}>
            <Download size={14} />
          </button>
          <button
            onClick={() => void generate({ brief: report.brief, provider: report.provider, model: report.model, leafIds: report.leafIds, reportId: report.id })}
            title="Regenerate"
            aria-label="Regenerate report"
            className={ICON_BUTTON}
          >
            <RefreshCw size={14} />
          </button>
          <button onClick={() => compose(report.leafIds)} title="Edit selection" aria-label="Edit selection" className={ICON_BUTTON}>
            <ListChecks size={14} />
          </button>
          <button onClick={() => void remove()} title="Delete" aria-label="Delete report" className={ICON_BUTTON}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {stale && (
        <p className="flex items-center gap-1 rounded bg-amber-950/40 px-2 py-1 text-xs text-amber-300">
          <History size={12} /> Sources changed since this was written
        </p>
      )}
      {report.status === 'error' && <p className="text-xs text-red-400">{report.errorMessage ?? 'Failed'}</p>}

      <ReaderResponse text={report.text} live={false} />

      {reports.length > 1 && (
        <div className="border-t border-slate-800 pt-2">
          <p className="mb-1 text-xs font-medium text-slate-400">Reports on this tree</p>
          <ul className="space-y-0.5">
            {reports.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => setActiveReport(r.id)}
                  aria-current={r.id === report.id}
                  className={`w-full truncate text-left text-xs ${r.id === report.id ? 'text-indigo-300' : 'text-slate-300 hover:text-slate-100'}`}
                >
                  {r.title} · {date(r.createdAt)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
