import { create } from 'zustand'
import { useTreeStore } from './useTreeStore'
import { getAncestryChain } from '../lib/ancestry'
import type { TurnNode } from '../types'

// Report state lives here, not in useTreeStore: the tree store only gains the
// actions that write the tree row. Pills read this store through one boolean
// selector each (`leafIds.includes(id)`, `includedIds.has(id)`), never the set
// itself, so ticking one pill does not re-render the other 199.

interface ReportState {
  /** Report mode: a pill click ticks the turn instead of selecting it. */
  selecting: boolean
  /** Ticked turns. Each one stands for its whole path to the root. */
  leafIds: string[]
  /** Every turn on a ticked path, recomputed on each toggle. */
  includedIds: Set<string>
}

interface ReportActions {
  /** Enter report mode, optionally pre-ticking `leafIds` (e.g. editing a report's selection). */
  startSelecting: (leafIds?: string[]) => void
  toggle: (id: string) => void
  clear: () => void
  stopSelecting: () => void
}

function pathsOf(leafIds: string[], nodes: Map<string, TurnNode>): Set<string> {
  const out = new Set<string>()
  for (const leafId of leafIds) for (const node of getAncestryChain(nodes, leafId)) out.add(node.id)
  return out
}

export const useReportStore = create<ReportState & ReportActions>((set) => ({
  selecting: false,
  leafIds: [],
  includedIds: new Set(),

  startSelecting: (leafIds = []) =>
    set({ selecting: true, leafIds: [...leafIds], includedIds: pathsOf(leafIds, useTreeStore.getState().nodes) }),

  toggle: (id) =>
    set((s) => {
      const leafIds = s.leafIds.includes(id) ? s.leafIds.filter((l) => l !== id) : [...s.leafIds, id]
      return { leafIds, includedIds: pathsOf(leafIds, useTreeStore.getState().nodes) }
    }),

  clear: () => set({ leafIds: [], includedIds: new Set() }),

  stopSelecting: () => set({ selecting: false }),
}))
