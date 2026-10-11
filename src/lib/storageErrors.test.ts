import { describe, it, expect } from 'vitest'
import Dexie from 'dexie'
import { isQuotaError, describeWriteError, QUOTA_MESSAGE } from './storageErrors'

// fake-indexeddb never runs out of space, so these fixtures are built from
// the browser's DOMException and the installed Dexie's own error classes.

describe('isQuotaError', () => {
  it('matches a DOMException by name', () => {
    expect(isQuotaError(new DOMException('full', 'QuotaExceededError'))).toBe(true)
  })

  it('matches a DOMException by legacy code 22', () => {
    const err = new DOMException('full', 'QuotaExceededError')
    Object.defineProperty(err, 'name', { value: 'SomeVendorError' })
    expect(err.code).toBe(22)
    expect(isQuotaError(err)).toBe(true)
  })

  it('matches a Dexie-wrapped quota error', () => {
    expect(isQuotaError(new Dexie.QuotaExceededError('full'))).toBe(true)
  })

  it('matches an AbortError whose inner is a quota error', () => {
    const quota = new Dexie.QuotaExceededError('full')
    expect(isQuotaError(new Dexie.AbortError('aborted', quota))).toBe(true)
  })

  it('does not match an AbortError with an unrelated inner', () => {
    expect(isQuotaError(new Dexie.AbortError('aborted', new Error('nope')))).toBe(false)
  })

  it('does not match a plain Error, a string, or null', () => {
    expect(isQuotaError(new Error('boom'))).toBe(false)
    expect(isQuotaError('QuotaExceededError')).toBe(false)
    expect(isQuotaError(null)).toBe(false)
  })

  it('stops on a cyclic inner chain', () => {
    const a = { name: 'AbortError', inner: null as unknown }
    const b = { name: 'AbortError', inner: a }
    a.inner = b
    expect(isQuotaError(a)).toBe(false)
  })
})

describe('describeWriteError', () => {
  it('gives the plain-words message for quota errors', () => {
    const quota = new Dexie.QuotaExceededError('raw dexie text')
    expect(describeWriteError(new Dexie.AbortError('aborted', quota))).toEqual({
      kind: 'quota',
      message: QUOTA_MESSAGE,
    })
  })

  it('passes through an Error message', () => {
    expect(describeWriteError(new Error('constraint failed'))).toEqual({
      kind: 'other',
      message: 'constraint failed',
    })
  })

  it('stringifies non-Error values', () => {
    expect(describeWriteError('bad')).toEqual({ kind: 'other', message: 'bad' })
    expect(describeWriteError(null)).toEqual({ kind: 'other', message: 'null' })
  })
})
