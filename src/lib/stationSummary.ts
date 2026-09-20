import type { TurnNode } from '../types'

const MAX_WORDS = 12
const MAX_CHARS = 64

/**
 * Strip a leading Markdown blockquote when the prompt continues underneath it.
 *
 * Branch-from-selection seeds the composer with the quoted passage and parks
 * the caret below it (`formatQuoteSeed`), so the prompt's first line is the
 * *parent's* prose. Summarizing that labels the pill with where the branch came
 * from and never with what it asks — five sibling branches all reading
 * "Pillar N: …" because that is what the parent's headings said.
 *
 * The quote is kept when nothing follows it: the user has not typed past the
 * seed yet, and the quote is genuinely all there is to show.
 */
function dropLeadingQuote(raw: string): string {
  const lines = raw.split('\n')
  let i = 0
  let sawQuote = false
  for (; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line === '') continue
    if (line.startsWith('>')) {
      sawQuote = true
      continue
    }
    break
  }
  if (!sawQuote) return raw

  const rest = lines.slice(i).join('\n').trim()
  return rest === '' ? raw : rest
}

/**
 * Derive a short label for a canvas "station pill" from a node.
 * Pure: same input -> same output. Never throws.
 *
 * - Source text = first non-empty of userPrompt, then assistantResponse.
 * - Both empty -> 'New station'.
 * - A leading blockquote is skipped when the prompt continues below it.
 * - Whitespace/newlines collapse to single spaces; leading markdown markers
 *   (#, >, -, *, backticks) are stripped.
 * - First 12 words; append '…' when the source had more words or the result
 *   would exceed 64 chars (hard-capped to 64 chars + '…').
 *
 * The 64-char budget is sized for the two lines the pill now renders (~29
 * characters each at `text-xs` in a 240px pill). It was 48 while the pill
 * displayed one `truncate`d line of 19–29, so the browser silently re-cut
 * roughly half of every label this function returned and the user never
 * learned a longer one existed. `line-clamp-2` does the final trimming now,
 * which is the only place that knows the real width.
 */
export function stationSummary(
  node: Pick<TurnNode, 'userPrompt' | 'assistantResponse' | 'parentId'>,
): string {
  const prompt = node.userPrompt.trim()
  const raw = (prompt ? dropLeadingQuote(prompt) : '') || node.assistantResponse.trim()
  if (!raw) return 'New station'

  const cleaned = raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[#>\-*`\s]+/, '')
    .trim()

  if (!cleaned) return 'New station'

  const words = cleaned.split(' ')
  let result = words.slice(0, MAX_WORDS).join(' ')
  let truncated = words.length > MAX_WORDS

  if (result.length > MAX_CHARS) {
    result = result.slice(0, MAX_CHARS).trimEnd()
    truncated = true
  }

  return truncated ? `${result}…` : result
}
