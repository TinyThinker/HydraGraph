import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { act } from 'react'
import { Canvas } from './Canvas'
import { useTreeStore } from '../store/useTreeStore'
import { db } from '../db/ChatDatabase'
import {
  enableRenderTally,
  disableRenderTally,
  resetRenderTally,
  getRenderTally,
} from '../lib/renderTally'
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
  }
}

/**
 * RENDER BUDGET REGRESSION TESTS
 *
 * These tests assert that streaming tokens to one node does NOT trigger
 * re-renders on sibling or parent nodes. Assertions are on render COUNTS,
 * which are deterministic — never on timing or exact token timings.
 */
describe('renderBudget: render count regression lock', () => {
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

  afterEach(() => {
    disableRenderTally()
    resetRenderTally()
  })

  describe('Test A: streaming one node does not re-render the others', () => {
    it('non-streaming siblings remain at mount-only render count during 20-token stream', async () => {
      // Create 3 nodes: 1 root + 2 children
      const rootId = crypto.randomUUID()
      const childAId = crypto.randomUUID()
      const childBId = crypto.randomUUID()

      const root = createNode({
        id: rootId,
        treeId: 'tree-test',
        parentId: null,
        childrenIds: [childAId, childBId],
        userPrompt: 'Root prompt',
        positionX: 400,
        positionY: 100,
      })

      const childA = createNode({
        id: childAId,
        treeId: 'tree-test',
        parentId: rootId,
        childrenIds: [],
        userPrompt: 'Child A prompt',
        positionX: 100,
        positionY: 400,
      })

      const childB = createNode({
        id: childBId,
        treeId: 'tree-test',
        parentId: rootId,
        childrenIds: [],
        userPrompt: 'Child B prompt',
        positionX: 700,
        positionY: 400,
      })

      // Add all nodes to store
      const nodes = new Map<string, TurnNode>([
        [rootId, root],
        [childAId, childA],
        [childBId, childB],
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

      // AFTER mount settles, enable tally and reset counts to start fresh
      enableRenderTally()
      resetRenderTally()

      // Take a baseline snapshot (should be 0 or very small after reset)
      const baselineTally = getRenderTally()
      const rootBaselineCount = baselineTally[rootId] ?? 0
      const childABaselineCount = baselineTally[childAId] ?? 0
      const childBBaselineCount = baselineTally[childBId] ?? 0

      // Stream 20 tokens into childA ONLY
      await act(async () => {
        for (let i = 0; i < 20; i++) {
          // eslint-disable-next-line no-await-in-loop
          await act(async () => {
            useTreeStore.getState().appendTokenDelta(childAId, `x `)
          })
        }
      })

      // Wait for renders to settle
      await new Promise((resolve) => setTimeout(resolve, 50))

      // Read the tally after streaming
      const postStreamTally = getRenderTally()

      // Log for debugging
      console.log('Baseline counts (after reset, before stream):', {
        root: rootBaselineCount,
        childA: childABaselineCount,
        childB: childBBaselineCount,
      })
      console.log('Post-stream counts:', {
        root: postStreamTally[rootId] ?? 0,
        childA: postStreamTally[childAId] ?? 0,
        childB: postStreamTally[childBId] ?? 0,
      })

      // ASSERTIONS
      // Root node: must NOT re-render during stream (should stay at baseline)
      expect(postStreamTally[rootId] ?? 0).toBe(rootBaselineCount)

      // Child B (not streaming): must NOT re-render during stream (should stay at baseline)
      expect(postStreamTally[childBId] ?? 0).toBe(childBBaselineCount)

      // Child A (streaming): MUST have re-rendered beyond baseline
      expect(postStreamTally[childAId] ?? 0).toBeGreaterThan(childABaselineCount)
      // But sanity check: shouldn't be more than ~40 re-renders (roughly 2 per token)
      expect(postStreamTally[childAId] ?? 0).toBeLessThanOrEqual(childABaselineCount + 40)

      unmount()
    })
  })
})
