import { describe, it, expect } from 'vitest'
import { formatModelRef, pillModelRef } from './formatModelRef'

const DEFAULT = 'openai/gpt-4o-mini'

function node(over: Partial<{ providerOverride: 'openrouter' | 'ollama'; modelUsed: string }>) {
  return {
    providerOverride: over.providerOverride,
    modelUsed: over.modelUsed ?? DEFAULT,
  }
}

describe('formatModelRef', () => {
  it('reads a blank provider as inherit and a blank model as (default)', () => {
    expect(formatModelRef('ollama', 'llama3')).toBe('ollama/llama3')
    expect(formatModelRef(null, 'x')).toBe('inherit/x')
    expect(formatModelRef('openrouter', '')).toBe('openrouter/(default)')
  })
})

describe('pillModelRef', () => {
  it('says nothing when the node just inherits the default', () => {
    expect(pillModelRef(node({}), DEFAULT)).toBeNull()
  })

  it('ignores surrounding whitespace when comparing to the default', () => {
    expect(pillModelRef(node({ modelUsed: `  ${DEFAULT}  ` }), DEFAULT)).toBeNull()
    expect(pillModelRef(node({ modelUsed: DEFAULT }), `  ${DEFAULT} `)).toBeNull()
  })

  // The case the second line exists for: fan-out siblings carry a
  // byte-identical prompt, so the model is all that tells them apart.
  it('names the model when this turn departs from the default', () => {
    expect(pillModelRef(node({ modelUsed: 'anthropic/claude-3.7-sonnet' }), DEFAULT)).toBe(
      'anthropic/claude-3.7-sonnet',
    )
  })

  // A model-only fan-out leaves the provider on "inherit", so the provider
  // override alone is not a sufficient condition.
  it('names the model even when no provider override was set', () => {
    expect(pillModelRef(node({ modelUsed: 'meta-llama/llama-3.3-70b' }), DEFAULT)).toBe(
      'meta-llama/llama-3.3-70b',
    )
  })

  it('speaks up for an explicit provider override even on the default model', () => {
    expect(pillModelRef(node({ providerOverride: 'openrouter' }), DEFAULT)).toBe(DEFAULT)
  })

  // An OpenRouter slug already names its vendor, so `openrouter/` would be
  // redundant AND overrun the pill. Local inference is worth calling out.
  it('drops the redundant openrouter prefix but keeps ollama', () => {
    expect(pillModelRef(node({ providerOverride: 'openrouter', modelUsed: 'x/y' }), DEFAULT)).toBe(
      'x/y',
    )
    expect(pillModelRef(node({ providerOverride: 'ollama', modelUsed: 'llama3' }), DEFAULT)).toBe(
      'ollama/llama3',
    )
  })

  it('handles an ollama override with no model named', () => {
    expect(pillModelRef(node({ providerOverride: 'ollama', modelUsed: '' }), DEFAULT)).toBe(
      'ollama/(default)',
    )
  })

  it('stays short enough for the pill to render without truncating', () => {
    const ref = pillModelRef(node({ modelUsed: 'anthropic/claude-3.7-sonnet' }), DEFAULT)
    // ~34 chars fit on the second line at text-[10px] in a 240px pill.
    expect(ref!.length).toBeLessThanOrEqual(34)
  })
})
