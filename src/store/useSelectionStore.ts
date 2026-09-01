import { create } from 'zustand'

interface SelectionState {
  selectedNodeId: string | null
  /**
   * Bumped every time a pane asks the graph to imperatively re-focus the
   * selected node (pan + highlight). Canvas watches this, not selectedNodeId,
   * so a plain canvas click doesn't trigger a redundant re-center.
   */
  focusNonce: number
  /** Set the active node without asking the graph to re-center (canvas -> store). */
  setSelectedNodeId: (id: string | null) => void
  /** Set the active node AND ask the graph to pan/highlight it (chat -> store). */
  selectAndFocus: (id: string) => void
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedNodeId: null,
  focusNonce: 0,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  selectAndFocus: (id) =>
    set((s) => ({ selectedNodeId: id, focusNonce: s.focusNonce + 1 })),
}))
