import type { ConversationTree, TurnNode } from '../types'

export const TREE_EXPORT_SCHEMA_VERSION = 1

export interface TreeExportDoc {
  schemaVersion: number
  exportedAt: number
  tree: ConversationTree
  nodes: TurnNode[]
}

function pad2(num: number): string {
  return String(num).padStart(2, '0')
}

export function buildExportDoc(tree: ConversationTree, nodes: TurnNode[]): TreeExportDoc {
  return {
    schemaVersion: TREE_EXPORT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    tree: { ...tree },
    nodes: nodes.map((n) => ({ ...n, childrenIds: [...n.childrenIds] })),
  }
}

export function serializeExportDoc(doc: TreeExportDoc): string {
  return JSON.stringify(doc, null, 2)
}

export function exportFilename(tree: ConversationTree, date: Date = new Date()): string {
  const slug = tree.title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const titleSlug = slug || 'tree'
  const datePart = `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
  return `${titleSlug}-${datePart}.json`
}

export function downloadTreeExport(tree: ConversationTree, nodes: TurnNode[]): void {
  const text = serializeExportDoc(buildExportDoc(tree, nodes))
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = exportFilename(tree)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
