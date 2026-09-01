import { describe, it, expect } from 'vitest'
import { layoutTree, computeChildPosition } from './autoLayout'
import { NODE_WIDTH, NODE_HEIGHT } from './nodeDimensions'
import type { TurnNode } from '../types'

let seq = 0
function createNode(overrides: Partial<TurnNode>): TurnNode {
  return {
    id: 'node-' + seq++,
    treeId: 'tree-1',
    parentId: null,
    childrenIds: [],
    userPrompt: '',
    assistantResponse: '',
    positionX: 0,
    positionY: 0,
    isCollapsed: false,
    status: 'idle',
    modelUsed: 'model',
    timestamp: 0,
    ...overrides,
  }
}

function overlaps(
  aX: number,
  aY: number,
  aW: number,
  aH: number,
  bX: number,
  bY: number,
  bW: number,
  bH: number
): boolean {
  return aX < bX + bW && aX + aW > bX && aY < bY + bH && aY + aH > bY
}

describe('layoutTree', () => {
  it('returns a position for every reachable node with no bounding-box overlaps', () => {
    const nodes = new Map<string, TurnNode>([
      ['a', createNode({ id: 'a', childrenIds: ['b', 'c'], timestamp: 0 })],
      ['b', createNode({ id: 'b', parentId: 'a', childrenIds: ['d'] })],
      ['c', createNode({ id: 'c', parentId: 'a' })],
      ['d', createNode({ id: 'd', parentId: 'b' })],
    ])

    const result = layoutTree(nodes)
    expect(result.size).toBe(4)
    for (const id of ['a', 'b', 'c', 'd']) expect(result.has(id)).toBe(true)

    const ids = ['a', 'b', 'c', 'd']
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const p1 = result.get(ids[i])!
        const p2 = result.get(ids[j])!
        expect(
          overlaps(p1.x, p1.y, NODE_WIDTH, NODE_HEIGHT, p2.x, p2.y, NODE_WIDTH, NODE_HEIGHT),
        ).toBe(false)
      }
    }
  })

  it('positions children strictly below their parents', () => {
    const nodes = new Map<string, TurnNode>([
      ['a', createNode({ id: 'a', childrenIds: ['b'], timestamp: 0 })],
      ['b', createNode({ id: 'b', parentId: 'a', childrenIds: ['d'] })],
      ['d', createNode({ id: 'd', parentId: 'b' })],
    ])

    const result = layoutTree(nodes)
    expect(result.get('b')!.y).toBeGreaterThan(result.get('a')!.y)
    expect(result.get('d')!.y).toBeGreaterThan(result.get('b')!.y)
  })

  it('is deterministic: two calls on the same map are deeply equal', () => {
    const nodes = new Map<string, TurnNode>([
      ['a', createNode({ id: 'a', childrenIds: ['b', 'c'], timestamp: 0 })],
      ['b', createNode({ id: 'b', parentId: 'a' })],
      ['c', createNode({ id: 'c', parentId: 'a' })],
    ])

    const first = layoutTree(nodes)
    const second = layoutTree(nodes)
    expect([...second.entries()]).toEqual([...first.entries()])
  })

  it('normalizes the layout so min x and min y are exactly 40', () => {
    const nodes = new Map<string, TurnNode>([
      ['a', createNode({ id: 'a', childrenIds: ['b', 'c'], timestamp: 0 })],
      ['b', createNode({ id: 'b', parentId: 'a' })],
      ['c', createNode({ id: 'c', parentId: 'a' })],
    ])

    const result = layoutTree(nodes)
    const xs = [...result.values()].map((p) => p.x)
    const ys = [...result.values()].map((p) => p.y)
    expect(Math.min(...xs)).toBe(40)
    expect(Math.min(...ys)).toBe(40)
  })

  it('does not throw on a broken parent pointer', () => {
    const nodes = new Map<string, TurnNode>([
      ['a', createNode({ id: 'a', childrenIds: ['b', 'ghost'], timestamp: 0 })],
      ['b', createNode({ id: 'b', parentId: 'a' })],
    ])

    let result: Map<string, { x: number; y: number }> | undefined
    expect(() => {
      result = layoutTree(nodes)
    }).not.toThrow()
    expect(result!.has('a')).toBe(true)
    expect(result!.has('b')).toBe(true)
  })

  it('does not throw on a cycle', () => {
    const nodes = new Map<string, TurnNode>([
      ['a', createNode({ id: 'a', childrenIds: ['b'], timestamp: 0 })],
      ['b', createNode({ id: 'b', parentId: 'a', childrenIds: ['a'] })],
    ])

    expect(() => layoutTree(nodes)).not.toThrow()
  })

  it('returns an empty Map when there is no root', () => {
    const nodes = new Map<string, TurnNode>([
      ['a', createNode({ id: 'a', parentId: 'b' })],
      ['b', createNode({ id: 'b', parentId: 'a' })],
    ])

    expect(layoutTree(nodes).size).toBe(0)
  })
})

describe('computeChildPosition', () => {
  it('returns a spot below the parent when siblings already exist', () => {
    const nodes = new Map<string, TurnNode>([
      ['a', createNode({ id: 'a', childrenIds: ['b', 'c'], timestamp: 0 })],
      ['b', createNode({ id: 'b', parentId: 'a' })],
      ['c', createNode({ id: 'c', parentId: 'a' })],
    ])

    const parentPos = layoutTree(nodes).get('a')!
    const newPos = computeChildPosition('a', nodes)
    expect(newPos.y).toBeGreaterThan(parentPos.y)
  })

  it('returns {x: 0, y: 0} when parentId is not in the map', () => {
    const nodes = new Map<string, TurnNode>([['a', createNode({ id: 'a' })]])
    expect(computeChildPosition('nonexistent', nodes)).toEqual({ x: 0, y: 0 })
  })

  it('does not throw on an empty map', () => {
    expect(() => computeChildPosition('missing-parent', new Map())).not.toThrow()
  })
})
