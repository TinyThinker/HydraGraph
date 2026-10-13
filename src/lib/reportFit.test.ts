import { describe, it, expect } from 'vitest'
import { checkFit, contextWindowFor, estimateTokens, reportWriterStatus } from './reportFit'
import type { CatalogModel } from './openRouterCatalog'

const catalog: CatalogModel[] = [
  { id: 'a/big', label: 'Big', inputPerM: 1, outputPerM: 2, tier: 'mid', contextWindow: 128_000 },
  { id: 'a/nowin', label: 'No window', inputPerM: 1, outputPerM: 2, tier: 'mid' },
]

describe('estimateTokens', () => {
  it('is chars/4 over system prompt and messages', () => {
    expect(estimateTokens({ systemPrompt: 'abcd', messages: [{ role: 'user', content: 'x'.repeat(36) }] })).toBe(10)
  })
})

describe('checkFit', () => {
  it('fits with room to spare', () => {
    expect(checkFit({ inputTokens: 10_000, contextWindow: 128_000 })).toEqual({
      fits: true,
      needed: 19_500,
      limit: 128_000,
    })
  })

  it('does not fit when input plus reserve passes the window', () => {
    expect(checkFit({ inputTokens: 120_000, contextWindow: 128_000 }).fits).toBe(false)
  })

  it('an unknown window fits, with no limit to show', () => {
    expect(checkFit({ inputTokens: 1_000_000, contextWindow: null })).toMatchObject({ fits: true, limit: null })
  })

  it('applies the 15% margin to input: exactly at the window fits, one over does not', () => {
    // 20,000 × 1.15 + 8,000 = 31,000
    expect(checkFit({ inputTokens: 20_000, contextWindow: 31_000 }).fits).toBe(true)
    expect(checkFit({ inputTokens: 20_000, contextWindow: 30_999 }).fits).toBe(false)
  })
})

describe('contextWindowFor', () => {
  it('reads the catalog for OpenRouter', () => {
    expect(contextWindowFor('openrouter', 'a/big', catalog)).toBe(128_000)
    expect(contextWindowFor('openrouter', 'a/nowin', catalog)).toBeNull()
    expect(contextWindowFor('openrouter', 'missing', catalog)).toBeNull()
  })

  it('has no window for Ollama', () => {
    expect(contextWindowFor('ollama', 'a/big', catalog)).toBeNull()
  })
})

describe('reportWriterStatus', () => {
  it('blocks Ollama even with a key', () => {
    expect(reportWriterStatus('ollama', { openRouterApiKey: 'sk-or-x' })).toMatchObject({ ok: false, reason: 'ollama' })
  })

  it('blocks OpenRouter without a key', () => {
    expect(reportWriterStatus('openrouter', {})).toMatchObject({ ok: false, reason: 'no-key' })
    expect(reportWriterStatus('openrouter', { openRouterApiKey: '  ' })).toMatchObject({ ok: false, reason: 'no-key' })
  })

  it('allows OpenRouter with a key', () => {
    expect(reportWriterStatus('openrouter', { openRouterApiKey: 'sk-or-x' })).toEqual({ ok: true })
  })
})
