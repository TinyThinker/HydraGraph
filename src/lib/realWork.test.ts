import { describe, it, expect } from 'vitest'
import { countCompletedTurns, hasRealWork, REAL_WORK_TURNS } from './realWork'
import { DEMO_TREE_ID } from './demoTree'
import type { ConversationTree, TurnNode } from '../types'

function node(overrides: Partial<TurnNode>): TurnNode {
  return {
    id: 'x', treeId: 't', parentId: null, childrenIds: [], userPrompt: 'q',
    assistantResponse: 'a', positionX: 0, positionY: 0, isCollapsed: false,
    status: 'idle', modelUsed: 'm', timestamp: 0, ...overrides,
  }
}

function tree(id: string): ConversationTree {
  return { id, title: 'T', rootNodeId: 'r', defaultSystemPrompt: '', createdAt: 0, updatedAt: 0 }
}

function turns(n: number, treeId = 't'): TurnNode[] {
  return Array.from({ length: n }, (_, i) => node({ id: `n${i}`, treeId }))
}

describe('countCompletedTurns', () => {
  it('counts idle turns with a response in the given tree only', () => {
    const nodes = [
      node({ id: 'a' }),
      node({ id: 'b' }),
      node({ id: 'c', status: 'streaming' }),
      node({ id: 'd', status: 'error' }),
      node({ id: 'e', assistantResponse: '   ' }),
      node({ id: 'f', treeId: 'other' }),
    ]
    expect(countCompletedTurns(nodes, 't')).toBe(2)
  })
})

describe('hasRealWork', () => {
  it('is false below the threshold and true at it', () => {
    expect(hasRealWork(tree('t'), turns(REAL_WORK_TURNS.persist - 1))).toBe(false)
    expect(hasRealWork(tree('t'), turns(REAL_WORK_TURNS.persist))).toBe(true)
  })

  it('takes a custom threshold', () => {
    expect(hasRealWork(tree('t'), turns(5), REAL_WORK_TURNS.nudge)).toBe(false)
    expect(hasRealWork(tree('t'), turns(6), REAL_WORK_TURNS.nudge)).toBe(true)
  })

  it('is false for the demo tree and for no tree', () => {
    expect(hasRealWork(tree(DEMO_TREE_ID), turns(20, DEMO_TREE_ID))).toBe(false)
    expect(hasRealWork(undefined, turns(20))).toBe(false)
  })
})
