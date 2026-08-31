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

export type ParseImportResult = { ok: true; doc: TreeExportDoc } | { ok: false; error: string }

export function parseImportDoc(text: string): ParseImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'File is not valid JSON.' }
  }

  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, error: 'File is not a recognised tree export.' }
  }

  const doc = parsed as Record<string, unknown>
  if (doc.schemaVersion !== TREE_EXPORT_SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported export schema version: ${doc.schemaVersion}. This build reads version ${TREE_EXPORT_SCHEMA_VERSION}.` }
  }

  if (!doc.tree || typeof doc.tree !== 'object') {
    return { ok: false, error: 'Export is missing a valid tree record.' }
  }

  const tree = doc.tree as Record<string, unknown>
  if (typeof tree.id !== 'string' || typeof tree.title !== 'string' || typeof tree.rootNodeId !== 'string') {
    return { ok: false, error: 'Export is missing a valid tree record.' }
  }

  if (!Array.isArray(doc.nodes) || doc.nodes.length === 0) {
    return { ok: false, error: 'Export contains no nodes.' }
  }

  const nodes = doc.nodes as unknown[]
  const ids = new Set<string>()

  for (const node of nodes) {
    if (!node || typeof node !== 'object') {
      return { ok: false, error: 'Export contains invalid node.' }
    }

    const n = node as Record<string, unknown>
    if (typeof n.id !== 'string') {
      return { ok: false, error: 'Export contains node without id.' }
    }

    if (ids.has(n.id)) {
      return { ok: false, error: `Duplicate node id in export: ${n.id}.` }
    }

    ids.add(n.id)

    if (!Array.isArray(n.childrenIds)) {
      return { ok: false, error: `Node ${n.id} has invalid childrenIds.` }
    }
  }

  const roots = nodes.filter((n) => {
    const node = n as Record<string, unknown>
    return node.parentId == null
  })

  if (roots.length !== 1) {
    return { ok: false, error: `Export must have exactly one root node (found ${roots.length}).` }
  }

  const rootNode = roots[0] as Record<string, unknown>
  if (rootNode.id !== tree.rootNodeId) {
    return { ok: false, error: 'Export root node does not match the tree rootNodeId.' }
  }

  for (const node of nodes) {
    const n = node as Record<string, unknown>
    if (n.parentId != null && typeof n.parentId === 'string') {
      if (!ids.has(n.parentId)) {
        return { ok: false, error: `Node ${n.id} references missing parent ${n.parentId}.` }
      }
    }
  }

  for (const node of nodes) {
    const n = node as Record<string, unknown>
    const childrenIds = n.childrenIds as string[]

    for (const childId of childrenIds) {
      if (!ids.has(childId)) {
        return { ok: false, error: `Node ${n.id} references missing child ${childId}.` }
      }

      const childNode = nodes.find((cn) => {
        const c = cn as Record<string, unknown>
        return c.id === childId
      }) as Record<string, unknown>

      if (childNode.parentId !== n.id) {
        return { ok: false, error: `Child ${childId} does not point back to parent ${n.id}.` }
      }
    }
  }

  for (const node of nodes) {
    const n = node as Record<string, unknown>
    if (n.parentId != null && typeof n.parentId === 'string') {
      const parentNode = nodes.find((pn) => {
        const p = pn as Record<string, unknown>
        return p.id === n.parentId
      }) as Record<string, unknown>

      const parentChildrenIds = parentNode.childrenIds as string[]
      if (!parentChildrenIds.includes(n.id as string)) {
        return { ok: false, error: `Node ${n.id} is not listed in its parent's children.` }
      }
    }
  }

  return { ok: true, doc: parsed as TreeExportDoc }
}

export function remapImportedTree(doc: TreeExportDoc, makeId: () => string = () => crypto.randomUUID()): { tree: ConversationTree; nodes: TurnNode[] } {
  const idMap = new Map<string, string>()

  for (const node of doc.nodes) {
    idMap.set(node.id, makeId())
  }

  const newTreeId = makeId()
  const now = Date.now()

  const tree: ConversationTree = {
    ...doc.tree,
    id: newTreeId,
    rootNodeId: idMap.get(doc.tree.rootNodeId)!,
    createdAt: now,
    updatedAt: now,
  }

  const nodes: TurnNode[] = doc.nodes.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    treeId: newTreeId,
    parentId: n.parentId ? idMap.get(n.parentId)! : null,
    childrenIds: n.childrenIds.map((c) => idMap.get(c)!),
    status: n.status === 'streaming' ? 'idle' : n.status,
    errorMessage: n.status === 'streaming' ? '' : (n.errorMessage ?? ''),
  }))

  return { tree, nodes }
}
