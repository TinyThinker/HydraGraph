import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { PromptSection } from './PromptSection'
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
    errorMessage: overrides.errorMessage,
  }
}

describe('PromptSection', () => {
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

  it('error status node with prompt renders Edit and Regenerate buttons', async () => {
    const node = createNode({
      id: 'node-1',
      userPrompt: 'hello world',
      assistantResponse: 'some response',
      status: 'error',
      errorMessage: 'something went wrong',
    })

    useTreeStore.setState({
      nodes: new Map([['node-1', node]]),
    })

    render(<PromptSection node={{ ...node }} />)

    // Assert Edit button is present
    const editButton = screen.getByRole('button', { name: /edit/i })
    expect(editButton).toBeInTheDocument()

    // Assert Regenerate button is present
    const regenerateButton = screen.getByRole('button', { name: /regenerate/i })
    expect(regenerateButton).toBeInTheDocument()
  })

  it('streaming status node renders Cancel and NOT Edit or Regenerate', async () => {
    const node = createNode({
      id: 'node-2',
      userPrompt: 'hello world',
      status: 'streaming',
    })

    useTreeStore.setState({
      nodes: new Map([['node-2', node]]),
    })

    render(<PromptSection node={{ ...node }} />)

    // Assert Cancel button is present
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    expect(cancelButton).toBeInTheDocument()

    // Assert Edit button is NOT present
    const editButton = screen.queryByRole('button', { name: /edit/i })
    expect(editButton).not.toBeInTheDocument()

    // Assert Regenerate button is NOT present
    const regenerateButton = screen.queryByRole('button', { name: /regenerate/i })
    expect(regenerateButton).not.toBeInTheDocument()
  })

  it('clicking Edit on idle node with prompt reveals textarea with that prompt', async () => {
    const node = createNode({
      id: 'node-3',
      userPrompt: 'hello world',
      status: 'idle',
    })

    useTreeStore.setState({
      nodes: new Map([['node-3', node]]),
    })

    const { container } = render(<PromptSection node={{ ...node }} />)

    // Initially, should show the prompt and Edit button
    expect(screen.getByText('hello world')).toBeInTheDocument()

    // Click Edit button
    const editButton = screen.getByRole('button', { name: /edit/i })
    await act(async () => {
      fireEvent.click(editButton)
    })

    // Now a textarea should be visible with the prompt text
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()
    expect(textarea.value).toBe('hello world')
  })

  it('fresh node renders Send button and empty textarea', () => {
    const node = createNode({
      id: 'node-4',
      userPrompt: '',
      status: 'idle',
    })

    useTreeStore.setState({
      nodes: new Map([['node-4', node]]),
    })

    const { container } = render(<PromptSection node={{ ...node }} />)

    // Assert Send button is present
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).toBeInTheDocument()

    // Assert textarea is present and empty
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()
    expect(textarea.value).toBe('')
    expect(textarea.placeholder).toBe('Ask something…')
  })

  it('clicking Edit then Cancel discards changes', async () => {
    const node = createNode({
      id: 'node-5',
      userPrompt: 'original prompt',
      status: 'idle',
    })

    useTreeStore.setState({
      nodes: new Map([['node-5', node]]),
    })

    const { container } = render(<PromptSection node={{ ...node }} />)

    // Click Edit
    const editButton = screen.getByRole('button', { name: /edit/i })
    await act(async () => {
      fireEvent.click(editButton)
    })

    // Textarea should be visible
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    expect(textarea).toBeInTheDocument()

    // Modify the textarea
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'modified text' } })
    })

    // Click Cancel button
    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await act(async () => {
      fireEvent.click(cancelButton)
    })

    // Should return to showing the original prompt (not the modified text)
    expect(screen.getByText('original prompt')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('modified text')).not.toBeInTheDocument()
  })

  it('typing Enter in fresh textarea triggers Send', async () => {
    const { streamLLMResponse } = await import('../lib/streamingClient')
    vi.mocked(streamLLMResponse).mockImplementation(
      async (_payload, _settings, _target, _onToken, _onDone, _onError) => {
        return () => {}
      }
    )

    const tree = await useTreeStore.getState().createTree('Test Tree')
    const rootId = tree.rootNodeId
    const node = useTreeStore.getState().nodes.get(rootId)!

    const { container } = render(<PromptSection node={{ ...node }} />)

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement

    // Type text into textarea
    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'test prompt' } })
    })

    // Simulate Enter key (without Shift) - this should trigger handleSend
    await act(async () => {
      fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false, preventDefault: () => {} })
    })

    // Give async operations time to settle
    await new Promise((r) => setTimeout(r, 50))

    // streamLLMResponse should have been called
    expect(vi.mocked(streamLLMResponse)).toHaveBeenCalled()
  })
})
