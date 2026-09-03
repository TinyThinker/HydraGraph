import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useCatalogStore, TTL_MS } from './catalogStore'
import { BUNDLED_CATALOG } from '../lib/bundledCatalog'
import type { CatalogModel } from '../lib/openRouterCatalog'
import { db } from '../db/ChatDatabase'

const LIVE_PAYLOAD = {
  data: [
    { id: 'openai/gpt-4o', name: 'GPT-4o', context_length: 128000, pricing: { prompt: '0.0000025', completion: '0.00001' } },
    { id: 'openai/gpt-4o-mini', name: 'GPT-4o-mini', context_length: 128000, pricing: { prompt: '0.00000015', completion: '0.0000006' } },
  ],
}

function stubFetch(impl: (...args: unknown[]) => unknown) {
  const mock = vi.fn(impl)
  vi.stubGlobal('fetch', mock)
  return mock
}

const okResponse = async () => ({ ok: true, status: 200, json: async () => LIVE_PAYLOAD })

function resetStore() {
  useCatalogStore.setState({
    models: BUNDLED_CATALOG,
    fetchedAt: null,
    status: 'idle',
    source: 'bundled',
  })
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  resetStore()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const state = () => useCatalogStore.getState()

describe('catalogStore.loadCatalog', () => {
  it('fetches live models, marks the source, and writes the IndexedDB cache', async () => {
    stubFetch(okResponse)

    await state().loadCatalog()

    expect(state().status).toBe('ok')
    expect(state().source).toBe('live')
    expect(typeof state().fetchedAt).toBe('number')
    expect([...state().models].map((m) => m.id).sort()).toEqual(['openai/gpt-4o', 'openai/gpt-4o-mini'])

    const row = await db.catalog.get('openrouter')
    expect(row?.models).toHaveLength(2)
    expect(row?.fetchedAt).toBe(state().fetchedAt)
  })

  it('skips the fetch when the last fetch is still within the TTL', async () => {
    const mock = stubFetch(okResponse)
    useCatalogStore.setState({ fetchedAt: Date.now() - 1000, status: 'ok', source: 'live' })

    await state().loadCatalog()

    expect(mock).not.toHaveBeenCalled()
    expect(state().source).toBe('live')
  })

  it('refetches within the TTL when force = true', async () => {
    const mock = stubFetch(okResponse)
    useCatalogStore.setState({ fetchedAt: Date.now() - 1000, status: 'ok', source: 'live' })

    await state().loadCatalog(true)

    expect(mock).toHaveBeenCalledTimes(1)
    expect(state().source).toBe('live')
  })

  it('refetches once the TTL has elapsed', async () => {
    const mock = stubFetch(okResponse)
    useCatalogStore.setState({ fetchedAt: Date.now() - TTL_MS - 1, status: 'ok', source: 'live' })

    await state().loadCatalog()

    expect(mock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the IndexedDB cache when the fetch fails', async () => {
    const cached: CatalogModel[] = [
      { id: 'cached/model', label: 'Cached', inputPerM: 1, outputPerM: 2, tier: 'mid' },
    ]
    await db.catalog.put({ key: 'openrouter', models: cached, fetchedAt: 4242 })
    stubFetch(() => {
      throw new Error('offline')
    })

    await state().loadCatalog()

    expect(state().status).toBe('error')
    expect(state().source).toBe('cache')
    expect(state().fetchedAt).toBe(4242)
    expect(state().models).toEqual(cached)
  })

  it('falls back to the bundled snapshot when the fetch fails and no cache exists', async () => {
    stubFetch(async () => ({ ok: false, status: 503, json: async () => ({}) }))

    await state().loadCatalog()

    expect(state().status).toBe('error')
    expect(state().source).toBe('bundled')
    expect(state().fetchedAt).toBeNull()
    expect(state().models).toBe(BUNDLED_CATALOG)
  })
})
