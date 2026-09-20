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

  it('truncates a long prompt to <= 12 words with an ellipsis', () => {
    const result = stationSummary(
      make({
        userPrompt: 'one two three four five six seven eight nine ten eleven twelve thirteen',
      }),
    )
    expect(result.endsWith('…')).toBe(true)
    expect(result.replace(/…$/, '').trim().split(' ').length).toBeLessThanOrEqual(12)
  })

  it('leaves a short prompt (<= 12 words) unchanged with no ellipsis', () => {
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

  // 64 rather than 48: the pill renders two lines of ~29 chars, so the old
  // budget threw away roughly half of every label before the user saw it.
  it('hard-caps the string to 64 chars + ellipsis', () => {
    const result = stationSummary(
      make({
        userPrompt:
          'supercalifragilisticexpialidocious antidisestablishmentarianism pneumonoultramicroscopicsilicovolcanoconiosis',
      }),
    )
    expect(result.endsWith('…')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(65)
    expect(result.length).toBeGreaterThan(49)
  })

  // Branch-from-selection seeds the composer with a `> `-quoted passage and
  // parks the caret below it, so the prompt's first line is the PARENT's
  // prose. Labelling the pill with it described where the branch came from
  // and never what it asked — five siblings all reading "Pillar N: …".
  describe('quote-seeded branches', () => {
    it('summarizes what the user typed, not the passage they quoted', () => {
      const result = stationSummary(
        make({
          userPrompt:
            '> Pillar 5: The Guarded Boundary keeps the agent honest\n> about what it verified\n\nhow do I test this in CI',
        }),
      )
      expect(result).toBe('how do I test this in CI')
    })

    it('handles a multi-line quote block followed by a multi-line question', () => {
      const result = stationSummary(
        make({ userPrompt: '> one\n> two\n> three\n\nwhat does\nthis imply' }),
      )
      expect(result).toBe('what does this imply')
    })

    it('falls back to the quote when the user has not typed past the seed', () => {
      const result = stationSummary(make({ userPrompt: '> just the quoted passage\n\n' }))
      expect(result).toBe('just the quoted passage')
    })

    // Only a LEADING quote block is the seed. A quote further down is the
    // user's own text and is summarized as written, marker included.
    it('leaves a prompt that merely contains a later quote alone', () => {
      const result = stationSummary(make({ userPrompt: 'my question\n\n> a quote after it' }))
      expect(result).toBe('my question > a quote after it')
    })
  })
})
