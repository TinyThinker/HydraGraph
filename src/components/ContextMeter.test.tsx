import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ContextMeter } from './ContextMeter'
import { estimateContextTokens, CONTEXT_WARN_TOKENS } from '../lib/contextEstimate'
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
    inputTokens: overrides.inputTokens,
    outputTokens: overrides.outputTokens,
  }
}

describe('ContextMeter', () => {
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

  describe('estimateContextTokens', () => {
    it('lone root with ~40-char prompt returns small positive number (< 50)', () => {
      const nodeId = crypto.randomUUID()
      const node = createNode({
        id: nodeId,
        parentId: null,
        userPrompt: 'What is AI?',
      })

      const nodes = new Map([[nodeId, node]])
      const estimate = estimateContextTokens(nodeId, nodes)

      expect(estimate).toBeGreaterThan(0)
      expect(estimate).toBeLessThan(50)
    })

    it('5-deep chain estimates greater than 2-deep sub-chain', () => {
      const ids = Array.from({ length: 5 }, () => crypto.randomUUID())

      const nodes = new Map<string, TurnNode>()
      for (let i = 0; i < 5; i++) {
        const node = createNode({
          id: ids[i],
          parentId: i === 0 ? null : ids[i - 1],
          userPrompt: `Prompt ${i}`,
          assistantResponse: 'a'.repeat(4000),
        })
        nodes.set(ids[i], node)
      }

      const deepEstimate = estimateContextTokens(ids[4], nodes)
      const shallowEstimate = estimateContextTokens(ids[1], nodes)

      expect(deepEstimate).toBeGreaterThan(shallowEstimate)
    })

    it('target node own response is excluded from estimate', () => {
      const nodeId = crypto.randomUUID()
      const node = createNode({
        id: nodeId,
        parentId: null,
        userPrompt: 'Small prompt',
        assistantResponse: 'a'.repeat(8000),
      })

      const nodes = new Map([[nodeId, node]])
      const estimate = estimateContextTokens(nodeId, nodes)

      expect(estimate).toBeLessThan(100)
    })
  })

  describe('ContextMeter component', () => {
    it('renders estimate without warning when tokens < threshold', () => {
      const { container } = render(<ContextMeter tokens={100} />)
      expect(container.textContent).toMatch(/~100 tokens of context/)
      expect(screen.queryByText(/approaching typical model limits/i)).not.toBeInTheDocument()
    })

    it('renders estimate with warning when tokens > threshold', () => {
      const { container } = render(<ContextMeter tokens={CONTEXT_WARN_TOKENS + 1000} />)
      expect(container.textContent).toMatch(/~7,000 tokens of context/)
      expect(screen.getByText(/approaching typical model limits/i)).toBeInTheDocument()
    })

    it('shows actual counts and omits estimate when both inputTokens and outputTokens provided', () => {
      const { container } = render(<ContextMeter tokens={CONTEXT_WARN_TOKENS + 1000} inputTokens={1234} outputTokens={567} />)
      expect(container.textContent).toMatch(/1,234 in/)
      expect(container.textContent).toMatch(/567 out/)
      expect(container.textContent).not.toMatch(/~7,000 tokens of context/)
      expect(screen.queryByText(/approaching typical model limits/i)).not.toBeInTheDocument()
    })

    it('renders nothing when tokens is null', () => {
      const { container } = render(<ContextMeter tokens={null} />)
      expect(container.firstChild).toBeNull()
    })
  })

  // NOTE: the "TurnNode integration" block was removed in Task 3.3 — the canvas
  // node is now a compact station pill and no longer renders ContextMeter or the
  // Send controls. ContextMeter behaviour is covered by the component block above.
})
