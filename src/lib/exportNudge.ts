import type { PersistResult } from '../types'

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** How long a dismiss hides the nudge. */
export const NUDGE_SNOOZE_MS = 24 * HOUR_MS
/** Max age of a stale export when the browser agreed to persist storage. */
export const SOFT_INTERVAL_MS = 14 * DAY_MS
/** Max age of a stale export when it did not (or could not say). */
export const FIRM_INTERVAL_MS = 3 * DAY_MS

export interface NudgeInput {
  // Active tree has at least REAL_WORK_TURNS.nudge completed turns.
  realWork: boolean
  persistResult: PersistResult | undefined
  treeUpdatedAt: number
  // The active tree's own export time, not any tree's.
  exportedAt: number | undefined
  dismissedAt: number | undefined
  now: number
}

/** Firm copy and the shorter interval apply unless persistence was granted. */
export function isFirmNudge(persistResult: PersistResult | undefined): boolean {
  return persistResult !== 'granted'
}

/**
 * Whether to show the export nudge for the active tree. Pure.
 *
 * A backup that still matches the tree needs no reminder. A stale one is
 * nudged after 14 days when persistence was granted, 3 days otherwise.
 */
export function shouldNudge(input: NudgeInput): boolean {
  const { realWork, persistResult, treeUpdatedAt, exportedAt, dismissedAt, now } = input
  if (!realWork) return false
  if (dismissedAt !== undefined && now - dismissedAt < NUDGE_SNOOZE_MS) return false
  if (exportedAt === undefined) return true
  if (treeUpdatedAt <= exportedAt) return false
  const interval = isFirmNudge(persistResult) ? FIRM_INTERVAL_MS : SOFT_INTERVAL_MS
  return now - exportedAt > interval
}
