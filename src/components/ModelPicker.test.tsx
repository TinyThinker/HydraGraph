import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from 'react'
import { ModelPicker } from './ModelPicker'
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

describe('ModelPicker', () => {
  beforeEach(async () => {
    // Reset database
    await db.delete()
    await db.open()

    // Reset stores
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
  })

  it('lists the provider\'s models and persists the pick', async () => {
    const nodeData = createNode({
      id: 'n1',
      treeId: 'tree-test',
      parentId: null,
      modelUsed: 'gemini-2.5-flash',
      provider: 'gemini',
    })

    // Add node to store AND database
    useTreeStore.setState({
      nodes: new Map([['n1', nodeData]]),
    })
    await db.nodes.add(nodeData)

    const onCloseSpy = vi.fn()

    render(
      <ModelPicker node={nodeData as any} onClose={onCloseSpy} />
    )

    // Assert gemini models are present
    expect(screen.getByText('gemini-2.5-pro')).toBeInTheDocument()
    expect(screen.getByText('gemini-2.5-flash')).toBeInTheDocument()
    expect(screen.getByText('gemini-2.0-flash')).toBeInTheDocument()

    // Assert ollama models are NOT present
    expect(screen.queryByText('mistral')).not.toBeInTheDocument()
    expect(screen.queryByText('llama3.1')).not.toBeInTheDocument()

    // Click gemini-2.5-pro
    const proButton = screen.getByText('gemini-2.5-pro')
    await act(async () => {
      fireEvent.click(proButton)
    })

    // Wait for async update
    await waitFor(() => {
      expect(onCloseSpy).toHaveBeenCalled()
    })

    // Assert node.modelUsed was updated in memory
    expect(useTreeStore.getState().nodes.get('n1')!.modelUsed).toBe('gemini-2.5-pro')

    // Assert node.modelUsed was updated in DB
    const dbNode = await db.nodes.get('n1')
    expect(dbNode!.modelUsed).toBe('gemini-2.5-pro')
  })

  it('free-text entry persists an arbitrary model', async () => {
    const nodeData = createNode({
      id: 'n2',
      treeId: 'tree-test',
      parentId: null,
      modelUsed: 'gemini-2.5-flash',
      provider: 'gemini',
    })

    useTreeStore.setState({
      nodes: new Map([['n2', nodeData]]),
    })
    await db.nodes.add(nodeData)

    const onCloseSpy = vi.fn()

    render(
      <ModelPicker node={nodeData as any} onClose={onCloseSpy} />
    )

    // Type into custom input
    const customInput = screen.getByPlaceholderText('Custom model name…') as HTMLInputElement
    await act(async () => {
      fireEvent.change(customInput, { target: { value: 'my/custom-model' } })
    })

    // Click Set button
    const setButton = screen.getByRole('button', { name: 'Set' })
    await act(async () => {
      fireEvent.click(setButton)
    })

    // Wait for async update
    await waitFor(() => {
      expect(onCloseSpy).toHaveBeenCalled()
    })

    // Assert custom model was persisted
    expect(useTreeStore.getState().nodes.get('n2')!.modelUsed).toBe('my/custom-model')

    // Assert DB was updated
    const dbNode = await db.nodes.get('n2')
    expect(dbNode!.modelUsed).toBe('my/custom-model')
  })

  it('free-text input responds to Enter key', async () => {
    const nodeData = createNode({
      id: 'n3',
      treeId: 'tree-test',
      parentId: null,
      modelUsed: 'gemini-2.5-flash',
      provider: 'gemini',
    })

    useTreeStore.setState({
      nodes: new Map([['n3', nodeData]]),
    })
    await db.nodes.add(nodeData)

    const onCloseSpy = vi.fn()

    render(
      <ModelPicker node={nodeData as any} onClose={onCloseSpy} />
    )

    // Type and press Enter
    const customInput = screen.getByPlaceholderText('Custom model name…') as HTMLInputElement
    await act(async () => {
      fireEvent.change(customInput, { target: { value: 'enter-test-model' } })
      fireEvent.keyDown(customInput, { key: 'Enter', code: 'Enter' })
    })

    // Wait for async update
    await waitFor(() => {
      expect(onCloseSpy).toHaveBeenCalled()
    })

    // Assert model was persisted
    expect(useTreeStore.getState().nodes.get('n3')!.modelUsed).toBe('enter-test-model')
  })

  it('uses node.provider over settings.provider', async () => {
    // Settings say gemini, but node says ollama
    const nodeData = createNode({
      id: 'n4',
      treeId: 'tree-test',
      parentId: null,
      modelUsed: 'llama3.1',
      provider: 'ollama', // Explicitly override
    })

    useTreeStore.setState({
      nodes: new Map([['n4', nodeData]]),
      settings: {
        id: 'global_settings',
        ollamaBaseUrl: 'http://localhost:11434',
        defaultModel: 'gemini-2.5-flash',
        provider: 'gemini', // Settings say gemini
      },
    })
    await db.nodes.add(nodeData)

    const onCloseSpy = vi.fn()

    render(
      <ModelPicker node={nodeData as any} onClose={onCloseSpy} />
    )

    // Assert ollama models are present
    expect(screen.getByText('llama3.1')).toBeInTheDocument()
    expect(screen.getByText('mistral')).toBeInTheDocument()

    // Assert gemini models are NOT present
    expect(screen.queryByText('gemini-2.5-pro')).not.toBeInTheDocument()

    // Assert provider text shows ollama
    expect(screen.getByText('Provider: ollama')).toBeInTheDocument()
  })

  it('the current modelUsed always appears even if not curated', async () => {
    const nodeData = createNode({
      id: 'n5',
      treeId: 'tree-test',
      parentId: null,
      modelUsed: 'some-exotic-model',
      provider: 'gemini',
    })

    useTreeStore.setState({
      nodes: new Map([['n5', nodeData]]),
    })
    await db.nodes.add(nodeData)

    const onCloseSpy = vi.fn()

    render(
      <ModelPicker node={nodeData as any} onClose={onCloseSpy} />
    )

    // Assert exotic model appears in the list
    expect(screen.getByText('some-exotic-model')).toBeInTheDocument()

    // Assert curated gemini models are also there
    expect(screen.getByText('gemini-2.5-flash')).toBeInTheDocument()
  })

  it('Cancel button closes the picker', async () => {
    const nodeData = createNode({
      id: 'n6',
      treeId: 'tree-test',
      parentId: null,
      modelUsed: 'gemini-2.5-flash',
      provider: 'gemini',
    })

    useTreeStore.setState({
      nodes: new Map([['n6', nodeData]]),
    })

    const onCloseSpy = vi.fn()

    render(
      <ModelPicker node={nodeData as any} onClose={onCloseSpy} />
    )

    // Click Cancel
    const cancelButton = screen.getByRole('button', { name: 'Cancel' })
    await act(async () => {
      fireEvent.click(cancelButton)
    })

    // Assert onClose was called
    expect(onCloseSpy).toHaveBeenCalled()
  })

  it('Set button is disabled when custom input is empty', async () => {
    const nodeData = createNode({
      id: 'n7',
      treeId: 'tree-test',
      parentId: null,
      modelUsed: 'gemini-2.5-flash',
      provider: 'gemini',
    })

    useTreeStore.setState({
      nodes: new Map([['n7', nodeData]]),
    })

    const onCloseSpy = vi.fn()

    render(
      <ModelPicker node={nodeData as any} onClose={onCloseSpy} />
    )

    // Assert Set button is disabled initially (custom input is empty)
    const setButton = screen.getByRole('button', { name: 'Set' })
    expect(setButton).toBeDisabled()

    // Type something
    const customInput = screen.getByPlaceholderText('Custom model name…') as HTMLInputElement
    await act(async () => {
      fireEvent.change(customInput, { target: { value: 'new-model' } })
    })

    // Assert Set button is now enabled
    expect(setButton).not.toBeDisabled()
  })
})
