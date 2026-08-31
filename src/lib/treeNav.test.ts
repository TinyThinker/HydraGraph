import { describe, it, expect, beforeEach } from 'vitest'
import { resolveNavTarget, isTypingTarget } from './treeNav'
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

describe('resolveNavTarget', () => {
  let nodes: Map<string, TurnNode>

  beforeEach(() => {
    // Build: root 'r' with children [a, b, c]; 'a' with child 'a1'
    nodes = new Map([
      [
        'r',
        createNodeFixture({
          id: 'r',
          parentId: null,
          childrenIds: ['a', 'b', 'c'],
        }),
      ],
      [
        'a',
        createNodeFixture({
          id: 'a',
          parentId: 'r',
          childrenIds: ['a1'],
        }),
      ],
      [
        'a1',
        createNodeFixture({
          id: 'a1',
          parentId: 'a',
          childrenIds: [],
        }),
      ],
      [
        'b',
        createNodeFixture({
          id: 'b',
          parentId: 'r',
          childrenIds: [],
        }),
      ],
      [
        'c',
        createNodeFixture({
          id: 'c',
          parentId: 'r',
          childrenIds: [],
        }),
      ],
    ])
  })

  it('parent navigation: a1 -> a, a -> r, r -> null', () => {
    expect(resolveNavTarget('a1', 'parent', nodes)).toBe('a')
    expect(resolveNavTarget('a', 'parent', nodes)).toBe('r')
    expect(resolveNavTarget('r', 'parent', nodes)).toBe(null)
  })

  it('child navigation: r -> a (first child), a1 -> null (no children)', () => {
    expect(resolveNavTarget('r', 'child', nodes)).toBe('a')
    expect(resolveNavTarget('a1', 'child', nodes)).toBe(null)
  })

  it('next sibling: a -> b, b -> c, c -> null', () => {
    expect(resolveNavTarget('a', 'next', nodes)).toBe('b')
    expect(resolveNavTarget('b', 'next', nodes)).toBe('c')
    expect(resolveNavTarget('c', 'next', nodes)).toBe(null)
  })

  it('prev sibling: b -> a, a -> null, c -> b', () => {
    expect(resolveNavTarget('b', 'prev', nodes)).toBe('a')
    expect(resolveNavTarget('a', 'prev', nodes)).toBe(null)
    expect(resolveNavTarget('c', 'prev', nodes)).toBe('b')
  })

  it('root has no siblings: r prev/next -> null', () => {
    expect(resolveNavTarget('r', 'prev', nodes)).toBe(null)
    expect(resolveNavTarget('r', 'next', nodes)).toBe(null)
  })

  it('null or missing current: null -> null, missing-id -> null', () => {
    expect(resolveNavTarget(null, 'parent', nodes)).toBe(null)
    expect(resolveNavTarget('missing-id', 'child', nodes)).toBe(null)
  })
})

describe('isTypingTarget', () => {
  it('textarea returns true', () => {
    const el = document.createElement('textarea')
    expect(isTypingTarget(el)).toBe(true)
  })

  it('input returns true', () => {
    const el = document.createElement('input')
    expect(isTypingTarget(el)).toBe(true)
  })

  it('select returns true', () => {
    const el = document.createElement('select')
    expect(isTypingTarget(el)).toBe(true)
  })

  it('div with contentEditable=true returns true', () => {
    const el = document.createElement('div')
    el.contentEditable = 'true'
    expect(isTypingTarget(el)).toBe(true)
  })

  it('div without contentEditable returns false', () => {
    const el = document.createElement('div')
    expect(isTypingTarget(el)).toBe(false)
  })

  it('null returns false', () => {
    expect(isTypingTarget(null)).toBe(false)
  })
})
