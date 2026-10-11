import { describe, it, expect, afterEach, vi } from 'vitest'
import { requestPersistence, isPersisted, readEstimate, formatBytes } from './storageHealth'

function stubStorage(storage: Partial<StorageManager> | undefined) {
  vi.stubGlobal('navigator', { storage })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requestPersistence', () => {
  it('returns granted when persist() resolves true', async () => {
    stubStorage({ persist: async () => true })
    expect(await requestPersistence()).toBe('granted')
  })

  it('returns denied when persist() resolves false', async () => {
    stubStorage({ persist: async () => false })
    expect(await requestPersistence()).toBe('denied')
  })

  it('returns unsupported when the API is missing', async () => {
    stubStorage(undefined)
    expect(await requestPersistence()).toBe('unsupported')
    stubStorage({})
    expect(await requestPersistence()).toBe('unsupported')
  })

  it('returns unsupported when persist() throws', async () => {
    stubStorage({ persist: async () => { throw new Error('nope') } })
    expect(await requestPersistence()).toBe('unsupported')
  })
})

describe('isPersisted', () => {
  it('passes through the browser answer', async () => {
    stubStorage({ persisted: async () => true })
    expect(await isPersisted()).toBe(true)
    stubStorage({ persisted: async () => false })
    expect(await isPersisted()).toBe(false)
  })

  it('returns null when missing or throwing', async () => {
    stubStorage(undefined)
    expect(await isPersisted()).toBeNull()
    stubStorage({ persisted: async () => { throw new Error('nope') } })
    expect(await isPersisted()).toBeNull()
  })
})

describe('readEstimate', () => {
  it('returns usage and quota in bytes', async () => {
    stubStorage({ estimate: async () => ({ usage: 100, quota: 2000 }) })
    expect(await readEstimate()).toEqual({ usageBytes: 100, quotaBytes: 2000 })
  })

  it('returns null when missing, throwing, or incomplete', async () => {
    stubStorage(undefined)
    expect(await readEstimate()).toBeNull()
    stubStorage({ estimate: async () => { throw new Error('nope') } })
    expect(await readEstimate()).toBeNull()
    stubStorage({ estimate: async () => ({ usage: 100 }) })
    expect(await readEstimate()).toBeNull()
  })
})

describe('formatBytes', () => {
  it.each([
    [0, '0 B'],
    [512, '512 B'],
    [1024, '1.0 KB'],
    [4.2 * 1024 * 1024, '4.2 MB'],
    [2.1 * 1024 ** 3, '2.1 GB'],
    [-5, '0 B'],
    [Number.NaN, '0 B'],
  ])('%s → %s', (n, out) => {
    expect(formatBytes(n)).toBe(out)
  })
})
