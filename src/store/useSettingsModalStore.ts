import { create } from 'zustand'

interface SettingsModalState {
  open: boolean
  openSettings: () => void
  closeSettings: () => void
}

/**
 * Whether the Settings modal is open. Lifted out of `HeaderBar` so a failed
 * turn's "Check connection" button can open it too.
 */
export const useSettingsModalStore = create<SettingsModalState>((set) => ({
  open: false,
  openSettings: () => set({ open: true }),
  closeSettings: () => set({ open: false }),
}))
