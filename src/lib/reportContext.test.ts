import { describe, it, expect } from 'vitest'
import { buildReportPayload, collectReportTurns, reportSourceDigest } from './reportContext'
import type { TurnNode } from '../types'

function turn(id: string, parentId: string | null, childrenIds: string[] = [], extra: Partial<TurnNode> = {}): TurnNode {
  return {
    id,
    treeId: 'tree-1',
    parentId,
    childrenIds,
    userPrompt: `prompt ${id}`,
    assistantResponse: `answer ${id}`,
    positionX: 0,
    positionY: 0,
    isCollapsed: false,
    status: 'idle',
    modelUsed: 'm',
    timestamp: 0,
    ...extra,
  }
}

// r → a → (b1 → c1, b2)
function fixture(): Map<string, TurnNode> {
  const nodes = [
    turn('r', null, ['a']),
    turn('a', 'r', ['b1', 'b2']),
    turn('b1', 'a', ['c1']),
    turn('c1', 'b1'),
    turn('b2', 'a'),
  ]
  return new Map(nodes.map((n) => [n.id, n]))
}

const ids = (turns: TurnNode[]) => turns.map((t) => t.id)

describe('collectReportTurns', () => {
  it('sends a shared trunk once, then each branch in tree order', () => {
    expect(ids(collectReportTurns(['b2', 'c1'], fixture()))).toEqual(['r', 'a', 'b1', 'c1', 'b2'])
  })

  it('a leaf that is an ancestor of another leaf adds no duplicates', () => {
    expect(ids(collectReportTurns(['c1', 'b1', 'a'], fixture()))).toEqual(['r', 'a', 'b1', 'c1'])
  })

  it('skips ids that are not in the tree', () => {
    expect(ids(collectReportTurns(['gone', 'b2'], fixture()))).toEqual(['r', 'a', 'b2'])
  })
})

describe('buildReportPayload', () => {
  it('uses the brief as system prompt and tags turns with their parent', () => {
    const turns = collectReportTurns(['c1', 'b2'], fixture())
    const payload = buildReportPayload(turns, 'Write it up.')
    expect(payload.systemPrompt).toBe('Write it up.')
    expect(payload.messages).toHaveLength(1)
    const text = payload.messages[0].content
    expect(text).toContain('[t1] · start')
    expect(text).toContain('[t2] · continues t1 · branch point (2 branches)')
    expect(text).toContain('[t5] · continues t2')
    expect(text).toContain('User:\nprompt c1')
    expect(text).toContain('Assistant:\nanswer c1')
  })

  it('names a persona override on its own turn', () => {
    const nodes = fixture()
    nodes.set('b2', { ...nodes.get('b2')!, systemPromptOverride: 'You are a skeptic.' })
    const text = buildReportPayload(collectReportTurns(['b2'], nodes), 'x').messages[0].content
    expect(text).toContain('[t3] · continues t2\nPersona: You are a skeptic.')
  })
})

describe('reportSourceDigest', () => {
  it('is stable for the same turns and changes when a response changes', () => {
    const nodes = fixture()
    const before = reportSourceDigest(collectReportTurns(['c1'], nodes))
    expect(reportSourceDigest(collectReportTurns(['c1'], nodes))).toBe(before)
    nodes.set('c1', { ...nodes.get('c1')!, assistantResponse: 'a longer regenerated answer' })
    expect(reportSourceDigest(collectReportTurns(['c1'], nodes))).not.toBe(before)
  })

  it('changes when a source turn is deleted', () => {
    const nodes = fixture()
    const before = reportSourceDigest(collectReportTurns(['c1', 'b2'], nodes))
    nodes.delete('b2')
    expect(reportSourceDigest(collectReportTurns(['c1', 'b2'], nodes))).not.toBe(before)
  })
})
