import type { TurnNode, LLMProvider } from '../types'
import type { CatalogModel } from './openRouterCatalog'
import { useCatalogStore } from '../store/catalogStore'

/**
 * Model pricing helpers.
 *
 * Prices come from the live OpenRouter catalog (`catalogStore`), seeded from the
 * bundled snapshot so a lookup always has data. There is no hand-maintained
 * table here any more.
 *
 * Pure helpers: the only store touch is the synchronous default argument to
 * `resolvePrice`, read once per call. No Dexie, no React, no side effects.
 */

export interface ModelPrice {
  /** USD per 1,000,000 input (prompt) tokens. */
  inputPerM: number
  /** USD per 1,000,000 output (completion) tokens. */
  outputPerM: number
}

function priceOf(model: CatalogModel): ModelPrice {
  return { inputPerM: model.inputPerM, outputPerM: model.outputPerM }
}

/**
 * Resolve a price for a model id against a catalog.
 *
 * - `ollama` provider is always free ({ 0, 0 }) — local inference.
 * - otherwise, against `catalog`: exact id -> case-insensitive id -> longest
 *   catalog id that is a case-insensitive prefix of `model`
 *   (`anthropic/claude-3.5-sonnet-20241022` -> `anthropic/claude-3.5-sonnet`).
 *   Catalog ids are `vendor/model` and kept whole.
 * - no match -> `null`.
 *
 * `catalog` defaults to the current `catalogStore` models (synchronous read).
 */
export function resolvePrice(
  model: string,
  provider?: LLMProvider,
  catalog: CatalogModel[] = useCatalogStore.getState().models,
): ModelPrice | null {
  if (provider === 'ollama') return { inputPerM: 0, outputPerM: 0 }

  const exact = catalog.find((m) => m.id === model)
  if (exact !== undefined) return priceOf(exact)

  const lower = model.toLowerCase()

  const caseless = catalog.find((m) => m.id.toLowerCase() === lower)
  if (caseless !== undefined) return priceOf(caseless)

  let best: CatalogModel | null = null
  for (const m of catalog) {
    if (lower.startsWith(m.id.toLowerCase())) {
      if (best === null || m.id.length > best.id.length) best = m
    }
  }
  return best === null ? null : priceOf(best)
}

/**
 * Dollar cost of a single turn from its recorded token counts.
 *
 * `null` when either token count is missing or the model has no known price.
 * `catalog` is forwarded to {@link resolvePrice} (defaults to the store).
 */
export function turnCostUSD(
  node: Pick<TurnNode, 'modelUsed' | 'inputTokens' | 'outputTokens' | 'provider'>,
  catalog?: CatalogModel[],
): number | null {
  if (node.inputTokens === undefined || node.outputTokens === undefined) return null
  const price = resolvePrice(node.modelUsed, node.provider, catalog)
  if (price === null) return null
  return (node.inputTokens / 1e6) * price.inputPerM + (node.outputTokens / 1e6) * price.outputPerM
}

/** `$` + 4 decimals below $1, 2 decimals at/above. `$0.0000`, `$0.0041`, `$3.12`. */
export function formatUSD(n: number): string {
  const decimals = n < 1 ? 4 : 2
  return `$${n.toFixed(decimals)}`
}
