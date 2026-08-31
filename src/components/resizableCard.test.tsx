import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { act } from 'react'
import { Canvas } from './Canvas'
import { useTreeStore } from '../store/useTreeStore'
import { db } from '../db/ChatDatabase'
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
    provider: overrides.provider ?? 'gemini',
    width: overrides.width,
    height: overrides.height,
  }
}

describe('resizableCard: T4.2 width/height', () => {
  beforeEach(async () => {
    // Reset database
    await db.delete()
    await db.open()

    // Reset store to clean state
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

  it('(a) renders node with explicit width/height from store', async () => {
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

    // ASSERTION: inline style width is 500px
    const styleWidth = rfNode?.getAttribute('style') || ''
    expect(styleWidth).toContain('500px')

    // ASSERTION: inline style height is 400px
    expect(styleWidth).toContain('400px')

    unmount()
  })

  it('(b) renders node with NO width/height and falls back to defaults', async () => {
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

    // ASSERTION: inline style width is 320px (DEFAULT_NODE_WIDTH)
    const styleWidth = rfNode?.getAttribute('style') || ''
    expect(styleWidth).toContain('320px')

    // ASSERTION: inline style height is 240px (DEFAULT_NODE_HEIGHT)
    expect(styleWidth).toContain('240px')

    unmount()
  })
})
