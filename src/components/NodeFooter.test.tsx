import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { NodeFooter } from './NodeFooter'
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

describe('NodeFooter', () => {
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

  it('node WITHOUT systemPromptOverride shows persona toggle button (slate color)', () => {
    const r = createNode({ id: 'r', parentId: null })

    useTreeStore.setState({
      nodes: new Map([['r', r]]),
    })

    render(
      <ReactFlowProvider>
        <NodeFooter node={r as any} />
      </ReactFlowProvider>
    )

    // Assert persona toggle button is present
    const personaButton = screen.getByTitle("Edit this node's system prompt")
    expect(personaButton).toBeInTheDocument()

    // Assert it has slate color (not amber)
    expect(personaButton).toHaveClass('text-slate-500')
  })

  it('node WITH systemPromptOverride shows persona toggle button (amber color)', () => {
    const a = createNode({
      id: 'a',
      parentId: null,
      systemPromptOverride: 'CUSTOM PROMPT',
    })

    useTreeStore.setState({
      nodes: new Map([['a', a]]),
    })

    render(
      <ReactFlowProvider>
        <NodeFooter node={a as any} />
      </ReactFlowProvider>
    )

    // Assert persona toggle button is present
    const personaButton = screen.getByTitle("Edit this node's system prompt")
    expect(personaButton).toBeInTheDocument()

    // Assert it has amber color
    expect(personaButton).toHaveClass('text-amber-400')
  })

  it('clicking persona toggle opens SystemPromptEditor', async () => {
    const r = createNode({ id: 'r', parentId: null })

    useTreeStore.setState({
      nodes: new Map([['r', r]]),
    })

    render(
      <ReactFlowProvider>
        <NodeFooter node={r as any} />
      </ReactFlowProvider>
    )

    // Initially, editor should not be visible
    expect(screen.queryByText('System prompt for this node')).not.toBeInTheDocument()

    // Click persona toggle
    const personaButton = screen.getByTitle("Edit this node's system prompt")
    await act(async () => {
      fireEvent.click(personaButton)
    })

    // Now editor should be visible
    expect(screen.getByText('System prompt for this node')).toBeInTheDocument()
  })

  it('clicking persona toggle again closes SystemPromptEditor', async () => {
    const r = createNode({ id: 'r', parentId: null })

    useTreeStore.setState({
      nodes: new Map([['r', r]]),
    })

    render(
      <ReactFlowProvider>
        <NodeFooter node={r as any} />
      </ReactFlowProvider>
    )

    // Click to open
    const personaButton = screen.getByTitle("Edit this node's system prompt")
    await act(async () => {
      fireEvent.click(personaButton)
    })

    expect(screen.getByText('System prompt for this node')).toBeInTheDocument()

    // Click to close (find the button again after re-render)
    const personaButtonAfter = screen.getByTitle("Edit this node's system prompt")
    await act(async () => {
      fireEvent.click(personaButtonAfter)
    })

    // Wait for the editor to disappear
    await waitFor(() => {
      expect(screen.queryByText('System prompt for this node')).not.toBeInTheDocument()
    })
  })

  it('footer renders delete and branch buttons', () => {
    const r = createNode({ id: 'r', parentId: null })
    const a = createNode({ id: 'a', parentId: 'r' })

    useTreeStore.setState({
      nodes: new Map([
        ['r', r],
        ['a', a],
      ]),
    })

    render(
      <ReactFlowProvider>
        <NodeFooter node={a as any} />
      </ReactFlowProvider>
    )

    // Assert delete button is present
    const deleteButton = screen.getByTitle('Delete this node and all descendants')
    expect(deleteButton).toBeInTheDocument()

    // Assert branch button is present
    const branchButton = screen.getByRole('button', { name: /branch/i })
    expect(branchButton).toBeInTheDocument()
  })

  it('root node has delete button disabled', () => {
    const r = createNode({ id: 'r', parentId: null })

    useTreeStore.setState({
      nodes: new Map([['r', r]]),
    })

    render(
      <ReactFlowProvider>
        <NodeFooter node={r as any} />
      </ReactFlowProvider>
    )

    // Assert delete button exists and is disabled
    const deleteButton = screen.getByTitle("The root node can't be deleted")
    expect(deleteButton).toBeDisabled()
    expect(deleteButton).toHaveClass('text-slate-700')
  })

  it('clicking the model badge opens the picker', async () => {
    const r = createNode({ id: 'r', parentId: null, modelUsed: 'gemini-2.5-flash' })

    useTreeStore.setState({
      nodes: new Map([['r', r]]),
    })

    render(
      <ReactFlowProvider>
        <NodeFooter node={r as any} />
      </ReactFlowProvider>
    )

    // Initially, picker should not be visible
    expect(screen.queryByText('Model for this node')).not.toBeInTheDocument()

    // Click model badge button
    const modelButton = screen.getByTitle('Change the model for this node')
    await act(async () => {
      fireEvent.click(modelButton)
    })

    // Now picker should be visible
    expect(screen.getByText('Model for this node')).toBeInTheDocument()
  })

  it('the model badge is disabled while streaming', () => {
    const r = createNode({ id: 'r', parentId: null, status: 'streaming' })

    useTreeStore.setState({
      nodes: new Map([['r', r]]),
    })

    render(
      <ReactFlowProvider>
        <NodeFooter node={r as any} />
      </ReactFlowProvider>
    )

    // Assert model button is disabled
    const modelButton = screen.getByTitle('Change the model for this node')
    expect(modelButton).toBeDisabled()
    expect(modelButton).toHaveClass('opacity-50')
    expect(modelButton).toHaveClass('cursor-not-allowed')

    // Assert picker is NOT visible (clicking disabled button does nothing)
    expect(screen.queryByText('Model for this node')).not.toBeInTheDocument()
  })
})
