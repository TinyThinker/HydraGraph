import dagre from '@dagrejs/dagre'
import type { TurnNode } from '../types'

const DEFAULT_NODE_WIDTH = 320
const DEFAULT_NODE_HEIGHT = 240

export function layoutTree(nodes: Map<string, TurnNode>): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: 'TB',
    nodesep: 64,
    ranksep: 90,
    marginx: 40,
    marginy: 40,
  })
  g.setDefaultEdgeLabel(() => ({}))

  for (const [, node] of nodes) {
    const width = node.width ?? DEFAULT_NODE_WIDTH
    const height = node.height ?? DEFAULT_NODE_HEIGHT
    g.setNode(node.id, { width, height })
  }

  for (const [, node] of nodes) {
    if (node.parentId && nodes.has(node.parentId)) {
      g.setEdge(node.parentId, node.id)
    }
  }

  dagre.layout(g)

  const result = new Map<string, { x: number; y: number }>()
  for (const [, node] of nodes) {
    const dagreNode = g.node(node.id)
    const width = node.width ?? DEFAULT_NODE_WIDTH
    const height = node.height ?? DEFAULT_NODE_HEIGHT
    result.set(node.id, {
      x: dagreNode.x - width / 2,
      y: dagreNode.y - height / 2,
    })
  }

  return result
}

export function computeChildPosition(
  parentId: string,
  nodes: Map<string, TurnNode>
): { x: number; y: number } {
  if (!nodes.has(parentId)) {
    return { x: 0, y: 0 }
  }

  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: 'TB',
    nodesep: 64,
    ranksep: 90,
    marginx: 40,
    marginy: 40,
  })
  g.setDefaultEdgeLabel(() => ({}))

  for (const [, node] of nodes) {
    const width = node.width ?? DEFAULT_NODE_WIDTH
    const height = node.height ?? DEFAULT_NODE_HEIGHT
    g.setNode(node.id, { width, height })
  }

  const syntheticNodeId = '__new__'
  g.setNode(syntheticNodeId, { width: DEFAULT_NODE_WIDTH, height: DEFAULT_NODE_HEIGHT })

  for (const [, node] of nodes) {
    if (node.parentId && nodes.has(node.parentId)) {
      g.setEdge(node.parentId, node.id)
    }
  }

  g.setEdge(parentId, syntheticNodeId)

  dagre.layout(g)

  // Anchor the result to the parent's REAL on-canvas position: dagre lays the
  // whole tree out in its own coordinate space, but existing nodes stay where
  // the user dragged them. Translating by (parent.real - parent.dagre) keeps the
  // new child adjacent to its actual parent while preserving dagre's relative
  // placement and sibling spacing.
  const parent = nodes.get(parentId)!
  const dagreParent = g.node(parentId)
  const dagreChild = g.node(syntheticNodeId)
  return {
    x: parent.positionX + (dagreChild.x - dagreParent.x),
    y: parent.positionY + (dagreChild.y - dagreParent.y),
  }
}
