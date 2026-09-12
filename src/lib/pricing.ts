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
 * Per-catalog lookup index, keyed on the catalog array's identity.
 *
 * The live OpenRouter catalog is several hundred entries and `resolvePrice` is
 * called per turn, per render — the chat stream, the compare columns and the
 * receipt all price on every pass — so the original exact/caseless/prefix scans
 * were O(catalog) three times over, per node. The catalog array is replaced
 * wholesale by `catalogStore` rather than mutated, so a WeakMap keyed on it
 * stays correct across a refresh and lets the entries be collected with it.
 */
interface CatalogIndex {
  byId: Map<string, CatalogModel>
  /** Catalog ids lowercased, longest first — first prefix hit is the best one. */
  sortedIds: string[]
}

const indexCache = new WeakMap<CatalogModel[], CatalogIndex>()

function indexFor(catalog: CatalogModel[]): CatalogIndex {
  const cached = indexCache.get(catalog)
  if (cached !== undefined) return cached

  const byId = new Map<string, CatalogModel>()
  for (const m of catalog) {
    byId.set(m.id, m)
    const lower = m.id.toLowerCase()
    if (!byId.has(lower)) byId.set(lower, m)
  }
  const sortedIds = catalog.map((m) => m.id.toLowerCase()).sort((a, b) => b.length - a.length)

  const index: CatalogIndex = { byId, sortedIds }
  indexCache.set(catalog, index)
  return index
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

  const { byId, sortedIds } = indexFor(catalog)

  // Exact id, then case-insensitive id — both O(1). An exact entry always
  // overwrites a caseless one when the index is built, so this order holds.
  const direct = byId.get(model)
  if (direct !== undefined) return priceOf(direct)

  const lower = model.toLowerCase()
  const caseless = byId.get(lower)
  if (caseless !== undefined) return priceOf(caseless)

  // Longest catalog id that prefixes `model`. sortedIds is longest-first, so
  // the first hit is already the longest one.
  for (const id of sortedIds) {
    if (lower.startsWith(id)) {
      const match = byId.get(id)
      if (match !== undefined) return priceOf(match)
    }
  }
  return null
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
