import { describe, it, expect } from 'vitest'
import { layoutTree, computeChildPosition } from './autoLayout'
import type { TurnNode } from '../types'

function createNode(overrides: Partial<TurnNode>): TurnNode {
  return {
    id: 'node-' + Math.random(),
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
    timestamp: Date.now(),
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
  it('returns positions for every node with no overlaps', () => {
    const nodeA = createNode({ id: 'a' })
    const nodeB = createNode({ id: 'b', parentId: 'a' })
    const nodeC = createNode({ id: 'c', parentId: 'a' })
    const nodeD = createNode({ id: 'd', parentId: 'b' })

    const nodes = new Map<string, TurnNode>([
      ['a', nodeA],
      ['b', nodeB],
      ['c', nodeC],
      ['d', nodeD],
    ])

    const result = layoutTree(nodes)

    expect(result.size).toBe(4)
    expect(result.has('a')).toBe(true)
    expect(result.has('b')).toBe(true)
    expect(result.has('c')).toBe(true)
    expect(result.has('d')).toBe(true)

    const boxA = { ...result.get('a')!, w: 320, h: 240 }
    const boxB = { ...result.get('b')!, w: 320, h: 240 }
    const boxC = { ...result.get('c')!, w: 320, h: 240 }
    const boxD = { ...result.get('d')!, w: 320, h: 240 }

    const checkOverlap = [
      [boxA, boxB],
      [boxA, boxC],
      [boxA, boxD],
      [boxB, boxC],
      [boxB, boxD],
      [boxC, boxD],
    ]

    for (const [box1, box2] of checkOverlap) {
      const hasOverlap = overlaps(box1.x, box1.y, box1.w, box1.h, box2.x, box2.y, box2.w, box2.h)
      expect(hasOverlap).toBe(false)
    }
  })

  it('positions children below their parents (TB layout)', () => {
    const nodeA = createNode({ id: 'a' })
    const nodeB = createNode({ id: 'b', parentId: 'a' })
    const nodeD = createNode({ id: 'd', parentId: 'b' })

    const nodes = new Map<string, TurnNode>([
      ['a', nodeA],
      ['b', nodeB],
      ['d', nodeD],
    ])

    const result = layoutTree(nodes)

    const posA = result.get('a')!
    const posB = result.get('b')!
    const posD = result.get('d')!

    expect(posB.y).toBeGreaterThan(posA.y)
    expect(posD.y).toBeGreaterThan(posB.y)
  })
})

describe('computeChildPosition', () => {
  it('returns a position below parent when parent has existing siblings', () => {
    const nodeA = createNode({ id: 'a' })
    const nodeB = createNode({ id: 'b', parentId: 'a' })
    const nodeC = createNode({ id: 'c', parentId: 'a' })

    const nodes = new Map<string, TurnNode>([
      ['a', nodeA],
      ['b', nodeB],
      ['c', nodeC],
    ])

    const parentPos = layoutTree(nodes).get('a')!
    const newPos = computeChildPosition('a', nodes)

    // New position should be below the parent (TB layout)
    expect(newPos.y).toBeGreaterThan(parentPos.y)
  })

  it('returns {x: 0, y: 0} when parentId is not in the map', () => {
    const nodeA = createNode({ id: 'a' })
    const nodes = new Map<string, TurnNode>([['a', nodeA]])

    const result = computeChildPosition('nonexistent', nodes)

    expect(result).toEqual({ x: 0, y: 0 })
  })

  it('does not throw on missing parent', () => {
    const nodes = new Map<string, TurnNode>()

    expect(() => {
      computeChildPosition('missing-parent', nodes)
    }).not.toThrow()
  })
})
