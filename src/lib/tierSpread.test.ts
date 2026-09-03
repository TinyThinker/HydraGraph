import { describe, it, expect } from 'vitest'
import { tierSpread } from './tierSpread'
import { formatModelRef } from './formatModelRef'
import type { CatalogModel } from './openRouterCatalog'

const CATALOG: CatalogModel[] = [
  { id: 'a/cheap-1', label: 'c1', inputPerM: 0.01, outputPerM: 0.05, tier: 'cheap' },
  { id: 'a/cheap-2', label: 'c2', inputPerM: 0.02, outputPerM: 0.2, tier: 'cheap' },
  { id: 'a/mid-1', label: 'm1', inputPerM: 0.5, outputPerM: 2, tier: 'mid' },
  { id: 'a/mid-2', label: 'm2', inputPerM: 1, outputPerM: 5, tier: 'mid' },
  { id: 'a/frontier-1', label: 'f1', inputPerM: 3, outputPerM: 15, tier: 'frontier' },
  { id: 'a/frontier-2', label: 'f2', inputPerM: 10, outputPerM: 60, tier: 'frontier' },
]

describe('tierSpread', () => {
  it('returns [] when nothing is configured', () => {
    expect(tierSpread(CATALOG, [], 3)).toEqual([])
  })

  it('returns [] for a non-positive count', () => {
    expect(tierSpread(CATALOG, ['openrouter'], 0)).toEqual([])
  })

  it('spreads OpenRouter picks across distinct tiers and ids, ascending by price', () => {
    const picks = tierSpread(CATALOG, ['openrouter'], 3)

    expect(picks).toHaveLength(3)
    expect(picks.every((p) => p.provider === 'openrouter')).toBe(true)

    const ids = picks.map((p) => p.model)
    expect(new Set(ids).size).toBe(3)

    const tiers = ids.map((id) => CATALOG.find((m) => m.id === id)!.tier)
    expect(new Set(tiers)).toEqual(new Set(['cheap', 'mid', 'frontier']))

    const prices = ids.map((id) => CATALOG.find((m) => m.id === id)!.outputPerM)
    expect([...prices]).toEqual([...prices].sort((x, y) => x - y))
  })

  it('fills extra slots from the price-sorted catalog without repeats', () => {
    const picks = tierSpread(CATALOG, ['openrouter'], 4)
    expect(picks).toHaveLength(4)
    expect(new Set(picks.map((p) => p.model)).size).toBe(4)
  })

  it('appends exactly one Ollama placeholder when both providers are configured', () => {
    const picks = tierSpread(CATALOG, ['openrouter', 'ollama'], 3)

    expect(picks).toHaveLength(3)
    expect(picks.filter((p) => p.provider === 'ollama')).toEqual([{ provider: 'ollama', model: '' }])
    expect(picks.slice(0, 2).every((p) => p.provider === 'openrouter' && p.model)).toBe(true)
  })

  it('returns a single Ollama placeholder when only Ollama is configured', () => {
    expect(tierSpread(CATALOG, ['ollama'], 4)).toEqual([{ provider: 'ollama', model: '' }])
  })
})

describe('formatModelRef', () => {
  it('joins provider and model', () => {
    expect(formatModelRef('openrouter', 'openai/gpt-4o')).toBe('openrouter/openai/gpt-4o')
  })

  it('reads a blank provider as inherit and a blank model as (default)', () => {
    expect(formatModelRef(null, null)).toBe('inherit/(default)')
    expect(formatModelRef('ollama', '')).toBe('ollama/(default)')
    expect(formatModelRef(undefined, 'llama3')).toBe('inherit/llama3')
  })
})
