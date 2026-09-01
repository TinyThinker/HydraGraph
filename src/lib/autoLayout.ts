import { hierarchy, tree as d3tree } from 'd3-hierarchy'
import type { TurnNode } from '../types'
import { NODE_WIDTH, NODE_HEIGHT } from './nodeDimensions'

const H_GAP = 64
const V_GAP = 90
const MARGIN = 40

// Pick the tree root: the node whose parentId is null. If several qualify,
// choose the one with the earliest timestamp for determinism.
function findRoot(nodes: Map<string, TurnNode>): TurnNode | null {
  let root: TurnNode | null = null
  for (const node of nodes.values()) {
    if (node.parentId !== null) continue
    if (!root || node.timestamp < root.timestamp) {
      root = node
    }
  }
  return root
}

/**
 * Deterministic top-to-bottom tree layout using d3-hierarchy.
 * Pure: identical tree structure in -> identical coordinates out.
 * Only nodes reachable from the root receive positions; orphans are omitted.
 */
export function layoutTree(nodes: Map<string, TurnNode>): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>()
  const root = findRoot(nodes)
  if (!root) return result

  const seen = new Set<string>()
  const rootH = hierarchy<TurnNode>(root, (n) => {
    if (seen.has(n.id)) return []
    seen.add(n.id)
    return n.childrenIds
      .map((id) => nodes.get(id))
      .filter((c): c is TurnNode => !!c && c.id !== n.id && !seen.has(c.id))
  })

  const laidOut = d3tree<TurnNode>().nodeSize([NODE_WIDTH + H_GAP, NODE_HEIGHT + V_GAP])(rootH)

  let minX = Infinity
  let minY = Infinity
  const raw: Array<{ id: string; x: number; y: number }> = []
  laidOut.each((d) => {
    const x = d.x - NODE_WIDTH / 2
    const y = d.y
    raw.push({ id: d.data.id, x, y })
    if (x < minX) minX = x
    if (y < minY) minY = y
  })

  const dx = minX - MARGIN
  const dy = minY - MARGIN
  for (const { id, x, y } of raw) {
    result.set(id, { x: x - dx, y: y - dy })
  }

  return result
}

/**
 * Position a hypothetical new child of `parentId` by running the full
 * deterministic layout with a synthetic child appended to the parent.
 * Returns { x: 0, y: 0 } when the parent is not present.
 */
export function computeChildPosition(
  parentId: string,
  nodes: Map<string, TurnNode>
): { x: number; y: number } {
  const parent = nodes.get(parentId)
  if (!parent) return { x: 0, y: 0 }

  const syntheticId = '__new__'
  const clone = new Map(nodes)
  clone.set(parentId, { ...parent, childrenIds: [...parent.childrenIds, syntheticId] })
  clone.set(syntheticId, {
    ...parent,
    id: syntheticId,
    parentId,
    childrenIds: [],
  })

  return layoutTree(clone).get(syntheticId) ?? { x: 0, y: 0 }
}
