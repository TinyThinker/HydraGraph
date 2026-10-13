import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useReportStore } from './useReportStore'
import { useTreeStore } from './useTreeStore'
import type { TurnNode } from '../types'

vi.mock('../lib/streamingClient', () => ({ streamLLMResponse: vi.fn() }))

function turn(id: string, parentId: string | null, childrenIds: string[] = []): TurnNode {
  return {
    id, treeId: 't', parentId, childrenIds, userPrompt: id, assistantResponse: '',
    positionX: 0, positionY: 0, isCollapsed: false, status: 'idle', modelUsed: 'm', timestamp: 0,
  }
}

// r → a → (b1, b2)
const nodes = new Map(
  [turn('r', null, ['a']), turn('a', 'r', ['b1', 'b2']), turn('b1', 'a'), turn('b2', 'a')].map((n) => [n.id, n]),
)

describe('useReportStore selection', () => {
  beforeEach(() => {
    useTreeStore.setState({ nodes })
    useReportStore.setState({ selecting: false, leafIds: [], includedIds: new Set() })
  })

  it('ticking two leaves with a shared trunk includes the union of their paths', () => {
    const { startSelecting, toggle } = useReportStore.getState()
    startSelecting()
    toggle('b1')
    toggle('b2')
    const s = useReportStore.getState()
    expect(s.leafIds).toEqual(['b1', 'b2'])
    expect([...s.includedIds].sort()).toEqual(['a', 'b1', 'b2', 'r'])
  })

  it('toggling a leaf again removes it and its unshared path', () => {
    const { toggle } = useReportStore.getState()
    toggle('b1')
    toggle('b2')
    toggle('b2')
    expect([...useReportStore.getState().includedIds].sort()).toEqual(['a', 'b1', 'r'])
  })

  it('returns new references on every toggle (immutable updates)', () => {
    const before = useReportStore.getState()
    before.toggle('b1')
    const after = useReportStore.getState()
    expect(after.leafIds).not.toBe(before.leafIds)
    expect(after.includedIds).not.toBe(before.includedIds)
  })

  it('startSelecting can pre-tick leaves; clear and stop reset', () => {
    useReportStore.getState().startSelecting(['b2'])
    expect(useReportStore.getState()).toMatchObject({ selecting: true, leafIds: ['b2'] })
    useReportStore.getState().clear()
    expect(useReportStore.getState().includedIds.size).toBe(0)
    useReportStore.getState().stopSelecting()
    expect(useReportStore.getState().selecting).toBe(false)
  })
})
