import { describe, it, expect } from 'vitest'
import { buildDemoTree, DEMO_TREE_ID, isDemoTree } from './demoTree'
import { DEMO_TURNS } from './demoContent'
import { BUNDLED_CATALOG } from './bundledCatalog'
import { parseImportDoc, buildExportDoc, serializeExportDoc } from './treeExport'
import { treeCostSummary } from './treeCost'
import { turnCostUSD } from './pricing'
import type { TurnNode } from '../types'

const NOW = Date.UTC(2026, 8, 18, 15, 0, 0)

function asMap(nodes: TurnNode[]): Map<string, TurnNode> {
  return new Map(nodes.map((n) => [n.id, n]))
}

describe('buildDemoTree structure', () => {
  it('produces a tree whose shape the importer accepts', () => {
    const { tree, nodes } = buildDemoTree(NOW)
    // The strictest structural check in the codebase: parent/child symmetry,
    // single root, no dangling ids, root matches tree.rootNodeId.
    const parsed = parseImportDoc(serializeExportDoc(buildExportDoc(tree, nodes)))
    expect(parsed).toEqual({ ok: true, doc: expect.anything() })
  })

  it('covers every canned turn, all on the demo tree, all idle', () => {
    const { nodes } = buildDemoTree(NOW)
    expect(nodes).toHaveLength(DEMO_TURNS.length)
    expect(nodes.every((n) => n.treeId === DEMO_TREE_ID)).toBe(true)
    expect(nodes.every((n) => n.status === 'idle')).toBe(true)
    expect(nodes.every((n) => n.userPrompt.length > 0)).toBe(true)
    expect(nodes.every((n) => n.assistantResponse.length > 0)).toBe(true)
  })

  it('is deterministic for a given `now`', () => {
    expect(buildDemoTree(NOW)).toEqual(buildDemoTree(NOW))
  })

  it('lays nodes out with no two at the same position', () => {
    const { nodes } = buildDemoTree(NOW)
    const seen = new Set(nodes.map((n) => `${n.positionX},${n.positionY}`))
    expect(seen.size).toBe(nodes.length)
  })

  it('leaves the viewport unset so the canvas fits the whole tree on open', () => {
    const { tree } = buildDemoTree(NOW)
    expect(tree.viewportX).toBeUndefined()
    expect(tree.viewportY).toBeUndefined()
    expect(tree.viewportZoom).toBeUndefined()
  })

  it('timestamps turns in transcript order, ending at `now`', () => {
    const { nodes } = buildDemoTree(NOW)
    const stamps = nodes.map((n) => n.timestamp)
    expect([...stamps].sort((a, b) => a - b)).toEqual(stamps)
    expect(Math.max(...stamps)).toBe(NOW)
  })
})

describe('demo tree teaching content', () => {
  it('has a fan-out of three identical prompts to three different models', () => {
    const { nodes } = buildDemoTree(NOW)
    const byParent = new Map<string, TurnNode[]>()
    for (const n of nodes) {
      if (n.parentId == null) continue
      byParent.set(n.parentId, [...(byParent.get(n.parentId) ?? []), n])
    }

    const fanOut = [...byParent.values()].find(
      (siblings) =>
        siblings.length >= 3 && siblings.every((s) => s.userPrompt === siblings[0].userPrompt),
    )
    expect(fanOut, 'a 3-way identical-prompt fan-out is the demo headline').toBeDefined()
    expect(new Set(fanOut!.map((s) => s.modelUsed)).size).toBe(fanOut!.length)
  })

  it('shows a persona fan-out: same model, different system prompts', () => {
    const { nodes } = buildDemoTree(NOW)
    const personas = nodes.filter((n) => n.systemPromptOverride)
    expect(personas.length).toBeGreaterThanOrEqual(2)
    const siblings = personas.filter((n) => n.parentId === personas[0].parentId)
    expect(siblings.length).toBeGreaterThanOrEqual(2)
    expect(new Set(siblings.map((n) => n.systemPromptOverride)).size).toBe(siblings.length)
    expect(new Set(siblings.map((n) => n.modelUsed)).size).toBe(1)
  })

  it('goes at least six turns deep on the trunk', () => {
    const { nodes } = buildDemoTree(NOW)
    const map = asMap(nodes)
    const depth = (n: TurnNode): number => {
      let d = 1
      let cur = n
      while (cur.parentId != null) {
        cur = map.get(cur.parentId)!
        d++
      }
      return d
    }
    expect(Math.max(...nodes.map(depth))).toBeGreaterThanOrEqual(6)
  })
})

describe('demo tree cost receipt', () => {
  it('prices every turn against the bundled (offline) catalog', () => {
    const { nodes } = buildDemoTree(NOW)
    for (const n of nodes) {
      expect(turnCostUSD(n, BUNDLED_CATALOG), `${n.id} (${n.modelUsed}) must be priced`).not.toBeNull()
    }
  })

  it('reports a real branch-vs-linear saving, not $0.0000', () => {
    const { nodes } = buildDemoTree(NOW)
    const summary = treeCostSummary(asMap(nodes), BUNDLED_CATALOG)

    expect(summary.pricedTurns).toBe(nodes.length)
    expect(summary.unpricedTurns).toBe(0)
    expect(summary.actual).toBeGreaterThan(0)
    // The whole point of the receipt: the branched tree costs less than the same
    // turns replayed as one re-sending linear thread.
    expect(summary.counterfactual).toBeGreaterThan(summary.actual)
    expect(summary.savedPct).toBeGreaterThan(0.2)
  })

  it('derives token counts from the canned text rather than inventing them', () => {
    const { nodes } = buildDemoTree(NOW)
    for (const n of nodes) {
      expect(n.outputTokens).toBe(Math.round(n.assistantResponse.length / 4))
      expect(n.inputTokens).toBeGreaterThan(0)
    }
    // Deeper turns carry more accumulated context than the root.
    const root = nodes.find((n) => n.parentId == null)!
    const deepest = [...nodes].sort((a, b) => b.inputTokens! - a.inputTokens!)[0]
    expect(deepest.inputTokens!).toBeGreaterThan(root.inputTokens! * 3)
  })
})

describe('isDemoTree', () => {
  it('recognises only the demo tree id', () => {
    expect(isDemoTree(DEMO_TREE_ID)).toBe(true)
    expect(isDemoTree('some-other-tree')).toBe(false)
    expect(isDemoTree(null)).toBe(false)
    expect(isDemoTree(undefined)).toBe(false)
  })
})
