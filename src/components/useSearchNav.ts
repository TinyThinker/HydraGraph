import { create } from 'zustand'

interface SearchNavState {
  targetId: string | null
  nonce: number
  focus: (id: string) => void
}

export const useSearchNav = create<SearchNavState>((set) => ({
  targetId: null,
  nonce: 0,
  focus: (id) => set((s) => ({ targetId: id, nonce: s.nonce + 1 })),
}))
