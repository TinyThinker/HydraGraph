import type { TurnNode } from '../types'
import { getAncestryChain } from './ancestry'

/**
 * Set of node ids on the active path `root -> selectedNode`, or `null` when
 * nothing is selected (sentinel meaning "no active path, dim nothing").
 *
 * Pure — no store access, no side effects.
 */
export function activePathIds(
  nodes: Map<string, TurnNode>,
  selectedNodeId: string | null,
): Set<string> | null {
  if (selectedNodeId === null) return null
  return new Set(getAncestryChain(nodes, selectedNodeId).map((n) => n.id))
}

/** High-contrast cyan accent track for edges on the active path. */
export const ACTIVE_EDGE_STYLE = { stroke: '#22d3ee', strokeWidth: 3 }
/** Dimmed style for edges off the active path. */
export const INACTIVE_EDGE_STYLE = { stroke: '#1e293b', strokeWidth: 1.5, opacity: 0.35 }
/** Default edge style, used when there is no active path. */
export const BASE_EDGE_STYLE = { stroke: '#4f46e5', strokeWidth: 2 }

/**
 * Resolve the visual appearance for the edge `sourceId -> targetId` given the
 * active path set (or `null` when nothing is selected).
 */
export function edgeAppearance(
  sourceId: string,
  targetId: string,
  active: Set<string> | null,
): { style: Record<string, unknown>; animated: boolean } {
  if (active === null) return { style: BASE_EDGE_STYLE, animated: false }
  if (active.has(sourceId) && active.has(targetId)) {
    return { style: ACTIVE_EDGE_STYLE, animated: true }
  }
  return { style: INACTIVE_EDGE_STYLE, animated: false }
}

/**
 * Tailwind class string that dims a node pill when it is off the active path,
 * or `undefined` when the node should render normally.
 */
export function pillDimClassName(
  nodeId: string,
  active: Set<string> | null,
): string | undefined {
  if (active === null || active.has(nodeId)) return undefined
  return 'opacity-40 saturate-50 transition-opacity'
}
