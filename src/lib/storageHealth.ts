/**
 * Thin wrappers over `navigator.storage` (persist / persisted / estimate).
 *
 * Every call is feature-checked and catches everything: a missing API, a
 * throwing method, or an insecure context all collapse to a plain value
 * instead of an exception. No React, no stores.
 */

import type { PersistResult } from '../types'

export type { PersistResult }

export interface StorageEstimateBytes {
  usageBytes: number
  quotaBytes: number
}

function storageManager(): StorageManager | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.storage
}

/** Ask the browser not to evict this origin's storage. */
export async function requestPersistence(): Promise<PersistResult> {
  const storage = storageManager()
  if (typeof storage?.persist !== 'function') return 'unsupported'
  try {
    return (await storage.persist()) ? 'granted' : 'denied'
  } catch {
    return 'unsupported'
  }
}

/** Whether the browser currently treats this origin as persistent; `null` if unknown. */
export async function isPersisted(): Promise<boolean | null> {
  const storage = storageManager()
  if (typeof storage?.persisted !== 'function') return null
  try {
    return await storage.persisted()
  } catch {
    return null
  }
}

/** Usage and quota in bytes, or `null` if the browser won't say. */
export async function readEstimate(): Promise<StorageEstimateBytes | null> {
  const storage = storageManager()
  if (typeof storage?.estimate !== 'function') return null
  try {
    const { usage, quota } = await storage.estimate()
    if (typeof usage !== 'number' || typeof quota !== 'number') return null
    return { usageBytes: usage, quotaBytes: quota }
  } catch {
    return null
  }
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']

/** `4404019` → `"4.2 MB"`. Base 1024; one decimal from KB up. */
export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0 B'
  let value = n
  let unit = 0
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024
    unit++
  }
  return unit === 0 ? `${Math.round(value)} B` : `${value.toFixed(1)} ${UNITS[unit]}`
}
