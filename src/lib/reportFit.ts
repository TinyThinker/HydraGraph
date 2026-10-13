import type { CatalogModel } from './openRouterCatalog'
import type { ContextResolutionResult, LLMProvider } from '../types'

/** Room left for the report itself when checking whether a selection fits. */
export const OUTPUT_RESERVE_TOKENS = 8000
/** Headroom on the input estimate, because chars/4 is only a ruler, not a count. */
export const INPUT_MARGIN = 0.15

/** chars/4 over system + messages — the same ruler as `contextEstimate.ts`. */
export function estimateTokens(payload: ContextResolutionResult): number {
  const chars = payload.systemPrompt.length + payload.messages.reduce((sum, m) => sum + m.content.length, 0)
  return Math.round(chars / 4)
}

export interface FitResult {
  fits: boolean
  /** Input with margin, plus the output reserve. */
  needed: number
  /** The model's context window; `null` when unknown (then `fits` is true). */
  limit: number | null
}

export function checkFit({
  inputTokens,
  contextWindow,
  outputReserve = OUTPUT_RESERVE_TOKENS,
}: {
  inputTokens: number
  contextWindow: number | null
  outputReserve?: number
}): FitResult {
  const needed = Math.ceil(inputTokens * (1 + INPUT_MARGIN)) + outputReserve
  if (contextWindow === null) return { fits: true, needed, limit: null }
  return { fits: needed <= contextWindow, needed, limit: contextWindow }
}

/** The model's context window from the OpenRouter catalog. Ollama is not a report writer. */
export function contextWindowFor(provider: LLMProvider, model: string, catalog: CatalogModel[]): number | null {
  if (provider !== 'openrouter') return null
  return catalog.find((m) => m.id === model)?.contextWindow ?? null
}
