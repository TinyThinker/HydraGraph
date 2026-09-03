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
    provider: overrides.provider ?? 'openrouter',
  }
}

describe('collapse and expand: T4.8', () => {
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

  it('with a.isCollapsed=true: only r and a render; b and c hidden', async () => {
    // Build chain: r -> a -> b -> c
    const rId = crypto.randomUUID()
    const aId = crypto.randomUUID()
    const bId = crypto.randomUUID()
    const cId = crypto.randomUUID()

    const r = createNode({
      id: rId,
      treeId: 'tree-test',
      parentId: null,
      childrenIds: [aId],
      isCollapsed: false,
    })

    const a = createNode({
      id: aId,
      treeId: 'tree-test',
      parentId: rId,
      childrenIds: [bId],
      isCollapsed: true,
    })

    const b = createNode({
      id: bId,
      treeId: 'tree-test',
      parentId: aId,
      childrenIds: [cId],
      isCollapsed: false,
    })

    const c = createNode({
      id: cId,
      treeId: 'tree-test',
      parentId: bId,
      childrenIds: [],
      isCollapsed: false,
    })

    useTreeStore.setState({
      nodes: new Map([
        [rId, r],
        [aId, a],
        [bId, b],
        [cId, c],
      ]),
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
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    // Check node count: should be 2 (r and a visible, b and c hidden)
    const nodeElements = container.querySelectorAll('.react-flow__node')
    expect(nodeElements.length).toBe(2)

    unmount()
  })

  it('nested preservation: a and b both collapsed; expand a shows r,a,b but c stays hidden', async () => {
    // Build chain: r -> a -> b -> c
    const rId = crypto.randomUUID()
    const aId = crypto.randomUUID()
    const bId = crypto.randomUUID()
    const cId = crypto.randomUUID()

    const r = createNode({
      id: rId,
      treeId: 'tree-test',
      parentId: null,
      childrenIds: [aId],
      userPrompt: 'r',
      isCollapsed: false,
    })

    const a = createNode({
      id: aId,
      treeId: 'tree-test',
      parentId: rId,
      childrenIds: [bId],
      userPrompt: 'a',
      isCollapsed: true,
    })

    const b = createNode({
      id: bId,
      treeId: 'tree-test',
      parentId: aId,
      childrenIds: [cId],
      userPrompt: 'b',
      isCollapsed: true,
    })

    const c = createNode({
      id: cId,
      treeId: 'tree-test',
      parentId: bId,
      childrenIds: [],
      userPrompt: 'c',
      isCollapsed: false,
    })

    useTreeStore.setState({
      nodes: new Map([
        [rId, r],
        [aId, a],
        [bId, b],
        [cId, c],
      ]),
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
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    // Check initial node count: should be 2 (r and a visible, b and c hidden)
    let nodeElements = container.querySelectorAll('.react-flow__node')
    expect(nodeElements.length).toBe(2)

    // Expand a
    await act(async () => {
      await useTreeStore.getState().toggleCollapse(aId)
    })

    // Wait for render to settle
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    // Re-query node elements
    nodeElements = container.querySelectorAll('.react-flow__node')

    // Should now be 3 (r, a, b visible; c still hidden because b is collapsed)
    expect(nodeElements.length).toBe(3)

    unmount()
  })

  it('leaf node shows no control; node with children shows control', async () => {
    // Create a simple tree: r (has child a) -> a (leaf)
    const rId = crypto.randomUUID()
    const aId = crypto.randomUUID()

    const r = createNode({
      id: rId,
      treeId: 'tree-test',
      parentId: null,
      childrenIds: [aId],
      isCollapsed: false,
    })

    const a = createNode({
      id: aId,
      treeId: 'tree-test',
      parentId: rId,
      childrenIds: [],
      isCollapsed: false,
    })

    useTreeStore.setState({
      nodes: new Map([
        [rId, r],
        [aId, a],
      ]),
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
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    // The collapse control is an icon button identified by its title attribute.
    // Only r (which has a child) shows it; leaf a does not.
    const collapseButtons = container.querySelectorAll(
      'button[title="Collapse subtree"], button[title^="Show "]',
    )
    expect(collapseButtons.length).toBe(1)

    unmount()
  })
})
