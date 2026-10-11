import type { ReactNode } from 'react'
import { Download } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'
import { useSettingsStore } from '../store/settingsStore'
import { reportWriteFailure } from '../store/storageStatusStore'
import { downloadTreeExport } from '../lib/treeExport'

// Download the active tree as JSON, then stamp its export time so the export
// nudge knows this tree has a current backup.
function exportActiveTree() {
  const { activeTreeId, trees, nodes } = useTreeStore.getState()
  const tree = trees.find((t) => t.id === activeTreeId)
  if (!tree) return
  downloadTreeExport(tree, [...nodes.values()].filter((n) => n.treeId === tree.id))
  void useSettingsStore.getState().recordExport(tree.id).catch(reportWriteFailure)
}

interface ExportButtonProps {
  className?: string
  // Defaults to the header's download icon.
  children?: ReactNode
}

export function ExportButton({
  className = 'text-slate-400 hover:text-slate-200 transition-colors p-2',
  children = <Download size={20} />,
}: ExportButtonProps) {
  return (
    <button onClick={exportActiveTree} title="Export this tree as JSON" className={className}>
      {children}
    </button>
  )
}
