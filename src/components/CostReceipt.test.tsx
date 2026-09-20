import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CostReceipt } from './CostReceipt'
import { useTreeStore } from '../store/useTreeStore'
import type { TurnNode } from '../types'

function node(overrides: Partial<TurnNode>): TurnNode {
  return {
    id: 'n',
    treeId: 'tree-1',
    parentId: null,
    childrenIds: [],
    userPrompt: '',
    assistantResponse: '',
    positionX: 0,
    positionY: 0,
    isCollapsed: false,
    status: 'idle',
    modelUsed: 'openai/gpt-4o-mini',
    timestamp: 1,
    ...overrides,
  }
}

describe('CostReceipt', () => {
  beforeEach(() => {
    useTreeStore.setState({ nodes: new Map(), activeTreeId: 'tree-1' })
  })

  it('renders the three receipt rows for priced turns', () => {
    const a = node({ id: 'a', childrenIds: ['b', 'c'], userPrompt: 'q1', assistantResponse: 'a1', inputTokens: 100, outputTokens: 200 })
    const b = node({ id: 'b', parentId: 'a', timestamp: 2, userPrompt: 'q2', assistantResponse: 'a2', inputTokens: 100, outputTokens: 200 })
    const c = node({ id: 'c', parentId: 'a', timestamp: 3, userPrompt: 'q3', assistantResponse: 'a3', inputTokens: 100, outputTokens: 200 })
    useTreeStore.setState({ nodes: new Map([a, b, c].map((n) => [n.id, n])) })

    render(<CostReceipt />)
    expect(screen.getByText(/This tree · 3 turns · 1 forks/)).toBeInTheDocument()
    expect(screen.getByText(/Same 3 turns, one linear thread/)).toBeInTheDocument()
    expect(screen.getByText(/Context you didn't pay for/)).toBeInTheDocument()
  })

  it('shows a muted message when there are no priced turns', () => {
    render(<CostReceipt />)
    expect(screen.getByText('No priced turns yet.')).toBeInTheDocument()
  })

  // Regression: an errored turn used to be reported as "unknown model
  // pricing", sending people to the model picker to fix a failed request.
  it('names the real reason a turn was excluded', () => {
    const ok = node({ id: 'ok', userPrompt: 'q', assistantResponse: 'a', inputTokens: 100, outputTokens: 200 })
    const errored = node({ id: 'err', timestamp: 2, userPrompt: 'never finished' })
    const unlisted = node({
      id: 'unlisted',
      timestamp: 3,
      userPrompt: 'q',
      assistantResponse: 'a',
      modelUsed: 'some-unlisted-model-v9',
      inputTokens: 100,
      outputTokens: 200,
    })
    useTreeStore.setState({ nodes: new Map([ok, errored, unlisted].map((n) => [n.id, n])) })

    render(<CostReceipt />)
    expect(screen.getByText('1 turn excluded — no token counts recorded')).toBeInTheDocument()
    expect(screen.getByText('1 turn excluded — unknown model pricing')).toBeInTheDocument()
  })

  it('pluralises and omits the lines that do not apply', () => {
    const ok = node({ id: 'ok', userPrompt: 'q', assistantResponse: 'a', inputTokens: 100, outputTokens: 200 })
    const e1 = node({ id: 'e1', timestamp: 2, userPrompt: 'unfinished' })
    const e2 = node({ id: 'e2', timestamp: 3, userPrompt: 'also unfinished' })
    useTreeStore.setState({ nodes: new Map([ok, e1, e2].map((n) => [n.id, n])) })

    render(<CostReceipt />)
    expect(screen.getByText('2 turns excluded — no token counts recorded')).toBeInTheDocument()
    expect(screen.queryByText(/unknown model pricing/)).not.toBeInTheDocument()
  })
})
