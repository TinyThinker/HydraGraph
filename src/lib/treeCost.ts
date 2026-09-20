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
  /**
   * Real turns excluded because the model has no catalog price.
   *
   * Distinct from {@link unmeasuredTurns}: this is a catalog gap (an unlisted
   * or misspelled model id), and no amount of token data fixes it.
   */
  unpricedTurns: number
  /**
   * Real turns excluded because no token counts were ever recorded — the turn
   * is still streaming, was cancelled, or errored before its usage frame.
   *
   * Checked before pricing, matching `turnCostUSD`'s own short-circuit order,
   * so a turn that is both unmeasured and unpriced counts here only.
   */
  unmeasuredTurns: number
}

export function treeCostSummary(
  nodes: Map<string, TurnNode>,
  catalog?: CatalogModel[],
): TreeCostSummary {
  const turns = realTurns(nodes)

  let actual = 0
  let pricedTurns = 0
  let unpricedTurns = 0
  let unmeasuredTurns = 0
  const priced: TurnNode[] = []

  for (const turn of turns) {
    const cost = turnCostUSD(turn, catalog)
    if (cost === null) {
      // Why the turn was excluded decides what the receipt tells the user, and
      // the two causes need different answers: a missing price is a catalog
      // gap, missing tokens mean the turn never finished. Mirrors
      // `turnCostUSD`'s own order so the two can never disagree.
      if (turn.inputTokens === undefined || turn.outputTokens === undefined) {
        unmeasuredTurns++
      } else {
        unpricedTurns++
      }
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

  return {
    actual,
    counterfactual,
    saved,
    savedPct,
    pricedTurns,
    unpricedTurns,
    unmeasuredTurns,
  }
}
