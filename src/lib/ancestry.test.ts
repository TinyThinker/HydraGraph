import { describe, it, expect } from 'vitest'
import { getAncestryChain } from './ancestry'
import type { TurnNode } from '../types'

function createNodeFixture(overrides: Partial<TurnNode>): TurnNode {
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
    modelUsed: overrides.modelUsed ?? 'test-model',
    timestamp: overrides.timestamp ?? Date.now(),
  }
}

function buildMap(nodes: TurnNode[]): Map<string, TurnNode> {
  return new Map(nodes.map((n) => [n.id, n]))
}

describe('getAncestryChain', () => {
  it('single root node returns [root]', () => {
    const root = createNodeFixture({ id: 'r', parentId: null })
    const nodes = buildMap([root])
    expect(getAncestryChain(nodes, 'r')).toEqual([root])
  })

  it('deep chain root -> a -> b -> c returns 4 nodes in root-first order', () => {
    const r = createNodeFixture({ id: 'r', parentId: null, childrenIds: ['a'] })
    const a = createNodeFixture({ id: 'a', parentId: 'r', childrenIds: ['b'] })
    const b = createNodeFixture({ id: 'b', parentId: 'a', childrenIds: ['c'] })
    const c = createNodeFixture({ id: 'c', parentId: 'b', childrenIds: [] })
    const nodes = buildMap([r, a, b, c])

    const chain = getAncestryChain(nodes, 'c')
    expect(chain).toHaveLength(4)
    expect(chain.map((n) => n.id)).toEqual(['r', 'a', 'b', 'c'])
  })

  it('branch node returns only its own lineage, not siblings', () => {
    const r = createNodeFixture({ id: 'r', parentId: null, childrenIds: ['a', 'b'] })
    const a = createNodeFixture({ id: 'a', parentId: 'r', childrenIds: ['a1'] })
    const a1 = createNodeFixture({ id: 'a1', parentId: 'a', childrenIds: [] })
    const b = createNodeFixture({ id: 'b', parentId: 'r', childrenIds: [] })
    const nodes = buildMap([r, a, a1, b])

    const chain = getAncestryChain(nodes, 'a1')
    expect(chain.map((n) => n.id)).toEqual(['r', 'a', 'a1'])
    expect(chain.map((n) => n.id)).not.toContain('b')
  })

  it('null id returns []', () => {
    const root = createNodeFixture({ id: 'r', parentId: null })
    const nodes = buildMap([root])
    expect(getAncestryChain(nodes, null)).toEqual([])
  })

  it('missing id returns []', () => {
    const root = createNodeFixture({ id: 'r', parentId: null })
    const nodes = buildMap([root])
    expect(getAncestryChain(nodes, 'nope')).toEqual([])
  })

  it('broken parent pointer stops the walk gracefully', () => {
    const a = createNodeFixture({ id: 'a', parentId: 'ghost', childrenIds: ['b'] })
    const b = createNodeFixture({ id: 'b', parentId: 'a', childrenIds: [] })
    const nodes = buildMap([a, b])

    const chain = getAncestryChain(nodes, 'b')
    expect(chain.map((n) => n.id)).toEqual(['a', 'b'])
  })

  it('cycle guard: a.parent=b, b.parent=a does not infinite-loop', () => {
    const a = createNodeFixture({ id: 'a', parentId: 'b', childrenIds: [] })
    const b = createNodeFixture({ id: 'b', parentId: 'a', childrenIds: [] })
    const nodes = buildMap([a, b])

    const chain = getAncestryChain(nodes, 'a')
    expect(chain).toHaveLength(2)
    expect(chain.map((n) => n.id).sort()).toEqual(['a', 'b'])
  })

  it('self-referential cycle (a.parent=a) does not infinite-loop', () => {
    const a = createNodeFixture({ id: 'a', parentId: 'a', childrenIds: [] })
    const nodes = buildMap([a])

    const chain = getAncestryChain(nodes, 'a')
    expect(chain.map((n) => n.id)).toEqual(['a'])
  })
})
