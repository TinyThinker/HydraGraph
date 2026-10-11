import { HardDriveDownload, X } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'
import { useSettingsStore } from '../store/settingsStore'
import { reportWriteFailure } from '../store/storageStatusStore'
import { hasRealWork, REAL_WORK_TURNS } from '../lib/realWork'
import { shouldNudge, isFirmNudge } from '../lib/exportNudge'
import { ExportButton } from './ExportButton'

/**
 * The strip under the header that asks for an export of the active tree.
 *
 * Firm when the browser did not agree to persist storage: then it may clear
 * the data after a stretch without visits (Safari: 7 days). Exporting this
 * tree hides it until the tree changes again; dismiss snoozes it for 24 h.
 */
export function ExportNudge() {
  const activeTreeId = useTreeStore((s) => s.activeTreeId)
  const treeUpdatedAt = useTreeStore((s) => s.trees.find((t) => t.id === s.activeTreeId)?.updatedAt)
  const realWork = useTreeStore((s) =>
    hasRealWork(s.trees.find((t) => t.id === s.activeTreeId), s.nodes.values(), REAL_WORK_TURNS.nudge),
  )
  const persistResult = useSettingsStore((s) => s.settings.persistResult)
  const exportedAt = useSettingsStore((s) =>
    activeTreeId ? s.settings.exportedAt?.[activeTreeId] : undefined,
  )
  const dismissedAt = useSettingsStore((s) => s.settings.exportNudgeDismissedAt)

  const show = shouldNudge({
    realWork,
    persistResult,
    treeUpdatedAt: treeUpdatedAt ?? 0,
    exportedAt,
    dismissedAt,
    now: Date.now(),
  })
  if (!show) return null

  const firm = isFirmNudge(persistResult)
  const dismiss = () => {
    void useSettingsStore
      .getState()
      .recordDurability({ exportNudgeDismissedAt: Date.now() })
      .catch(reportWriteFailure)
  }

  return (
    <div
      data-testid="export-nudge"
      data-variant={firm ? 'firm' : 'soft'}
      className={`flex items-center justify-between px-4 py-3 border-b text-sm ${
        firm
          ? 'bg-amber-950/40 border-amber-800/50 text-amber-300'
          : 'bg-slate-900 border-slate-800 text-slate-300'
      }`}
    >
      <div className="flex items-center gap-2">
        <HardDriveDownload size={16} className="flex-shrink-0" />
        <span>
          Your trees live only in this browser. Export a copy.
          {firm && " This browser may clear them if you don't visit for a while."}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
        <ExportButton className="underline hover:text-white transition-colors">Export</ExportButton>
        <button
          onClick={dismiss}
          title="Remind me tomorrow"
          aria-label="Dismiss export reminder"
          className="p-1 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
