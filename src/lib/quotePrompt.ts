/**
 * Turns a passage the user highlighted in a response into the opening of a new
 * prompt.
 *
 * Branching used to always start from an empty box, which put the burden of
 * restating context on the user — the thing a conversation tree is supposed to
 * carry for them. Seeding the composer with the quoted passage makes "ask about
 * this specific paragraph" a two-click operation, and the quote also tells the
 * model which part of its own answer the follow-up is about (the full ancestor
 * chain is inherited either way, but not the emphasis).
 *
 * Pure string helpers: no store, no React, no DOM.
 */

/** Longest quote seeded into the composer before it is trimmed. */
export const MAX_QUOTE_CHARS = 500

/** Shortest highlight that offers a branch action — guards stray clicks. */
export const MIN_SELECTION_CHARS = 3

/**
 * Trim to `max` characters, preferring a word boundary, with an ellipsis when
 * anything was dropped.
 */
export function truncateQuote(raw: string, max = MAX_QUOTE_CHARS): string {
  const text = raw.trim()
  if (text.length <= max) return text

  const cut = text.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  const body = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${body.trimEnd()}…`
}

/**
 * Format a highlighted passage as a Markdown blockquote followed by a blank
 * line, ready to prepend to the composer with the caret landing underneath.
 *
 * Blank lines inside the passage are dropped rather than quoted, so a selection
 * spanning several paragraphs stays one compact block.
 *
 * Returns `''` for a passage that is empty once trimmed.
 */
export function formatQuoteSeed(raw: string, max = MAX_QUOTE_CHARS): string {
  const text = truncateQuote(raw, max)
  if (text === '') return ''

  const body = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => `> ${line}`)
    .join('\n')

  return `${body}\n\n`
}
