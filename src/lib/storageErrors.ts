/**
 * Classify IndexedDB write failures so the UI can say "storage is full" in
 * plain words instead of echoing a raw DOMException.
 *
 * Dexie wraps the browser's error: a bare write surfaces as
 * Dexie.QuotaExceededError, and a write inside a transaction surfaces as an
 * AbortError whose `inner` is the quota error. Walk the `inner` chain to find it.
 */

export type WriteFailureKind = 'quota' | 'other'

export interface WriteFailure {
  kind: WriteFailureKind
  message: string
}

export const QUOTA_MESSAGE = 'Browser storage is full. New work is not being saved.'

// Legacy numeric code some browsers still raise instead of the name.
const QUOTA_EXCEEDED_ERR = 22

function isQuotaShaped(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  if ((err as { name?: unknown }).name === 'QuotaExceededError') return true
  return err instanceof DOMException && err.code === QUOTA_EXCEEDED_ERR
}

export function isQuotaError(err: unknown): boolean {
  const seen = new Set<unknown>()
  let current: unknown = err
  while (typeof current === 'object' && current !== null && !seen.has(current)) {
    if (isQuotaShaped(current)) return true
    seen.add(current)
    current = (current as { inner?: unknown }).inner
  }
  return false
}

export function describeWriteError(err: unknown): WriteFailure {
  if (isQuotaError(err)) return { kind: 'quota', message: QUOTA_MESSAGE }
  return { kind: 'other', message: err instanceof Error ? err.message : String(err) }
}
