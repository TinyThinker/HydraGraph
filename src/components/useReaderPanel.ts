import { create } from 'zustand'

interface ReaderPanelState {
  nodeId: string | null
  open: (id: string) => void
  close: () => void
}

export const useReaderPanel = create<ReaderPanelState>((set) => ({
  nodeId: null,
  open: (id: string) => set({ nodeId: id }),
  close: () => set({ nodeId: null }),
}))
