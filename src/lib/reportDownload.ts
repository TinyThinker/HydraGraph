import { exportFilename } from './treeExport'
import type { ConversationTree, TreeReport } from '../types'

/** `<tree-slug>-report-<date>.md`, on the same slug rule as tree exports. */
export function reportFilename(tree: ConversationTree, date: Date = new Date()): string {
  return exportFilename(tree, date).replace(/\.json$/, '.md').replace(/-(\d{4}-\d{2}-\d{2}\.md)$/, '-report-$1')
}

export function downloadReport(tree: ConversationTree, report: TreeReport): void {
  const blob = new Blob([report.text], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = reportFilename(tree)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
