import { useEffect, useState } from 'react'
import {
  formatBytes,
  isPersisted,
  readEstimate,
  type StorageEstimateBytes,
} from '../lib/storageHealth'

/**
 * One paragraph in Settings on where data lives, plus live usage and whether
 * the browser agreed to keep it. "Agreed" is never called "protected": Safari
 * can still clear data after 7 days without a visit.
 */
export function DataLocationNote() {
  const [estimate, setEstimate] = useState<StorageEstimateBytes | null>(null)
  const [persisted, setPersisted] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    void readEstimate().then((e) => !cancelled && setEstimate(e))
    void isPersisted().then((p) => !cancelled && setPersisted(p))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div data-testid="data-location-note" className="text-xs text-slate-400 space-y-1">
      <p>
        Trees are stored in this browser only. Prompts go straight from your browser to your
        chosen provider. Nothing passes through our servers.
      </p>
      {estimate && (
        <p>
          Using {formatBytes(estimate.usageBytes)} of {formatBytes(estimate.quotaBytes)}.
        </p>
      )}
      <p>
        {persisted
          ? 'Browser agreed to keep this data. Still export.'
          : 'Not protected — export regularly.'}
      </p>
    </div>
  )
}
