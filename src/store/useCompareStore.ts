import { create } from 'zustand'

interface CompareState {
  open: boolean
  anchorId: string | null
  /** Sibling ids the user unchecked — excluded from the column layout. */
  excludedIds: Set<string>
  openCompare: (nodeId: string) => void
  toggle: (id: string) => void
  close: () => void
}

export const useCompareStore = create<CompareState>((set) => ({
  open: false,
  anchorId: null,
  excludedIds: new Set(),
  openCompare: (nodeId) => set({ open: true, anchorId: nodeId, excludedIds: new Set() }),
  toggle: (id) =>
    set((s) => {
      const next = new Set(s.excludedIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { excludedIds: next }
    }),
  close: () => set({ open: false, anchorId: null, excludedIds: new Set() }),
}))
