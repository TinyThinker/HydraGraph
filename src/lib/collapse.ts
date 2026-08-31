import type { TurnNode } from '../types'

// Pure helper: compute which node ids are hidden because they have a collapsed ancestor
export function computeHiddenIds(nodes: Map<string, TurnNode>): Set<string> {
  const hidden = new Set<string>()

  for (const node of nodes.values()) {
    // Walk up the ancestor chain
    let current = node.parentId
    let depth = 0
    const maxDepth = 1000 // Guard against cycles
    let foundCollapsed = false

    while (current && depth < maxDepth) {
      const ancestor = nodes.get(current)
      if (!ancestor) break // Missing parent, stop walking
      if (ancestor.isCollapsed) {
        foundCollapsed = true
        break
      }
      current = ancestor.parentId
      depth++
    }

    if (foundCollapsed) {
      hidden.add(node.id)
    }
  }

  return hidden
}
