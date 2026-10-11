import type { ConversationTree, TurnNode } from '../types'
import { isDemoTree } from './demoTree'

/**
 * "Real work" thresholds: completed turns on a non-demo tree before the app
 * asks the browser to persist storage, and before it nudges an export. Tune
 * them here.
 */
export const REAL_WORK_TURNS = {
  persist: 3,
  nudge: 6,
} as const

/** Turns in `treeId` that finished with a response (`idle`, non-empty text). */
export function countCompletedTurns(nodes: Iterable<TurnNode>, treeId: string): number {
  let count = 0
  for (const n of nodes) {
    if (n.treeId === treeId && n.status === 'idle' && n.assistantResponse.trim() !== '') count++
  }
  return count
}

/** True when `tree` is the user's own and has at least `minTurns` completed turns. */
export function hasRealWork(
  tree: ConversationTree | undefined,
  nodes: Iterable<TurnNode>,
  minTurns: number = REAL_WORK_TURNS.persist,
): boolean {
  if (!tree || isDemoTree(tree.id)) return false
  return countCompletedTurns(nodes, tree.id) >= minTurns
}
