import { describe, it, expect } from 'vitest'
import { shouldNudge, isFirmNudge, type NudgeInput } from './exportNudge'

const DAY = 24 * 60 * 60 * 1000
const NOW = 100 * DAY

const base: NudgeInput = {
  realWork: true,
  persistResult: undefined,
  treeUpdatedAt: NOW - 1000,
  exportedAt: undefined,
  dismissedAt: undefined,
  now: NOW,
}

describe('shouldNudge', () => {
  it.each<[string, Partial<NudgeInput>, boolean]>([
    ['no real work', { realWork: false }, false],
    ['never exported', {}, true],
    ['never exported, granted', { persistResult: 'granted' }, true],
    // Another tree's export does not count: the caller passes this tree's entry, still undefined.
    ['another tree was exported', { exportedAt: undefined }, true],
    ['exported, unchanged since', { exportedAt: NOW - 30 * DAY, treeUpdatedAt: NOW - 31 * DAY }, false],
    ['exported at the same instant as the last change', { exportedAt: NOW - 30 * DAY, treeUpdatedAt: NOW - 30 * DAY }, false],
    ['changed since, denied, 2 days old', { persistResult: 'denied', exportedAt: NOW - 2 * DAY }, false],
    ['changed since, denied, 4 days old', { persistResult: 'denied', exportedAt: NOW - 4 * DAY }, true],
    ['changed since, unsupported, 4 days old', { persistResult: 'unsupported', exportedAt: NOW - 4 * DAY }, true],
    ['changed since, undefined, 4 days old', { exportedAt: NOW - 4 * DAY }, true],
    ['changed since, granted, 4 days old', { persistResult: 'granted', exportedAt: NOW - 4 * DAY }, false],
    ['changed since, granted, 15 days old', { persistResult: 'granted', exportedAt: NOW - 15 * DAY }, true],
    ['dismissed 1 hour ago', { dismissedAt: NOW - 60 * 60 * 1000 }, false],
    ['dismissed 25 hours ago', { dismissedAt: NOW - 25 * 60 * 60 * 1000 }, true],
  ])('%s → %s', (_label, patch, expected) => {
    expect(shouldNudge({ ...base, ...patch })).toBe(expected)
  })
})

describe('isFirmNudge', () => {
  it('is soft only when granted', () => {
    expect(isFirmNudge('granted')).toBe(false)
    expect(isFirmNudge('denied')).toBe(true)
    expect(isFirmNudge('unsupported')).toBe(true)
    expect(isFirmNudge(undefined)).toBe(true)
  })
})
