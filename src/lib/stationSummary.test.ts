import { describe, it, expect } from 'vitest'
import { stationSummary } from './stationSummary'

function make(over: Partial<{ userPrompt: string; assistantResponse: string }>) {
  return {
    userPrompt: over.userPrompt ?? '',
    assistantResponse: over.assistantResponse ?? '',
    parentId: null as string | null,
  }
}

describe('stationSummary', () => {
  it('returns "New station" when both prompt and response are empty', () => {
    expect(stationSummary(make({}))).toBe('New station')
    expect(stationSummary(make({ userPrompt: '   ', assistantResponse: '\n\t' }))).toBe('New station')
  })

  it('truncates a long prompt to <= 7 words with an ellipsis', () => {
    const result = stationSummary(
      make({ userPrompt: 'one two three four five six seven eight nine ten' }),
    )
    expect(result.endsWith('…')).toBe(true)
    expect(result.replace(/…$/, '').trim().split(' ').length).toBeLessThanOrEqual(7)
  })

  it('leaves a short prompt (<= 7 words) unchanged with no ellipsis', () => {
    const result = stationSummary(make({ userPrompt: 'what is a monad' }))
    expect(result).toBe('what is a monad')
    expect(result.includes('…')).toBe(false)
  })

  it('falls back to assistantResponse when userPrompt is empty', () => {
    const result = stationSummary(
      make({ userPrompt: '', assistantResponse: 'The answer is fortytwo' }),
    )
    expect(result).toBe('The answer is fortytwo')
  })

  it('collapses newlines and whitespace to single spaces', () => {
    const result = stationSummary(
      make({ userPrompt: 'hello\n\n   world\tagain' }),
    )
    expect(result).toBe('hello world again')
  })

  it('strips leading markdown markers', () => {
    expect(stationSummary(make({ userPrompt: '### Heading text here' }))).toBe('Heading text here')
    expect(stationSummary(make({ userPrompt: '> quoted words follow' }))).toBe('quoted words follow')
  })

  it('hard-caps the string to 48 chars + ellipsis', () => {
    const result = stationSummary(
      make({ userPrompt: 'supercalifragilisticexpialidocious' + ' antidisestablishmentarianism' }),
    )
    expect(result.endsWith('…')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(49)
  })
})
