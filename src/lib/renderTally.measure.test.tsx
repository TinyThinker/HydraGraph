import { describe, it, expect, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { act } from 'react'
import { Canvas } from '../components/Canvas'
import { useTreeStore } from '../store/useTreeStore'
import { db } from '../db/ChatDatabase'
import {
  enableRenderTally,
  resetRenderTally,
  getRenderTally,
} from './renderTally'
import type { TurnNode } from '../types'

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
  }
}

describe('renderTally baseline measurement', () => {
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
    })
  })

  it('measures baseline render counts during token streaming', async () => {
    // Create 4 nodes: 1 root + 3 leaf children
    const rootId = crypto.randomUUID()
    const leaf1Id = crypto.randomUUID()
    const leaf2Id = crypto.randomUUID()
    const leaf3Id = crypto.randomUUID()

    const root = createNode({
      id: rootId,
      treeId: 'tree-test',
      parentId: null,
      childrenIds: [leaf1Id, leaf2Id, leaf3Id],
      userPrompt: 'Hello',
      positionX: 400,
      positionY: 100,
    })

    const leaf1 = createNode({
      id: leaf1Id,
      treeId: 'tree-test',
      parentId: rootId,
      childrenIds: [],
      userPrompt: 'Follow-up 1',
      positionX: 100,
      positionY: 400,
    })

    const leaf2 = createNode({
      id: leaf2Id,
      treeId: 'tree-test',
      parentId: rootId,
      childrenIds: [],
      userPrompt: 'Follow-up 2',
      positionX: 400,
      positionY: 400,
    })

    const leaf3 = createNode({
      id: leaf3Id,
      treeId: 'tree-test',
      parentId: rootId,
      childrenIds: [],
      userPrompt: 'Follow-up 3',
      positionX: 700,
      positionY: 400,
    })

    // Add all nodes to store
    const nodes = new Map<string, TurnNode>([
      [rootId, root],
      [leaf1Id, leaf1],
      [leaf2Id, leaf2],
      [leaf3Id, leaf3],
    ])

    useTreeStore.setState({
      nodes,
      activeTreeId: 'tree-test',
    })

    // Render Canvas
    const { unmount } = render(
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>,
    )

    // Wait for initial mount and effects to settle
    await new Promise((resolve) => setTimeout(resolve, 100))

    // AFTER mount settles, enable tally and reset counts
    enableRenderTally()
    resetRenderTally()

    // Stream 20 token deltas into leaf1 — each in its own act() so React
    // commits once per token, the way a real network stream arrives.
    for (let i = 0; i < 20; i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        useTreeStore.getState().appendTokenDelta(leaf1Id, `token${i} `)
      })
    }

    // Wait a moment for final renders to settle
    await new Promise((resolve) => setTimeout(resolve, 50))

    // Read the tally
    const tally = getRenderTally()

    // Log results for human inspection
    console.log('BASELINE render counts:', JSON.stringify(tally))
    console.log(`Streaming node (${leaf1Id}): ${tally[leaf1Id] ?? 0} renders`)
    console.log(`Other nodes max count: ${Math.max(tally[leaf2Id] ?? 0, tally[leaf3Id] ?? 0, tally[rootId] ?? 0)} renders`)

    // Soft assertion: streaming node must have rendered at least once
    expect(tally[leaf1Id]).toBeGreaterThan(0)
    unmount()
  })
})
