import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { act } from 'react'
import { Canvas } from './Canvas'
import { useTreeStore } from '../store/useTreeStore'
import { db } from '../db/ChatDatabase'
import { NODE_WIDTH, NODE_HEIGHT } from '../lib/nodeDimensions'
import type { TurnNode } from '../types'

// Helper: create a node with sensible defaults
function createNode(overrides: Partial<TurnNode>): TurnNode {
  const id = overrides.id ?? crypto.randomUUID()
  return {
    id,
    treeId: overrides.treeId ?? 'tree-test',
    parentId: overrides.parentId ?? null,
    childrenIds: overrides.childrenIds ?? [],
    userPrompt: overrides.userPrompt ?? 'What is the meaning of life?',
    assistantResponse: overrides.assistantResponse ?? '',
    positionX: overrides.positionX ?? 400,
    positionY: overrides.positionY ?? 100,
    isCollapsed: overrides.isCollapsed ?? false,
    status: overrides.status ?? 'idle',
    modelUsed: overrides.modelUsed ?? 'gemini-2.5-flash',
    timestamp: overrides.timestamp ?? Date.now(),
    provider: overrides.provider ?? 'openrouter',
    width: overrides.width,
    height: overrides.height,
  }
}

describe('stationPill: fixed node dimensions', () => {
  beforeEach(async () => {
    // Reset database
    await db.delete()
    await db.open()

    // Reset store to clean state
    useTreeStore.setState({
      nodes: new Map(),
      trees: [],
      activeTreeId: 'tree-test',
      liveText: new Map(),
    })
  })

  it('(a) ignores explicit width/height on the store node and renders at the fixed pill size', async () => {
    // Create one node with width: 500, height: 400
    const nodeId = crypto.randomUUID()
    const node = createNode({
      id: nodeId,
      treeId: 'tree-test',
      parentId: null,
      childrenIds: [],
      width: 500,
      height: 400,
    })

    useTreeStore.setState({
      nodes: new Map([[nodeId, node]]),
      activeTreeId: 'tree-test',
    })

    // Render Canvas
    const { unmount, container } = render(
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>,
    )

    // Wait for render to settle
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    // Query the React Flow node element
    const rfNode = container.querySelector('.react-flow__node')

    // ASSERTION: node element exists
    expect(rfNode).not.toBeNull()

    // ASSERTION: inline style uses the fixed pill dimensions, NOT 500/400
    const styleWidth = rfNode?.getAttribute('style') || ''
    expect(styleWidth).toContain(`${NODE_WIDTH}px`)
    expect(styleWidth).toContain(`${NODE_HEIGHT}px`)

    unmount()
  })

  it('(b) renders node with NO width/height at the fixed pill size', async () => {
    // Create one node WITHOUT width/height
    const nodeId = crypto.randomUUID()
    const node = createNode({
      id: nodeId,
      treeId: 'tree-test',
      parentId: null,
      childrenIds: [],
      // width and height omitted (undefined)
    })

    useTreeStore.setState({
      nodes: new Map([[nodeId, node]]),
      activeTreeId: 'tree-test',
    })

    // Render Canvas
    const { unmount, container } = render(
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>,
    )

    // Wait for render to settle
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100))
    })

    // Query the React Flow node element
    const rfNode = container.querySelector('.react-flow__node')

    // ASSERTION: node element exists (fallback path does not throw)
    expect(rfNode).not.toBeNull()

    // ASSERTION: inline style uses the fixed pill dimensions
    const styleWidth = rfNode?.getAttribute('style') || ''
    expect(styleWidth).toContain(`${NODE_WIDTH}px`)
    expect(styleWidth).toContain(`${NODE_HEIGHT}px`)

    unmount()
  })
})
