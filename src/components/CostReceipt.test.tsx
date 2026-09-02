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
})
