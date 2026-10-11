import { describe, it, expect, beforeEach } from 'vitest'
import Dexie from 'dexie'
import { useStorageStatusStore, reportWriteFailure } from './storageStatusStore'
import { QUOTA_MESSAGE } from '../lib/storageErrors'

beforeEach(() => {
  useStorageStatusStore.setState({ writeFailure: null })
})

describe('storageStatusStore', () => {
  it('starts with no failure', () => {
    expect(useStorageStatusStore.getState().writeFailure).toBeNull()
  })

  it('records a quota failure in plain words', () => {
    reportWriteFailure(new Dexie.QuotaExceededError('raw'))
    expect(useStorageStatusStore.getState().writeFailure).toEqual({
      kind: 'quota',
      message: QUOTA_MESSAGE,
    })
  })

  it('records other failures with their message', () => {
    reportWriteFailure(new Error('disk on fire'))
    expect(useStorageStatusStore.getState().writeFailure).toEqual({
      kind: 'other',
      message: 'disk on fire',
    })
  })

  it('replaces the object on each report and clears on dismiss', () => {
    reportWriteFailure(new Error('one'))
    const first = useStorageStatusStore.getState().writeFailure
    reportWriteFailure(new Error('two'))
    const second = useStorageStatusStore.getState().writeFailure
    expect(second).not.toBe(first)
    expect(second?.message).toBe('two')

    useStorageStatusStore.getState().clearWriteFailure()
    expect(useStorageStatusStore.getState().writeFailure).toBeNull()
  })
})
