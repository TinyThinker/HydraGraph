import { describe, it, expect } from 'vitest'
import { MODEL_PRICING, resolvePrice, turnCostUSD, formatUSD } from './pricing'

describe('resolvePrice', () => {
  it('exact key match', () => {
    expect(resolvePrice('gemini-2.5-flash')).toEqual(MODEL_PRICING['gemini-2.5-flash'])
    expect(resolvePrice('openai/gpt-4o-mini')).toEqual(MODEL_PRICING['openai/gpt-4o-mini'])
  })

  it('case-insensitive key match', () => {
    expect(resolvePrice('GEMINI-2.5-FLASH')).toEqual(MODEL_PRICING['gemini-2.5-flash'])
    expect(resolvePrice('OpenAI/GPT-4o')).toEqual(MODEL_PRICING['openai/gpt-4o'])
  })

  it('strips a leading vendor/ segment and retries', () => {
    // Not itself a key; stripped form is.
    expect(resolvePrice('proxy/gemini-1.5-pro')).toEqual(MODEL_PRICING['gemini-1.5-pro'])
    expect(resolvePrice('x-router/openai/gpt-4o-mini')).toEqual(
      MODEL_PRICING['openai/gpt-4o-mini'],
    )
  })

  it('longest-prefix match against table keys', () => {
    expect(resolvePrice('gemini-2.5-flash-preview-09')).toEqual(
      MODEL_PRICING['gemini-2.5-flash'],
    )
    expect(resolvePrice('anthropic/claude-3.5-sonnet-20241022')).toEqual(
      MODEL_PRICING['anthropic/claude-3.5-sonnet'],
    )
  })

  it('ollama provider is always free', () => {
    expect(resolvePrice('llama3', 'ollama')).toEqual({ inputPerM: 0, outputPerM: 0 })
    expect(resolvePrice('anything-at-all', 'ollama')).toEqual({ inputPerM: 0, outputPerM: 0 })
  })

  it('unknown model resolves to null', () => {
    expect(resolvePrice('mystery-model-9000')).toBeNull()
    expect(resolvePrice('vendor/not-a-real-thing')).toBeNull()
  })
})

describe('turnCostUSD', () => {
  it('computes input + output cost from token counts', () => {
    // gpt-4o-mini: 0.15 / 0.60 per 1M
    const cost = turnCostUSD({
      modelUsed: 'openai/gpt-4o-mini',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })
    expect(cost).toBeCloseTo(0.75, 9)
  })

  it('is null when a token count is missing', () => {
    expect(
      turnCostUSD({ modelUsed: 'openai/gpt-4o-mini', outputTokens: 100 }),
    ).toBeNull()
    expect(
      turnCostUSD({ modelUsed: 'openai/gpt-4o-mini', inputTokens: 100 }),
    ).toBeNull()
  })

  it('is null for an unknown model', () => {
    expect(
      turnCostUSD({ modelUsed: 'nope-9000', inputTokens: 100, outputTokens: 100 }),
    ).toBeNull()
  })

  it('is 0 for the ollama provider', () => {
    expect(
      turnCostUSD({
        modelUsed: 'llama3',
        provider: 'ollama',
        inputTokens: 5_000_000,
        outputTokens: 5_000_000,
      }),
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
