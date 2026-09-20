import { describe, it, expect } from 'vitest'
import {
  activePathIds,
  edgeAppearance,
  pillDimClassName,
  ACTIVE_EDGE_STYLE,
  INACTIVE_EDGE_STYLE,
  BASE_EDGE_STYLE,
} from './pathHighlight'
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

// tree: root -> a -> b  ; sibling root -> a2 -> b2
function buildTree(): Map<string, TurnNode> {
  const root = createNodeFixture({ id: 'root', parentId: null, childrenIds: ['a', 'a2'] })
  const a = createNodeFixture({ id: 'a', parentId: 'root', childrenIds: ['b'] })
  const b = createNodeFixture({ id: 'b', parentId: 'a', childrenIds: [] })
  const a2 = createNodeFixture({ id: 'a2', parentId: 'root', childrenIds: ['b2'] })
  const b2 = createNodeFixture({ id: 'b2', parentId: 'a2', childrenIds: [] })
  return new Map([
    ['root', root],
    ['a', a],
    ['b', b],
    ['a2', a2],
    ['b2', b2],
  ])
}

describe('activePathIds', () => {
  it('returns null when nothing is selected', () => {
    expect(activePathIds(buildTree(), null)).toBeNull()
  })

  it('returns the root->selected chain as a Set, excluding siblings', () => {
    const set = activePathIds(buildTree(), 'b')
    expect(set).toBeInstanceOf(Set)
    expect(set && [...set].sort()).toEqual(['a', 'b', 'root'])
    expect(set?.has('a2')).toBe(false)
    expect(set?.has('b2')).toBe(false)
  })

  it('returns an empty Set when the id is missing', () => {
    const set = activePathIds(buildTree(), 'nope')
    expect(set).toBeInstanceOf(Set)
    expect(set?.size).toBe(0)
  })
})

describe('edgeAppearance', () => {
  it('marks on-path edges active + animated', () => {
    const set = activePathIds(buildTree(), 'b')!
    expect(edgeAppearance('a', 'b', set)).toEqual({ style: ACTIVE_EDGE_STYLE, animated: true })
  })

  it('marks off-path edges inactive and not animated', () => {
    const set = activePathIds(buildTree(), 'b')!
    expect(edgeAppearance('root', 'a2', set)).toEqual({
      style: INACTIVE_EDGE_STYLE,
      animated: false,
    })
  })

  it('uses the base style when there is no active path', () => {
    expect(edgeAppearance('a', 'b', null)).toEqual({ style: BASE_EDGE_STYLE, animated: false })
    expect(edgeAppearance('root', 'a2', null)).toEqual({
      style: BASE_EDGE_STYLE,
      animated: false,
    })
  })
})

describe('pillDimClassName', () => {
  it('returns undefined for on-path nodes', () => {
    const set = activePathIds(buildTree(), 'b')!
    expect(pillDimClassName('b', set)).toBeUndefined()
  })

  it('returns the dim class for off-path nodes', () => {
    const set = activePathIds(buildTree(), 'b')!
    expect(pillDimClassName('b2', set)).toBe('opacity-70 saturate-50 transition-opacity')
  })

  it('returns undefined when there is no active path', () => {
    expect(pillDimClassName('b2', null)).toBeUndefined()
  })
})
