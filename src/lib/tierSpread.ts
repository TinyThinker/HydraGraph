import type { CatalogModel, ModelTier } from './openRouterCatalog'
import type { LLMProvider } from '../types'

export interface TierPick {
  provider: LLMProvider
  /** OpenRouter model id, or `''` for an Ollama placeholder the user fills in. */
  model: string
}

const TIER_ORDER: ModelTier[] = ['cheap', 'mid', 'frontier']

const byPrice = (a: CatalogModel, b: CatalogModel): number =>
  a.outputPerM - b.outputPerM || a.inputPerM - b.inputPerM || a.id.localeCompare(b.id)

/**
 * Pick `n` starter variants for a fan-out that span the OpenRouter price range.
 *
 * - `openrouter` configured → walk `cheap → mid → frontier`, taking one
 *   representative each (cheapest `cheap`, median `mid`, priciest `frontier`),
 *   then fill any remaining slots from the price-sorted catalog. Results come
 *   back ascending by output price.
 * - `ollama` also configured → the last slot is a `{ provider: 'ollama',
 *   model: '' }` placeholder (local models can't be enumerated here).
 * - `ollama` only → a single Ollama placeholder.
 * - nothing configured → `[]`.
 *
 * Pure — callers pass `useCatalogStore.getState().models` and clamp `n`.
 */
export function tierSpread(
  models: CatalogModel[],
  configured: LLMProvider[],
  n: number,
): TierPick[] {
  if (configured.length === 0 || n <= 0) return []

  const hasOpenRouter = configured.includes('openrouter')
  const hasOllama = configured.includes('ollama')

  if (!hasOpenRouter) return hasOllama ? [{ provider: 'ollama', model: '' }] : []

  const orTarget = Math.max(0, hasOllama ? n - 1 : n)
  const sorted = [...models].sort(byPrice)
  const pools: Record<ModelTier, CatalogModel[]> = { cheap: [], mid: [], frontier: [] }
  for (const m of sorted) pools[m.tier]?.push(m)

  const taken = new Set<string>()
  const representative = (tier: ModelTier): CatalogModel | undefined => {
    const list = pools[tier].filter((m) => !taken.has(m.id))
    if (list.length === 0) return undefined
    if (tier === 'cheap') return list[0]
    if (tier === 'frontier') return list[list.length - 1]
    return list[Math.floor((list.length - 1) / 2)]
  }

  const picks: CatalogModel[] = []
  for (const tier of TIER_ORDER) {
    if (picks.length >= orTarget) break
    const rep = representative(tier)
    if (rep) {
      picks.push(rep)
      taken.add(rep.id)
    }
  }
  for (const m of sorted) {
    if (picks.length >= orTarget) break
    if (!taken.has(m.id)) {
      picks.push(m)
      taken.add(m.id)
    }
  }

  const result: TierPick[] = picks
    .sort(byPrice)
    .map((m) => ({ provider: 'openrouter' as LLMProvider, model: m.id }))
  if (hasOllama && result.length < n) result.push({ provider: 'ollama', model: '' })
  return result
}
