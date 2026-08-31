import { describe, it, expect } from 'vitest'
import { resolveContextPayload } from './contextEngine'
import type { TurnNode } from '../types'

// Helper factory to create a TurnNode with sensible defaults
function createNode(overrides: Partial<TurnNode>): TurnNode {
  const id = overrides.id ?? 'node-default'
  return {
    id,
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
    timestamp: overrides.timestamp ?? 0,
    systemPromptOverride: overrides.systemPromptOverride,
  }
}

describe('resolveContextPayload', () => {
  const DEFAULT_PROMPT = 'You are a helpful assistant.'

  it('1. lone root node with userPrompt, empty assistantResponse', () => {
    const root = createNode({
      id: 'root',
      userPrompt: 'Hello, assistant',
      assistantResponse: '',
    })
    const nodeMap = new Map<string, TurnNode>([['root', root]])

    const result = resolveContextPayload('root', nodeMap, DEFAULT_PROMPT)

    expect(result.systemPrompt).toBe(DEFAULT_PROMPT)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]).toEqual({
      role: 'user',
      content: 'Hello, assistant',
    })
  })

  it('2. three-node chain root -> mid -> leaf, messages in order, target is leaf', () => {
    const root = createNode({
      id: 'root',
      userPrompt: 'Question 1',
      assistantResponse: 'Answer 1',
    })
    const mid = createNode({
      id: 'mid',
      parentId: 'root',
      userPrompt: 'Question 2',
      assistantResponse: 'Answer 2',
    })
    const leaf = createNode({
      id: 'leaf',
      parentId: 'mid',
      userPrompt: 'Question 3',
      assistantResponse: '',
    })
    const nodeMap = new Map<string, TurnNode>([
      ['root', root],
      ['mid', mid],
      ['leaf', leaf],
    ])

    const result = resolveContextPayload('leaf', nodeMap, DEFAULT_PROMPT)

    expect(result.messages).toHaveLength(5)
    expect(result.messages[0]).toEqual({ role: 'user', content: 'Question 1' })
    expect(result.messages[1]).toEqual({
      role: 'assistant',
      content: 'Answer 1',
    })
    expect(result.messages[2]).toEqual({ role: 'user', content: 'Question 2' })
    expect(result.messages[3]).toEqual({
      role: 'assistant',
      content: 'Answer 2',
    })
    expect(result.messages[4]).toEqual({ role: 'user', content: 'Question 3' })
  })

  it('3. target node with stored assistantResponse is excluded from messages', () => {
    const root = createNode({
      id: 'root',
      userPrompt: 'Question 1',
      assistantResponse: 'Answer 1',
    })
    const mid = createNode({
      id: 'mid',
      parentId: 'root',
      userPrompt: 'Question 2',
      assistantResponse: 'Answer 2',
    })
    const leaf = createNode({
      id: 'leaf',
      parentId: 'mid',
      userPrompt: 'Question 3',
      assistantResponse: 'Answer 3 (should not appear)',
    })
    const nodeMap = new Map<string, TurnNode>([
      ['root', root],
      ['mid', mid],
      ['leaf', leaf],
    ])

    const result = resolveContextPayload('leaf', nodeMap, DEFAULT_PROMPT)

    expect(result.messages).toHaveLength(5)
    const contents = result.messages.map((m) => m.content)
    expect(contents).not.toContain('Answer 3 (should not appear)')
  })

  it('4. sibling isolation: parent with two children, target is A, B is not included', () => {
    const parent = createNode({
      id: 'parent',
      userPrompt: 'Parent question',
      assistantResponse: 'Parent answer',
    })
    const childA = createNode({
      id: 'childA',
      parentId: 'parent',
      userPrompt: 'Child A question',
      assistantResponse: '',
    })
    const childB = createNode({
      id: 'childB',
      parentId: 'parent',
      userPrompt: 'Child B distinctive question',
      assistantResponse: 'Child B distinctive answer',
    })
    const nodeMap = new Map<string, TurnNode>([
      ['parent', parent],
      ['childA', childA],
      ['childB', childB],
    ])

    const result = resolveContextPayload('childA', nodeMap, DEFAULT_PROMPT)

    const contents = result.messages.map((m) => m.content)
    expect(contents).not.toContain('Child B distinctive question')
    expect(contents).not.toContain('Child B distinctive answer')
    expect(result.messages).toHaveLength(3)
    expect(result.messages[0]).toEqual({
      role: 'user',
      content: 'Parent question',
    })
    expect(result.messages[1]).toEqual({
      role: 'assistant',
      content: 'Parent answer',
    })
    expect(result.messages[2]).toEqual({
      role: 'user',
      content: 'Child A question',
    })
  })

  it('5. no systemPromptOverride anywhere, uses default', () => {
    const root = createNode({
      id: 'root',
      userPrompt: 'Hello',
      assistantResponse: '',
    })
    const mid = createNode({
      id: 'mid',
      parentId: 'root',
      userPrompt: 'Hi',
      assistantResponse: '',
    })
    const nodeMap = new Map<string, TurnNode>([
      ['root', root],
      ['mid', mid],
    ])

    const result = resolveContextPayload('mid', nodeMap, DEFAULT_PROMPT)

    expect(result.systemPrompt).toBe(DEFAULT_PROMPT)
  })

  it('6. root has systemPromptOverride, uses it', () => {
    const root = createNode({
      id: 'root',
      userPrompt: 'Hello',
      assistantResponse: '',
      systemPromptOverride: 'Custom system prompt from root',
    })
    const mid = createNode({
      id: 'mid',
      parentId: 'root',
      userPrompt: 'Hi',
      assistantResponse: '',
    })
    const nodeMap = new Map<string, TurnNode>([
      ['root', root],
      ['mid', mid],
    ])

    const result = resolveContextPayload('mid', nodeMap, DEFAULT_PROMPT)

    expect(result.systemPrompt).toBe('Custom system prompt from root')
  })

  it('7. root and mid have different overrides, mid wins (nearest to target)', () => {
    const root = createNode({
      id: 'root',
      userPrompt: 'Hello',
      assistantResponse: '',
      systemPromptOverride: 'Root override',
    })
    const mid = createNode({
      id: 'mid',
      parentId: 'root',
      userPrompt: 'Hi',
      assistantResponse: '',
      systemPromptOverride: 'Mid override (nearer to leaf)',
    })
    const leaf = createNode({
      id: 'leaf',
      parentId: 'mid',
      userPrompt: 'Question',
      assistantResponse: '',
    })
    const nodeMap = new Map<string, TurnNode>([
      ['root', root],
      ['mid', mid],
      ['leaf', leaf],
    ])

    const result = resolveContextPayload('leaf', nodeMap, DEFAULT_PROMPT)

    expect(result.systemPrompt).toBe('Mid override (nearer to leaf)')
  })

  it('8. mid has whitespace override, root has real override, root wins', () => {
    const root = createNode({
      id: 'root',
      userPrompt: 'Hello',
      assistantResponse: '',
      systemPromptOverride: 'Root real override',
    })
    const mid = createNode({
      id: 'mid',
      parentId: 'root',
      userPrompt: 'Hi',
      assistantResponse: '',
      systemPromptOverride: '   ',
    })
    const leaf = createNode({
      id: 'leaf',
      parentId: 'mid',
      userPrompt: 'Question',
      assistantResponse: '',
    })
    const nodeMap = new Map<string, TurnNode>([
      ['root', root],
      ['mid', mid],
      ['leaf', leaf],
    ])

    const result = resolveContextPayload('leaf', nodeMap, DEFAULT_PROMPT)

    expect(result.systemPrompt).toBe('Root real override')
  })

  it('9. parentId points to missing node, does not throw and returns reachable portion', () => {
    const orphan = createNode({
      id: 'orphan',
      parentId: 'non-existent-parent',
      userPrompt: 'Orphan question',
      assistantResponse: '',
    })
    const nodeMap = new Map<string, TurnNode>([['orphan', orphan]])

    expect(() => {
      resolveContextPayload('orphan', nodeMap, DEFAULT_PROMPT)
    }).not.toThrow()

    const result = resolveContextPayload('orphan', nodeMap, DEFAULT_PROMPT)

    expect(result.systemPrompt).toBe(DEFAULT_PROMPT)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0]).toEqual({
      role: 'user',
      content: 'Orphan question',
    })
  })
})
