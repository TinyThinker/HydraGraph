import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { SearchBar } from './SearchBar'
import { useTreeStore } from '../store/useTreeStore'
import { useSearchNav } from './useSearchNav'
import { db } from '../db/ChatDatabase'
import type { TurnNode } from '../types'

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
  }
}

describe('SearchBar: T5.5', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()

    useTreeStore.setState({
      nodes: new Map(),
      trees: [],
      activeTreeId: 'tree-test',
      settings: {
        id: 'global_settings',
        ollamaBaseUrl: 'http://localhost:11434',
        defaultModel: 'gemini-2.5-flash',
        provider: 'gemini',
      },
      liveText: new Map(),
    })

    useSearchNav.setState({ targetId: null, nonce: 0 })
  })

  it('typing a term in assistantResponse shows one result with promptLabel and snippet', async () => {
    const nodeId = crypto.randomUUID()
    const node = createNode({
      id: nodeId,
      treeId: 'tree-test',
      userPrompt: 'What is machine learning?',
      assistantResponse: 'Machine learning is a type of artificial intelligence that processes data',
    })

    useTreeStore.setState({
      nodes: new Map([[nodeId, node]]),
      activeTreeId: 'tree-test',
    })

    render(<SearchBar />)

    const input = screen.getByPlaceholderText('Search this tree…') as HTMLInputElement
    await act(async () => {
      fireEvent.change(input, { target: { value: 'machine' } })
    })

    const results = screen.queryAllByRole('button')
    expect(results).toHaveLength(1)
    expect(results[0]).toHaveTextContent('What is machine learning?')
    expect(results[0]).toHaveTextContent('Machine learning is')
  })

  it('typing a term that matches NO node shows "No matches" message and zero buttons', async () => {
    const nodeId = crypto.randomUUID()
    const node = createNode({
      id: nodeId,
      userPrompt: 'Hello world',
      assistantResponse: 'Hi there',
    })

    useTreeStore.setState({
      nodes: new Map([[nodeId, node]]),
      activeTreeId: 'tree-test',
    })

    render(<SearchBar />)

    const input = screen.getByPlaceholderText('Search this tree…') as HTMLInputElement
    await act(async () => {
      fireEvent.change(input, { target: { value: 'xenophobia' } })
    })

    expect(screen.getByText('No matches in this tree.')).toBeInTheDocument()
    const buttons = screen.queryAllByRole('button')
    expect(buttons).toHaveLength(0)
  })

  it('a node with different treeId is never returned', async () => {
    const node1 = createNode({
      id: crypto.randomUUID(),
      treeId: 'tree-test',
      userPrompt: 'Test',
      assistantResponse: 'Response',
    })

    const node2 = createNode({
      id: crypto.randomUUID(),
      treeId: 'tree-other',
      userPrompt: 'Other tree',
      assistantResponse: 'Response with test keyword',
    })

    useTreeStore.setState({
      nodes: new Map([
        [node1.id, node1],
        [node2.id, node2],
      ]),
      activeTreeId: 'tree-test',
    })

    render(<SearchBar />)

    const input = screen.getByPlaceholderText('Search this tree…') as HTMLInputElement
    await act(async () => {
      fireEvent.change(input, { target: { value: 'test' } })
    })

    const results = screen.queryAllByRole('button')
    expect(results).toHaveLength(1)
    expect(results[0]).toHaveTextContent('Test')
  })

  it('query shorter than 2 chars yields no dropdown', async () => {
    const nodeId = crypto.randomUUID()
    const node = createNode({
      id: nodeId,
      userPrompt: 'Hello',
      assistantResponse: 'World',
    })

    useTreeStore.setState({
      nodes: new Map([[nodeId, node]]),
      activeTreeId: 'tree-test',
    })

    render(<SearchBar />)

    const input = screen.getByPlaceholderText('Search this tree…') as HTMLInputElement
    await act(async () => {
      fireEvent.change(input, { target: { value: 'a' } })
    })

    expect(screen.queryByText('No matches in this tree.')).not.toBeInTheDocument()
    const buttons = screen.queryAllByRole('button')
    expect(buttons).toHaveLength(0)
  })

  it('selecting result with collapsed ancestors auto-expands them', async () => {
    const rootId = crypto.randomUUID()
    const childId = crypto.randomUUID()
    const targetId = crypto.randomUUID()

    const root = createNode({
      id: rootId,
      treeId: 'tree-test',
      parentId: null,
      childrenIds: [childId],
      isCollapsed: false,
      userPrompt: 'Root',
      assistantResponse: '',
    })

    const child = createNode({
      id: childId,
      treeId: 'tree-test',
      parentId: rootId,
      childrenIds: [targetId],
      isCollapsed: true,
      userPrompt: 'Child',
      assistantResponse: '',
    })

    const target = createNode({
      id: targetId,
      treeId: 'tree-test',
      parentId: childId,
      childrenIds: [],
      isCollapsed: false,
      userPrompt: 'Target node',
      assistantResponse: 'This is the target with keyword search',
    })

    useTreeStore.setState({
      nodes: new Map([
        [rootId, root],
        [childId, child],
        [targetId, target],
      ]),
      activeTreeId: 'tree-test',
    })

    render(<SearchBar />)

    const input = screen.getByPlaceholderText('Search this tree…') as HTMLInputElement
    await act(async () => {
      fireEvent.change(input, { target: { value: 'keyword' } })
    })

    const buttons = screen.queryAllByRole('button')
    expect(buttons).toHaveLength(1)

    await act(async () => {
      fireEvent.click(buttons[0])
    })

    await new Promise((r) => setTimeout(r, 50))

    const nodes = useTreeStore.getState().nodes
    expect(nodes.get(childId)?.isCollapsed).toBe(false)

    const nav = useSearchNav.getState()
    expect(nav.targetId).toBe(targetId)
    expect(nav.nonce).toBeGreaterThan(0)
  })
})
