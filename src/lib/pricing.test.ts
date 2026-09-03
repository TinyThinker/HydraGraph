import { describe, it, expect } from 'vitest'
import { resolvePrice, turnCostUSD, formatUSD } from './pricing'
import type { CatalogModel } from './openRouterCatalog'

/** Local fixture — passed explicitly so assertions don't ride on the store. */
const CATALOG: CatalogModel[] = [
  { id: 'openai/gpt-4o', label: 'OpenAI: GPT-4o', inputPerM: 2.5, outputPerM: 10, tier: 'mid' },
  { id: 'openai/gpt-4o-mini', label: 'OpenAI: GPT-4o-mini', inputPerM: 0.15, outputPerM: 0.6, tier: 'cheap' },
  {
    id: 'anthropic/claude-3.5-sonnet',
    label: 'Anthropic: Claude 3.5 Sonnet',
    inputPerM: 3,
    outputPerM: 15,
    tier: 'frontier',
  },
  { id: 'google/gemini-2.5-flash', label: 'Google: Gemini 2.5 Flash', inputPerM: 0.3, outputPerM: 2.5, tier: 'mid' },
]

const price = (id: string) => {
  const m = CATALOG.find((c) => c.id === id)!
  return { inputPerM: m.inputPerM, outputPerM: m.outputPerM }
}

describe('resolvePrice', () => {
  it('exact id match', () => {
    expect(resolvePrice('openai/gpt-4o-mini', undefined, CATALOG)).toEqual(price('openai/gpt-4o-mini'))
    expect(resolvePrice('google/gemini-2.5-flash', undefined, CATALOG)).toEqual(
      price('google/gemini-2.5-flash'),
    )
  })

  it('case-insensitive id match', () => {
    expect(resolvePrice('OpenAI/GPT-4o', undefined, CATALOG)).toEqual(price('openai/gpt-4o'))
    expect(resolvePrice('ANTHROPIC/CLAUDE-3.5-SONNET', undefined, CATALOG)).toEqual(
      price('anthropic/claude-3.5-sonnet'),
    )
  })

  it('longest catalog-id prefix match', () => {
    expect(resolvePrice('anthropic/claude-3.5-sonnet-20241022', undefined, CATALOG)).toEqual(
      price('anthropic/claude-3.5-sonnet'),
    )
    // Prefers the longer catalog id when several are prefixes.
    expect(resolvePrice('openai/gpt-4o-mini-2024-07-18', undefined, CATALOG)).toEqual(
      price('openai/gpt-4o-mini'),
    )
  })

  it('ollama provider is always free', () => {
    expect(resolvePrice('llama3', 'ollama', CATALOG)).toEqual({ inputPerM: 0, outputPerM: 0 })
    expect(resolvePrice('anything-at-all', 'ollama', CATALOG)).toEqual({ inputPerM: 0, outputPerM: 0 })
  })

  it('unknown model resolves to null', () => {
    expect(resolvePrice('mystery-model-9000', undefined, CATALOG)).toBeNull()
    expect(resolvePrice('vendor/not-a-real-thing', undefined, CATALOG)).toBeNull()
  })

  it('falls back to the bundled catalog store when no catalog is passed', () => {
    // Historical remapped id — must still price via BUNDLED_CATALOG.
    expect(resolvePrice('google/gemini-2.5-flash')).not.toBeNull()
  })
})

describe('turnCostUSD', () => {
  it('computes input + output cost from token counts', () => {
    // gpt-4o-mini: 0.15 / 0.60 per 1M
    const cost = turnCostUSD(
      {
        modelUsed: 'openai/gpt-4o-mini',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      },
      CATALOG,
    )
    expect(cost).toBeCloseTo(0.75, 9)
  })

  it('is null when a token count is missing', () => {
    expect(turnCostUSD({ modelUsed: 'openai/gpt-4o-mini', outputTokens: 100 }, CATALOG)).toBeNull()
    expect(turnCostUSD({ modelUsed: 'openai/gpt-4o-mini', inputTokens: 100 }, CATALOG)).toBeNull()
  })

  it('is null for an unknown model', () => {
    expect(
      turnCostUSD({ modelUsed: 'nope-9000', inputTokens: 100, outputTokens: 100 }, CATALOG),
    ).toBeNull()
  })

  it('is 0 for the ollama provider', () => {
    expect(
      turnCostUSD(
        {
          modelUsed: 'llama3',
          provider: 'ollama',
          inputTokens: 5_000_000,
          outputTokens: 5_000_000,
        },
        CATALOG,
      ),
    ).toBe(0)
  })
})

describe('formatUSD', () => {
  it('uses 4 decimals below $1', () => {
    expect(formatUSD(0.0041)).toBe('$0.0041')
    expect(formatUSD(0.999)).toBe('$0.9990')
  })

  it('uses 2 decimals at or above $1', () => {
    expect(formatUSD(1)).toBe('$1.00')
    expect(formatUSD(3.12)).toBe('$3.12')
  })

  it('renders zero as $0.0000', () => {
    expect(formatUSD(0)).toBe('$0.0000')
  })
})
