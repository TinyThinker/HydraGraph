import { create } from 'zustand'
import { describeWriteError, type WriteFailure } from '../lib/storageErrors'

/**
 * The most recent IndexedDB write failure, for the storage banner.
 *
 * A later successful write does not clear it: the user may not have seen the
 * banner yet. Only the banner's dismiss clears it.
 */
interface StorageStatusState {
  writeFailure: WriteFailure | null
  reportWriteFailure: (err: unknown) => void
  clearWriteFailure: () => void
}

export const useStorageStatusStore = create<StorageStatusState>((set) => ({
  writeFailure: null,
  reportWriteFailure: (err) => set({ writeFailure: describeWriteError(err) }),
  clearWriteFailure: () => set({ writeFailure: null }),
}))

export const reportWriteFailure = (err: unknown) =>
  useStorageStatusStore.getState().reportWriteFailure(err)
