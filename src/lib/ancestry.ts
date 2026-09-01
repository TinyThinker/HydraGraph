import type { TurnNode } from '../types'

/**
 * Resolve the lineage chain from the tree root down to (and including) the
 * selected node, in root-first order.
 *
 * Walks upward from `selectedNodeId` following `parentId` pointers and reverses
 * the accumulated path so the returned array reads `[rootNode, ..., selectedNode]`.
 *
 * Pure function — no side effects, no store access.
 *
 * Edge cases:
 * - `selectedNodeId` is `null` -> `[]`
 * - id not present in `nodes` -> `[]`
 * - a broken `parentId` pointing at a missing node -> walk stops gracefully
 * - a cycle (a -> b -> a) -> walk stops once a node is revisited (no infinite loop)
 */
export function getAncestryChain(
  nodes: Map<string, TurnNode>,
  selectedNodeId: string | null,
): TurnNode[] {
  if (selectedNodeId === null) return []
  if (!nodes.has(selectedNodeId)) return []

  const chain: TurnNode[] = []
  const visited = new Set<string>()
  let currentNodeId: string | null = selectedNodeId

  while (currentNodeId !== null) {
    if (visited.has(currentNodeId)) break
    const node = nodes.get(currentNodeId)
    if (!node) break
    visited.add(currentNodeId)
    chain.push(node)
    currentNodeId = node.parentId
  }

  return chain.reverse()
}
