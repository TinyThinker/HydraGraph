import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { act } from 'react'
import { Canvas } from './Canvas'
import { useTreeStore } from '../store/useTreeStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { db } from '../db/ChatDatabase'
import type { TurnNode } from '../types'

function createNode(overrides: Partial<TurnNode>): TurnNode {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    treeId: overrides.treeId ?? 'tree-test',
    parentId: overrides.parentId ?? null,
    childrenIds: overrides.childrenIds ?? [],
    userPrompt: overrides.userPrompt ?? 'q',
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

const settle = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 80))
  })

describe('CanvasSelectionSync: unified auto-center', () => {
  let rootId: string
  let leafId: string

  beforeEach(async () => {
    await db.delete()
    await db.open()
    rootId = crypto.randomUUID()
    leafId = crypto.randomUUID()
    const root = createNode({ id: rootId, parentId: null, childrenIds: [leafId] })
    const leaf = createNode({ id: leafId, parentId: rootId, positionX: 800, positionY: 500 })
    useTreeStore.setState({
      nodes: new Map([
        [rootId, root],
        [leafId, leaf],
      ]),
      trees: [],
      activeTreeId: 'tree-test',
      liveText: new Map(),
      lastSpawnedNodeId: null,
    })
    useSelectionStore.setState({ selectedNodeId: null, focusNonce: 0 })
  })

  afterEach(() => {
    useSelectionStore.setState({ selectedNodeId: null, focusNonce: 0 })
  })

  it('selectAndFocus marks the target node selected on the canvas', async () => {
    const { unmount, container } = render(
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>,
    )
    await settle()

    act(() => {
      useSelectionStore.getState().selectAndFocus(leafId)
    })
    await settle()

    const el = container.querySelector(`.react-flow__node[data-id="${leafId}"]`)
    expect(el).not.toBeNull()
    expect(el!.classList.contains('selected')).toBe(true)

    unmount()
  })

  it('a spawn (lastSpawnedNodeId) routes through selectAndFocus', async () => {
    const { unmount } = render(
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>,
    )
    await settle()

    act(() => {
      useTreeStore.setState({ lastSpawnedNodeId: leafId })
    })
    await settle()

    expect(useSelectionStore.getState().selectedNodeId).toBe(leafId)
    expect(useSelectionStore.getState().focusNonce).toBeGreaterThan(0)

    unmount()
  })
})
