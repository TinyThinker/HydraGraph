import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { act } from 'react'
import { Canvas } from './Canvas'
import { useCanvasGraph } from './useCanvasGraph'
import { useTreeStore } from '../store/useTreeStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { db } from '../db/ChatDatabase'
import type { TurnNode } from '../types'

function createNode(overrides: Partial<TurnNode>): TurnNode {
  const id = overrides.id ?? crypto.randomUUID()
  return {
    id,
    treeId: overrides.treeId ?? 'tree-test',
    parentId: overrides.parentId ?? null,
    childrenIds: overrides.childrenIds ?? [],
    userPrompt: overrides.userPrompt ?? 'prompt',
    assistantResponse: overrides.assistantResponse ?? '',
    positionX: overrides.positionX ?? 100,
    positionY: overrides.positionY ?? 100,
    isCollapsed: overrides.isCollapsed ?? false,
    status: overrides.status ?? 'idle',
    modelUsed: overrides.modelUsed ?? 'gemini-2.5-flash',
    timestamp: overrides.timestamp ?? Date.now(),
    provider: overrides.provider ?? 'openrouter',
  }
}

// tree: root -> a -> b  ; sibling branch root -> a2 -> b2
const rId = crypto.randomUUID()
const aId = crypto.randomUUID()
const bId = crypto.randomUUID()
const a2Id = crypto.randomUUID()
const b2Id = crypto.randomUUID()

function seedTree() {
  const r = createNode({ id: rId, parentId: null, childrenIds: [aId, a2Id], positionX: 0, positionY: 0 })
  const a = createNode({ id: aId, parentId: rId, childrenIds: [bId], positionX: -200, positionY: 150 })
  const b = createNode({ id: bId, parentId: aId, childrenIds: [], positionX: -200, positionY: 300 })
  const a2 = createNode({ id: a2Id, parentId: rId, childrenIds: [b2Id], positionX: 200, positionY: 150 })
  const b2 = createNode({ id: b2Id, parentId: a2Id, childrenIds: [], positionX: 200, positionY: 300 })
  useTreeStore.setState({
    nodes: new Map([
      [rId, r],
      [aId, a],
      [bId, b],
      [a2Id, a2],
      [b2Id, b2],
    ]),
    activeTreeId: 'tree-test',
  })
}

// Minimal harness so we can read the derived RF edges the real hook produces.
let captured: ReturnType<typeof useCanvasGraph> | null = null
function GraphProbe() {
  captured = useCanvasGraph()
  return null
}

describe('canvas path highlighting: T3.4', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    useTreeStore.setState({
      nodes: new Map(),
      trees: [],
      activeTreeId: 'tree-test',
      liveText: new Map(),
    })
    seedTree()
  })

  afterEach(() => {
    captured = null
    useSelectionStore.setState({ selectedNodeId: null, focusNonce: 0 })
  })

  it('dims off-path node wrappers and keeps on-path wrappers bright', async () => {
    useSelectionStore.setState({ selectedNodeId: bId })

    const { unmount, container } = render(
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>,
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50))
    })

    const b2El = container.querySelector(`.react-flow__node[data-id="${b2Id}"]`)
    const aEl = container.querySelector(`.react-flow__node[data-id="${aId}"]`)

    expect(b2El).not.toBeNull()
    expect(aEl).not.toBeNull()
    // off-path -> dimmed
    expect(b2El?.classList.contains('opacity-70')).toBe(true)
    // on-path -> not dimmed
    expect(aEl?.classList.contains('opacity-70')).toBe(false)

    unmount()
  })

  it('accents on-path edges (animated + cyan) and dims off-path edges', async () => {
    useSelectionStore.setState({ selectedNodeId: bId })

    const { unmount } = render(
      <ReactFlowProvider>
        <GraphProbe />
      </ReactFlowProvider>,
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    const edges = captured!.edges
    const onPath = edges.find((e) => e.source === aId && e.target === bId)!
    const offPath = edges.find((e) => e.source === rId && e.target === a2Id)!

    expect(onPath.animated).toBe(true)
    expect(onPath.style).toMatchObject({ stroke: '#22d3ee' })
    expect(offPath.animated).toBe(false)
    expect(offPath.style).toMatchObject({ opacity: 0.35 })

    unmount()
  })

  it('renders everything normally when nothing is selected', async () => {
    const { unmount } = render(
      <ReactFlowProvider>
        <GraphProbe />
      </ReactFlowProvider>,
    )

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })

    for (const e of captured!.edges) {
      expect(e.animated).toBe(false)
      expect(e.style).toMatchObject({ stroke: '#4f46e5', strokeWidth: 2 })
    }

    unmount()
  })
})
