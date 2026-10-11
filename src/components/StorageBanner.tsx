import { AlertTriangle, X } from 'lucide-react'
import { useStorageStatusStore } from '../store/storageStatusStore'

/**
 * The strip under the header when an IndexedDB write failed.
 *
 * Quota gets the full explanation: the app has no "free space" action, and
 * quota is mostly hit in private windows, so the advice is export, delete, or
 * leave the private window. Other failures show their message. Stays until
 * dismissed — a later successful write does not hide it.
 */
export function StorageBanner() {
  const writeFailure = useStorageStatusStore((s) => s.writeFailure)
  const clearWriteFailure = useStorageStatusStore((s) => s.clearWriteFailure)

  if (!writeFailure) return null

  const text =
    writeFailure.kind === 'quota'
      ? `${writeFailure.message} Export your trees, then delete ones you don't need. In a private window, open the app in a normal one.`
      : `Could not save to browser storage: ${writeFailure.message}`

  return (
    <div
      data-testid="storage-banner"
      role="alert"
      className="flex items-center justify-between px-4 py-3 bg-amber-950/40 border-b border-amber-800/50 text-amber-300 text-sm"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="flex-shrink-0" />
        <span>{text}</span>
      </div>
      <button
        onClick={clearWriteFailure}
        title="Dismiss"
        aria-label="Dismiss storage warning"
        className="text-amber-200 hover:text-amber-100 transition-colors flex-shrink-0 ml-4 p-1"
      >
        <X size={16} />
      </button>
    </div>
  )
}
