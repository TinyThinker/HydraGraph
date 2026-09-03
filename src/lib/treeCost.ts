import type { TurnNode } from '../types'
import type { CatalogModel } from './openRouterCatalog'
import { resolvePrice, turnCostUSD } from './pricing'

/**
 * Per-tree cost math: what the branched tree actually cost vs. what the same
 * turns would have cost as ONE linear thread that re-sends the entire prior
 * transcript (both roles) on every turn. The gap is "context you didn't pay for".
 *
 * Pure: no store access, no Dexie, no React, no side effects.
 */

/** ~4 chars per token, matching `contextEstimate.ts`. */
function approxTokens(text: string): number {
  return Math.round(text.length / 4)
}

/** Real turns = nodes with a non-empty `userPrompt`, chronological, ties by id. */
function realTurns(nodes: Map<string, TurnNode>): TurnNode[] {
  return Array.from(nodes.values())
    .filter((n) => n.userPrompt.length > 0)
    .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))
}

export interface TreeCostSummary {
  /** Σ real per-turn cost, priced turns only. */
  actual: number
  /** Σ cost of the same priced turns replayed as one re-sending linear thread. */
  counterfactual: number
  /** `counterfactual - actual`. */
  saved: number
  /** `saved / counterfactual` (0 when counterfactual is 0). */
  savedPct: number
  /** Real turns with a known price. */
  pricedTurns: number
  /** Real turns whose model / tokens gave no price. */
  unpricedTurns: number
}

export function treeCostSummary(
  nodes: Map<string, TurnNode>,
  catalog?: CatalogModel[],
): TreeCostSummary {
  const turns = realTurns(nodes)

  let actual = 0
  let pricedTurns = 0
  let unpricedTurns = 0
  const priced: TurnNode[] = []

  for (const turn of turns) {
    const cost = turnCostUSD(turn, catalog)
    if (cost === null) {
      unpricedTurns++
    } else {
      actual += cost
      pricedTurns++
      priced.push(turn)
    }
  }

  let counterfactual = 0
  let priorTranscriptTokens = 0
  for (const turn of priced) {
    const price = resolvePrice(turn.modelUsed, turn.provider, catalog)
    if (price === null) continue // unreachable — priced turns resolve by construction
    const cfInput = priorTranscriptTokens + approxTokens(turn.userPrompt)
    counterfactual +=
      (cfInput / 1e6) * price.inputPerM + ((turn.outputTokens ?? 0) / 1e6) * price.outputPerM
    priorTranscriptTokens +=
      approxTokens(turn.userPrompt) + approxTokens(turn.assistantResponse)
  }

  const saved = counterfactual - actual
  const savedPct = counterfactual > 0 ? saved / counterfactual : 0

  return { actual, counterfactual, saved, savedPct, pricedTurns, unpricedTurns }
}
