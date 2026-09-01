import type { TurnNode } from '../types'

const MAX_WORDS = 7
const MAX_CHARS = 48

/**
 * Derive a short, single-line label for a canvas "station pill" from a node.
 * Pure: same input -> same output. Never throws.
 *
 * - Source text = first non-empty of userPrompt, then assistantResponse.
 * - Both empty -> 'New station'.
 * - Whitespace/newlines collapse to single spaces; leading markdown markers
 *   (#, >, -, *, backticks) are stripped.
 * - First 7 words; append '…' when the source had more words or the result
 *   would exceed 48 chars (hard-capped to 48 chars + '…').
 */
export function stationSummary(
  node: Pick<TurnNode, 'userPrompt' | 'assistantResponse' | 'parentId'>,
): string {
  const raw = node.userPrompt.trim() || node.assistantResponse.trim()
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
