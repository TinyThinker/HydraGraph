/**
 * OpenRouter model catalog — fetch + normalize.
 *
 * Pure network + transform: no store access, no Dexie, no React. The Zustand
 * `catalogStore` owns caching / fallback; this module only knows how to turn
 * OpenRouter's `GET /api/v1/models` payload into `CatalogModel[]`.
 */

export type ModelTier = 'cheap' | 'mid' | 'frontier'

export interface CatalogModel {
  /** OpenRouter id, e.g. `"deepseek/deepseek-chat"`. */
  id: string
  /** Human label from the API `name` field (falls back to `id`). */
  label: string
  /** USD per 1,000,000 input (prompt) tokens. */
  inputPerM: number
  /** USD per 1,000,000 output (completion) tokens. */
  outputPerM: number
  /** Derived from output-price percentiles within the fetched set. */
  tier: ModelTier
  /** Max context window in tokens, when the API reports one. */
  contextWindow?: number
}

interface RawModel {
  id?: unknown
  name?: unknown
  context_length?: unknown
  pricing?: { prompt?: unknown; completion?: unknown } | null
}

/** Parse a string/number to a finite number, else 0. */
function toNumber(value: unknown): number {
  const n = typeof value === 'string' ? Number.parseFloat(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(n) ? n : 0
}

/** Value at percentile `p` (0..1) of an ascending numeric array. */
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0
  return sortedAsc[Math.floor((sortedAsc.length - 1) * p)]
}

/**
 * Normalize an OpenRouter `/models` payload into a price-sorted `CatalogModel[]`.
 * Tiers are assigned from the output-price terciles of *this* set: `<= p33` is
 * `cheap`, `<= p66` is `mid`, the rest `frontier`.
 */
export function normalizeCatalog(payload: unknown): CatalogModel[] {
  const data = (payload as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) return []

  const rows = data
    .filter((m): m is RawModel => !!m && typeof m === 'object' && typeof (m as RawModel).id === 'string')
    .map((m) => {
      const id = String(m.id)
      const label = typeof m.name === 'string' && m.name.length > 0 ? m.name : id
      const contextWindow = toNumber(m.context_length)
      return {
        id,
        label,
        inputPerM: toNumber(m.pricing?.prompt) * 1e6,
        outputPerM: toNumber(m.pricing?.completion) * 1e6,
        contextWindow: contextWindow > 0 ? contextWindow : undefined,
      }
    })

  const outputsAsc = rows.map((m) => m.outputPerM).sort((a, b) => a - b)
  const p33 = percentile(outputsAsc, 1 / 3)
  const p66 = percentile(outputsAsc, 2 / 3)

  return rows
    .map<CatalogModel>((m) => ({
      ...m,
      tier: m.outputPerM <= p33 ? 'cheap' : m.outputPerM <= p66 ? 'mid' : 'frontier',
    }))
    .sort((a, b) => a.outputPerM - b.outputPerM || a.inputPerM - b.inputPerM || a.id.localeCompare(b.id))
}

/** GET `${baseUrl}/models` and normalize. Throws on a non-2xx response. */
export async function fetchOpenRouterModels(baseUrl: string): Promise<CatalogModel[]> {
  const url = `${baseUrl.replace(/\/+$/, '')}/models`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`OpenRouter /models responded ${res.status}`)
  return normalizeCatalog(await res.json())
}
