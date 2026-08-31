import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { SystemPromptEditor } from './SystemPromptEditor'
import { useTreeStore } from '../store/useTreeStore'
import { db } from '../db/ChatDatabase'
import type { TurnNode } from '../types'

vi.mock('../lib/streamingClient', () => ({
  streamLLMResponse: vi.fn(),
}))

// Helper: create a node with sensible defaults
function createNode(overrides: Partial<TurnNode>): TurnNode {
  const id = overrides.id ?? crypto.randomUUID()
  return {
    id,
    treeId: overrides.treeId ?? 'tree-test',
    parentId: overrides.parentId ?? null,
    childrenIds: overrides.childrenIds ?? [],
    userPrompt: overrides.userPrompt ?? '',
    assistantResponse: overrides.assistantResponse ?? '',
    positionX: overrides.positionX ?? 400,
    positionY: overrides.positionY ?? 100,
    isCollapsed: overrides.isCollapsed ?? false,
    status: overrides.status ?? 'idle',
    modelUsed: overrides.modelUsed ?? 'gemini-2.5-flash',
    timestamp: overrides.timestamp ?? Date.now(),
    provider: overrides.provider ?? 'gemini',
    systemPromptOverride: overrides.systemPromptOverride,
    stale: overrides.stale,
  }
}

describe('SystemPromptEditor', () => {
  beforeEach(async () => {
    // Reset database
    await db.delete()
    await db.open()

    // Reset stores
    useTreeStore.setState({
      nodes: new Map(),
      trees: [
        {
          id: 'tree-test',
          title: 'Test Tree',
          rootNodeId: 'r',
          defaultSystemPrompt: 'DEFAULT PERSONA',
          createdAt: 0,
          updatedAt: 0,
        },
      ],
      activeTreeId: 'tree-test',
      settings: {
        id: 'global_settings',
        ollamaBaseUrl: 'http://localhost:11434',
        defaultModel: 'gemini-2.5-flash',
        provider: 'gemini',
      },
      liveText: new Map(),
    })
  })

  it('shows the inherited prompt from an ancestor override', async () => {
    const r = createNode({ id: 'r', parentId: null })
    const a = createNode({
      id: 'a',
      parentId: 'r',
      systemPromptOverride: 'ANCESTOR PERSONA',
    })
    const g = createNode({
      id: 'g',
      parentId: 'a',
    })

    useTreeStore.setState({
      nodes: new Map([
        ['r', r],
        ['a', a],
        ['g', g],
      ]),
    })

    render(<SystemPromptEditor node={g as any} onClose={vi.fn()} />)

    // Assert the inherited prompt is displayed
    expect(screen.getByText('ANCESTOR PERSONA')).toBeInTheDocument()
  })

  it('root inherits the tree default', () => {
    const r = createNode({ id: 'r', parentId: null })

    useTreeStore.setState({
      nodes: new Map([['r', r]]),
    })

    render(<SystemPromptEditor node={r as any} onClose={vi.fn()} />)

    // Assert the tree default prompt is displayed
    expect(screen.getByText('DEFAULT PERSONA')).toBeInTheDocument()
  })

  it('Save writes the override and marks descendants stale without regenerating', async () => {
    const { streamLLMResponse } = await import('../lib/streamingClient')
    vi.mocked(streamLLMResponse).mockClear()

    const r = createNode({ id: 'r', parentId: null, childrenIds: ['a'] })
    const a = createNode({
      id: 'a',
      parentId: 'r',
      assistantResponse: 'old answer',
      childrenIds: ['g'],
    })
    const g = createNode({
      id: 'g',
      parentId: 'a',
      childrenIds: [],
    })

    // Add nodes to database and store
    await db.nodes.bulkAdd([r, a, g])
    useTreeStore.setState({
      nodes: new Map([
        ['r', r],
        ['a', a],
        ['g', g],
      ]),
    })

    const onClose = vi.fn()
    const { container } = render(<SystemPromptEditor node={a as any} onClose={onClose} />)

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()

    // Type into the textarea
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'NEW PERSONA' } })
    })

    // Click Save
    const saveButton = screen.getByRole('button', { name: /^Save$/ })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    // Wait a bit for async operations
    await new Promise((r) => setTimeout(r, 50))

    // Assert override was written
    expect(useTreeStore.getState().nodes.get('a')?.systemPromptOverride).toBe('NEW PERSONA')

    // Assert database was updated
    const dbNode = await db.nodes.get('a')
    expect(dbNode?.systemPromptOverride).toBe('NEW PERSONA')

    // Assert descendant was marked stale
    expect(useTreeStore.getState().nodes.get('g')?.stale).toBe(true)

    // Assert old response is unchanged (no regeneration)
    expect(useTreeStore.getState().nodes.get('a')?.assistantResponse).toBe('old answer')

    // Assert streamLLMResponse was NOT called
    expect(vi.mocked(streamLLMResponse)).not.toHaveBeenCalled()

    // Assert onClose was called
    expect(onClose).toHaveBeenCalled()
  })

  it('Clear override falls back to inheritance', async () => {
    const r = createNode({ id: 'r', parentId: null, childrenIds: ['a'] })
    const a = createNode({
      id: 'a',
      parentId: 'r',
      systemPromptOverride: 'SOMETHING',
      childrenIds: ['g'],
    })
    const g = createNode({
      id: 'g',
      parentId: 'a',
      childrenIds: [],
    })

    // Add nodes to database and store
    await db.nodes.bulkAdd([r, a, g])
    useTreeStore.setState({
      nodes: new Map([
        ['r', r],
        ['a', a],
        ['g', g],
      ]),
    })

    const onClose = vi.fn()
    render(<SystemPromptEditor node={a as any} onClose={onClose} />)

    // Assert Clear override button is present
    const clearButton = screen.getByRole('button', { name: /clear/i })
    expect(clearButton).toBeInTheDocument()

    // Click Clear override
    await act(async () => {
      fireEvent.click(clearButton)
    })

    await new Promise((r) => setTimeout(r, 50))

    // Assert override was cleared
    expect(useTreeStore.getState().nodes.get('a')?.systemPromptOverride).toBeFalsy()

    // Assert database was updated
    const dbNode = await db.nodes.get('a')
    expect(dbNode?.systemPromptOverride).toBeFalsy()

    // Assert descendants marked stale
    expect(useTreeStore.getState().nodes.get('g')?.stale).toBe(true)

    // Assert onClose was called
    expect(onClose).toHaveBeenCalled()
  })

  it('no Clear override control when there is no override', () => {
    const r = createNode({ id: 'r', parentId: null })
    const a = createNode({
      id: 'a',
      parentId: 'r',
      systemPromptOverride: undefined,
    })

    useTreeStore.setState({
      nodes: new Map([
        ['r', r],
        ['a', a],
      ]),
    })

    render(<SystemPromptEditor node={a as any} onClose={vi.fn()} />)

    // Assert Clear override button is NOT present
    const clearButton = screen.queryByRole('button', { name: /clear/i })
    expect(clearButton).not.toBeInTheDocument()
  })

  it('saving whitespace-only draft clears the override', async () => {
    const r = createNode({ id: 'r', parentId: null })
    const a = createNode({
      id: 'a',
      parentId: 'r',
      assistantResponse: 'old answer',
    })

    useTreeStore.setState({
      nodes: new Map([
        ['r', r],
        ['a', a],
      ]),
    })

    const onClose = vi.fn()
    const { container } = render(<SystemPromptEditor node={a as any} onClose={onClose} />)

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement

    // Type whitespace into the textarea
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '   \n\n  ' } })
    })

    // Click Save
    const saveButton = screen.getByRole('button', { name: /^Save$/ })
    await act(async () => {
      fireEvent.click(saveButton)
    })

    await new Promise((r) => setTimeout(r, 50))

    // Assert override was cleared (whitespace trimmed to empty)
    expect(useTreeStore.getState().nodes.get('a')?.systemPromptOverride).toBeFalsy()
  })
})
