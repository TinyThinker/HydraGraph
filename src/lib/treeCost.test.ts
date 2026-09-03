import { describe, it, expect } from 'vitest'
import { treeCostSummary } from './treeCost'
import type { TurnNode } from '../types'
import type { CatalogModel } from './openRouterCatalog'

// Explicit fixture so the math never rides on BUNDLED_CATALOG values.
// gpt-4o-mini priced at 0.15 / 0.60 USD per 1M.
const CATALOG: CatalogModel[] = [
  {
    id: 'openai/gpt-4o-mini',
    label: 'OpenAI: GPT-4o-mini',
    inputPerM: 0.15,
    outputPerM: 0.6,
    tier: 'cheap',
  },
]

function makeTurn(overrides: Partial<TurnNode>): TurnNode {
  return {
    id: overrides.id ?? 'node',
    treeId: overrides.treeId ?? 'tree-1',
    parentId: overrides.parentId ?? null,
    childrenIds: overrides.childrenIds ?? [],
    userPrompt: overrides.userPrompt ?? '',
    assistantResponse: overrides.assistantResponse ?? '',
    positionX: overrides.positionX ?? 0,
    positionY: overrides.positionY ?? 0,
    isCollapsed: overrides.isCollapsed ?? false,
    status: overrides.status ?? 'idle',
    modelUsed: overrides.modelUsed ?? 'openai/gpt-4o-mini',
    inputTokens: overrides.inputTokens,
    outputTokens: overrides.outputTokens,
    timestamp: overrides.timestamp ?? 0,
    provider: overrides.provider,
  }
}

function buildMap(nodes: TurnNode[]): Map<string, TurnNode> {
  return new Map(nodes.map((n) => [n.id, n]))
}

// A 3-turn linear conversation on gpt-4o-mini (0.15 / 0.60 USD per 1M).
// Each prompt is 400 chars -> approxTokens 100; each response 4000 chars -> 1000.
const PROMPT = 'u'.repeat(400)
const RESPONSE = 'a'.repeat(4000)

function threeTurns(): TurnNode[] {
  return [
    makeTurn({
      id: 't1',
      timestamp: 1,
      userPrompt: PROMPT,
      assistantResponse: RESPONSE,
      inputTokens: 150,
      outputTokens: 1000,
    }),
    makeTurn({
      id: 't2',
      timestamp: 2,
      userPrompt: PROMPT,
      assistantResponse: RESPONSE,
      inputTokens: 150,
      outputTokens: 1000,
    }),
    makeTurn({
      id: 't3',
      timestamp: 3,
      userPrompt: PROMPT,
      assistantResponse: RESPONSE,
      inputTokens: 150,
      outputTokens: 1000,
    }),
  ]
}

// Worked by hand:
//   actual per turn = 150/1e6*0.15 + 1000/1e6*0.60 = 0.0006225
//   actual          = 3 * 0.0006225                = 0.0018675
//   counterfactual (prior transcript re-sent each turn):
//     t1: cfInput = 0    + 100 = 100  -> 100/1e6*0.15  + 0.0006 = 0.000615
//     t2: cfInput = 1100 + 100 = 1200 -> 1200/1e6*0.15 + 0.0006 = 0.00078
//     t3: cfInput = 2200 + 100 = 2300 -> 2300/1e6*0.15 + 0.0006 = 0.000945
//     counterfactual = 0.00234
//   saved    = 0.00234 - 0.0018675 = 0.0004725
//   savedPct = 0.0004725 / 0.00234 = 0.20192307692...
const EXPECT_ACTUAL = 0.0018675
const EXPECT_CF = 0.00234
const EXPECT_SAVED = 0.0004725
const EXPECT_SAVED_PCT = 0.0004725 / 0.00234

describe('treeCostSummary', () => {
  it('actual vs. linear-thread counterfactual for a hand-built 3-turn tree', () => {
    const summary = treeCostSummary(buildMap(threeTurns()), CATALOG)

    expect(summary.actual).toBeCloseTo(EXPECT_ACTUAL, 8)
    expect(summary.counterfactual).toBeCloseTo(EXPECT_CF, 8)
    expect(summary.saved).toBeCloseTo(EXPECT_SAVED, 8)
    expect(summary.savedPct).toBeCloseTo(EXPECT_SAVED_PCT, 8)
    expect(summary.pricedTurns).toBe(3)
    expect(summary.unpricedTurns).toBe(0)
  })

  it('counts an unknown-model turn as unpriced without disturbing the math', () => {
    const nodes = threeTurns()
    nodes.push(
      makeTurn({
        id: 't-unknown',
        timestamp: 2.5,
        userPrompt: 'what about this one',
        assistantResponse: 'no price for this model',
        modelUsed: 'some-unlisted-model-v9',
        inputTokens: 999,
        outputTokens: 999,
      }),
    )

    const summary = treeCostSummary(buildMap(nodes), CATALOG)

    expect(summary.pricedTurns).toBe(3)
    expect(summary.unpricedTurns).toBe(1)
    expect(summary.actual).toBeCloseTo(EXPECT_ACTUAL, 8)
    expect(summary.counterfactual).toBeCloseTo(EXPECT_CF, 8)
  })

  it('ignores nodes with an empty userPrompt (e.g. a bare root)', () => {
    const nodes = threeTurns()
    nodes.push(
      makeTurn({
        id: 'root',
        timestamp: 0,
        userPrompt: '',
        assistantResponse: 'seed',
        inputTokens: 10,
        outputTokens: 10,
      }),
    )

    const summary = treeCostSummary(buildMap(nodes), CATALOG)
    expect(summary.pricedTurns).toBe(3)
    expect(summary.unpricedTurns).toBe(0)
    expect(summary.actual).toBeCloseTo(EXPECT_ACTUAL, 8)
  })

  it('empty map -> all zeros, savedPct 0', () => {
    expect(treeCostSummary(new Map(), CATALOG)).toEqual({
      actual: 0,
      counterfactual: 0,
      saved: 0,
      savedPct: 0,
      pricedTurns: 0,
      unpricedTurns: 0,
    })
  })
})
