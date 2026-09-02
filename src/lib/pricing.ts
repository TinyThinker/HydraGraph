import type { TurnNode } from '../types'

/**
 * Model pricing table.
 *
 * Figures are approximate, expressed as USD per 1,000,000 tokens, last checked
 * 2026-09. This table is the one place to update when published rates move — no
 * other module hard-codes a rate.
 *
 * Pure data + pure helpers: no store access, no Dexie, no React, no side effects.
 */

export interface ModelPrice {
  /** USD per 1,000,000 input (prompt) tokens. */
  inputPerM: number
  /** USD per 1,000,000 output (completion) tokens. */
  outputPerM: number
}

export const MODEL_PRICING: Record<string, ModelPrice> = {
  // Google Gemini (native API names)
  'gemini-2.5-flash': { inputPerM: 0.3, outputPerM: 2.5 },
  'gemini-2.5-pro': { inputPerM: 1.25, outputPerM: 10 },
  'gemini-1.5-flash': { inputPerM: 0.075, outputPerM: 0.3 },
  'gemini-1.5-pro': { inputPerM: 1.25, outputPerM: 5 },

  // OpenRouter-style vendor/model slugs
  'openai/gpt-4o': { inputPerM: 2.5, outputPerM: 10 },
  'openai/gpt-4o-mini': { inputPerM: 0.15, outputPerM: 0.6 },
  'anthropic/claude-3.5-sonnet': { inputPerM: 3, outputPerM: 15 },
  'anthropic/claude-3-opus': { inputPerM: 15, outputPerM: 75 },
  'meta-llama/llama-3.1-70b-instruct': { inputPerM: 0.3, outputPerM: 0.3 },
  'google/gemini-flash-1.5': { inputPerM: 0.075, outputPerM: 0.3 },
}

type Provider = 'gemini' | 'openrouter' | 'ollama'

/** Exact key, then case-insensitive key. */
function lookupInsensitive(key: string): ModelPrice | null {
  if (Object.prototype.hasOwnProperty.call(MODEL_PRICING, key)) {
    return MODEL_PRICING[key]
  }
  const lower = key.toLowerCase()
  for (const tableKey of Object.keys(MODEL_PRICING)) {
    if (tableKey.toLowerCase() === lower) return MODEL_PRICING[tableKey]
  }
  return null
}

/** Longest table key that `candidate` starts with (case-insensitive). */
function longestPrefixMatch(candidate: string): ModelPrice | null {
  const lower = candidate.toLowerCase()
  let bestKey: string | null = null
  for (const tableKey of Object.keys(MODEL_PRICING)) {
    if (lower.startsWith(tableKey.toLowerCase())) {
      if (bestKey === null || tableKey.length > bestKey.length) bestKey = tableKey
    }
  }
  return bestKey === null ? null : MODEL_PRICING[bestKey]
}

/**
 * Resolve a price for a model id.
 *
 * - `ollama` provider is always free ({ 0, 0 }) — local inference.
 * - otherwise: exact key -> case-insensitive -> strip a leading `vendor/`
 *   segment and retry -> longest table-key prefix match
 *   (`gemini-2.5-flash-preview-09` -> `gemini-2.5-flash`).
 * - no match -> `null`.
 */
export function resolvePrice(model: string, provider?: Provider): ModelPrice | null {
  if (provider === 'ollama') return { inputPerM: 0, outputPerM: 0 }

  const candidates = [model]
  const slash = model.indexOf('/')
  if (slash !== -1) candidates.push(model.slice(slash + 1))

  for (const candidate of candidates) {
    const hit = lookupInsensitive(candidate)
    if (hit !== null) return hit
  }
  for (const candidate of candidates) {
    const hit = longestPrefixMatch(candidate)
    if (hit !== null) return hit
  }
  return null
}

/**
 * Dollar cost of a single turn from its recorded token counts.
 *
 * `null` when either token count is missing or the model has no known price.
 */
export function turnCostUSD(
  node: Pick<TurnNode, 'modelUsed' | 'inputTokens' | 'outputTokens' | 'provider'>,
): number | null {
  if (node.inputTokens === undefined || node.outputTokens === undefined) return null
  const price = resolvePrice(node.modelUsed, node.provider)
  if (price === null) return null
  return (node.inputTokens / 1e6) * price.inputPerM + (node.outputTokens / 1e6) * price.outputPerM
}

/** `$` + 4 decimals below $1, 2 decimals at/above. `$0.0000`, `$0.0041`, `$3.12`. */
export function formatUSD(n: number): string {
  const decimals = n < 1 ? 4 : 2
  return `$${n.toFixed(decimals)}`
}
