import { describe, it, expect } from 'vitest'
import { formatQuoteSeed, truncateQuote, MAX_QUOTE_CHARS } from './quotePrompt'

describe('truncateQuote', () => {
  it('leaves a short passage untouched apart from trimming', () => {
    expect(truncateQuote('  hello there  ')).toBe('hello there')
  })

  it('cuts at a word boundary and marks the elision', () => {
    const out = truncateQuote('alpha beta gamma delta', 12)
    expect(out).toBe('alpha beta…')
    expect(out.length).toBeLessThanOrEqual(13)
  })

  it('hard-cuts when there is no usable word boundary', () => {
    const out = truncateQuote('a'.repeat(50), 10)
    expect(out).toBe(`${'a'.repeat(10)}…`)
  })

  it('defaults to MAX_QUOTE_CHARS', () => {
    const out = truncateQuote('word '.repeat(400))
    expect(out.length).toBeLessThanOrEqual(MAX_QUOTE_CHARS + 1)
    expect(out.endsWith('…')).toBe(true)
  })
})

describe('formatQuoteSeed', () => {
  it('renders a single line as a blockquote with a trailing blank line', () => {
    expect(formatQuoteSeed('LSM trees trade read amplification')).toBe(
      '> LSM trees trade read amplification\n\n',
    )
  })

  it('quotes every line of a multi-line passage', () => {
    expect(formatQuoteSeed('first line\nsecond line')).toBe('> first line\n> second line\n\n')
  })

  it('drops blank lines instead of quoting them', () => {
    expect(formatQuoteSeed('para one\n\n\npara two')).toBe('> para one\n> para two\n\n')
  })

  it('returns empty string for a whitespace-only passage', () => {
    expect(formatQuoteSeed('   \n  \n ')).toBe('')
  })

  it('truncates a very long passage', () => {
    const seed = formatQuoteSeed('word '.repeat(400))
    expect(seed.endsWith('…\n\n')).toBe(true)
    expect(seed.length).toBeLessThan(MAX_QUOTE_CHARS + 10)
  })
})
