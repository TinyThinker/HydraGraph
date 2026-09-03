import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { TurnNodeComponent } from './TurnNode'
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
    provider: overrides.provider ?? 'openrouter',
    errorMessage: overrides.errorMessage,
    stale: overrides.stale,
  }
}

describe('TurnNodeComponent stale badge', () => {
  beforeEach(async () => {
    // Reset database
    await db.delete()
    await db.open()

    // Reset store
    useTreeStore.setState({
      nodes: new Map(),
      trees: [],
      activeTreeId: 'tree-test',
      liveText: new Map(),
    })
  })

  it('renders stale badge when data.stale is true', () => {
    const nodeId = crypto.randomUUID()
    const node = createNode({
      id: nodeId,
      treeId: 'tree-test',
      parentId: null,
      childrenIds: [],
      stale: true,
    })

    useTreeStore.setState({
      nodes: new Map([[nodeId, node]]),
    })

    render(
      <ReactFlowProvider>
        <TurnNodeComponent {...({ data: node, selected: false } as any)} />
      </ReactFlowProvider>
    )

    // Assert: stale badge text is in the document
    expect(screen.getByText(/ancestor changed/i)).toBeInTheDocument()
  })

  it('does not render stale badge when data.stale is false', () => {
    const nodeId = crypto.randomUUID()
    const node = createNode({
      id: nodeId,
      treeId: 'tree-test',
      parentId: null,
      childrenIds: [],
      stale: false,
    })

    useTreeStore.setState({
      nodes: new Map([[nodeId, node]]),
    })

    render(
      <ReactFlowProvider>
        <TurnNodeComponent {...({ data: node, selected: false } as any)} />
      </ReactFlowProvider>
    )

    // Assert: stale badge text is not in the document
    expect(screen.queryByText(/ancestor changed/i)).not.toBeInTheDocument()
  })

  it('does not render stale badge when data.stale is undefined', () => {
    const nodeId = crypto.randomUUID()
    const node = createNode({
      id: nodeId,
      treeId: 'tree-test',
      parentId: null,
      childrenIds: [],
      // stale is undefined
    })

    useTreeStore.setState({
      nodes: new Map([[nodeId, node]]),
    })

    render(
      <ReactFlowProvider>
        <TurnNodeComponent {...({ data: node, selected: false } as any)} />
      </ReactFlowProvider>
    )

    // Assert: stale badge text is not in the document
    expect(screen.queryByText(/ancestor changed/i)).not.toBeInTheDocument()
  })
})
