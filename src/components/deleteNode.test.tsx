import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { act } from 'react'
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
    provider: overrides.provider ?? 'gemini',
    errorMessage: overrides.errorMessage,
  }
}

describe('TurnNodeComponent delete button', () => {
  beforeEach(async () => {
    // Reset database
    await db.delete()
    await db.open()

    // Reset store
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

  it('child node has enabled delete button that opens confirmation on click', async () => {
    const rootId = crypto.randomUUID()
    const childId = crypto.randomUUID()

    const root = createNode({
      id: rootId,
      treeId: 'tree-test',
      parentId: null,
      childrenIds: [childId],
    })

    const child = createNode({
      id: childId,
      treeId: 'tree-test',
      parentId: rootId,
      childrenIds: [],
    })

    useTreeStore.setState({
      nodes: new Map([
        [rootId, root],
        [childId, child],
      ]),
    })

    const { container } = render(
      <ReactFlowProvider>
        <TurnNodeComponent {...({ data: child, selected: false } as any)} />
      </ReactFlowProvider>
    )

    // Find the delete button by its title
    const deleteButton = container.querySelector('button[title="Delete this node and all descendants"]') as HTMLButtonElement
    expect(deleteButton).toBeInTheDocument()
    expect(deleteButton).not.toBeDisabled()

    // Confirmation should not be visible yet
    expect(screen.queryByText(/Remove 1 node/)).not.toBeInTheDocument()

    // Click the delete button
    await act(async () => {
      fireEvent.click(deleteButton)
    })

    // Confirmation should now be visible
    expect(screen.getByText(/Remove 1 node/)).toBeInTheDocument()
  })

  it('confirmation block shows correct count and removes node on confirm', async () => {
    const rootId = crypto.randomUUID()
    const aId = crypto.randomUUID()
    const bId = crypto.randomUUID()

    const root = createNode({
      id: rootId,
      treeId: 'tree-test',
      parentId: null,
      childrenIds: [aId],
    })

    const a = createNode({
      id: aId,
      treeId: 'tree-test',
      parentId: rootId,
      childrenIds: [bId],
    })

    const b = createNode({
      id: bId,
      treeId: 'tree-test',
      parentId: aId,
      childrenIds: [],
    })

    useTreeStore.setState({
      nodes: new Map([
        [rootId, root],
        [aId, a],
        [bId, b],
      ]),
    })

    const { container } = render(
      <ReactFlowProvider>
        <TurnNodeComponent {...({ data: a, selected: false } as any)} />
      </ReactFlowProvider>
    )

    // Click delete button
    const deleteButton = container.querySelector('button[title*="Delete"]') as HTMLButtonElement
    await act(async () => {
      fireEvent.click(deleteButton)
    })

    // Confirmation should show "Remove 2 nodes"
    expect(screen.getByText(/Remove 2 nodes/)).toBeInTheDocument()

    // Find and click the confirm button
    const confirmButton = screen.getByRole('button', { name: /Remove 2/ })
    await act(async () => {
      fireEvent.click(confirmButton)
    })

    // Give async operations time to settle
    await new Promise((r) => setTimeout(r, 50))

    // Assert: a and b are removed from memory
    const nodes = useTreeStore.getState().nodes
    expect(nodes.has(aId)).toBe(false)
    expect(nodes.has(bId)).toBe(false)
    expect(nodes.has(rootId)).toBe(true)
  })

  it('root node has disabled delete button that does nothing', async () => {
    const rootId = crypto.randomUUID()
    const root = createNode({
      id: rootId,
      treeId: 'tree-test',
      parentId: null,
      childrenIds: [],
    })

    useTreeStore.setState({
      nodes: new Map([[rootId, root]]),
    })

    const { container } = render(
      <ReactFlowProvider>
        <TurnNodeComponent {...({ data: root, selected: false } as any)} />
      </ReactFlowProvider>
    )

    // Find the delete button
    const deleteButton = container.querySelector('button[title*="root"]') as HTMLButtonElement
    expect(deleteButton).toBeInTheDocument()
    expect(deleteButton).toBeDisabled()

    // Click should not open confirmation
    await act(async () => {
      fireEvent.click(deleteButton)
    })

    // Confirmation should not appear
    expect(screen.queryByText(/Remove/)).not.toBeInTheDocument()
  })

  it('cancel button closes confirmation without deleting', async () => {
    const rootId = crypto.randomUUID()
    const childId = crypto.randomUUID()

    const root = createNode({
      id: rootId,
      treeId: 'tree-test',
      parentId: null,
      childrenIds: [childId],
    })

    const child = createNode({
      id: childId,
      treeId: 'tree-test',
      parentId: rootId,
      childrenIds: [],
    })

    useTreeStore.setState({
      nodes: new Map([
        [rootId, root],
        [childId, child],
      ]),
    })

    const { container } = render(
      <ReactFlowProvider>
        <TurnNodeComponent {...({ data: child, selected: false } as any)} />
      </ReactFlowProvider>
    )

    // Click delete button
    const deleteButton = container.querySelector('button[title*="Delete"]') as HTMLButtonElement
    await act(async () => {
      fireEvent.click(deleteButton)
    })

    // Confirmation should be visible
    expect(screen.getByText(/Remove 1 node/)).toBeInTheDocument()

    // Click Cancel button
    const cancelButton = screen.getByRole('button', { name: /Cancel/ })
    await act(async () => {
      fireEvent.click(cancelButton)
    })

    // Confirmation should be gone
    expect(screen.queryByText(/Remove 1 node/)).not.toBeInTheDocument()

    // Node should still exist
    const nodes = useTreeStore.getState().nodes
    expect(nodes.has(childId)).toBe(true)
  })
})
