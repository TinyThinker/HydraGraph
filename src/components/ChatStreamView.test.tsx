import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatStreamView } from './ChatStreamView'
import { useTreeStore } from '../store/useTreeStore'
import { useSelectionStore } from '../store/useSelectionStore'
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
    modelUsed: 'test-model',
    timestamp: 1,
    ...overrides,
  }
}

const r = node({ id: 'r', childrenIds: ['a', 'c'] })
const a = node({ id: 'a', parentId: 'r', childrenIds: ['b'], userPrompt: 'first question', assistantResponse: 'first answer' })
const b = node({ id: 'b', parentId: 'a', userPrompt: 'second question', assistantResponse: '**bold** reply', inputTokens: 12, outputTokens: 34 })
const c = node({ id: 'c', parentId: 'r', userPrompt: 'sibling branch', assistantResponse: 'sibling answer' })

beforeEach(() => {
  useTreeStore.setState({
    nodes: new Map([r, a, b, c].map((n) => [n.id, n])),
    liveText: new Map(),
    activeTreeId: 'tree-1',
  })
  useSelectionStore.setState({ selectedNodeId: 'b', focusNonce: 0 })
})

describe('ChatStreamView', () => {
  it('renders only the selected node lineage, not sibling branches', () => {
    render(<ChatStreamView />)
    expect(screen.getByText('first question')).toBeInTheDocument()
    expect(screen.getByText('second question')).toBeInTheDocument()
    expect(screen.queryByText('sibling branch')).not.toBeInTheDocument()
  })

  it('renders assistant markdown and token telemetry', () => {
    const { container } = render(<ChatStreamView />)
    expect(container.querySelector('strong')?.textContent).toBe('bold')
    expect(screen.getByText(/12 in · 34 out tokens/)).toBeInTheDocument()
  })

  it('clicking a past message selects and focuses that node', () => {
    render(<ChatStreamView />)
    fireEvent.click(screen.getByText('first question'))
    expect(useSelectionStore.getState().selectedNodeId).toBe('a')
    expect(useSelectionStore.getState().focusNonce).toBe(1)
  })

  it('shows an empty-state hint when nothing is selected', () => {
    useSelectionStore.setState({ selectedNodeId: null })
    useTreeStore.setState({ nodes: new Map() })
    render(<ChatStreamView />)
    expect(screen.getByText(/Select a node on the graph/)).toBeInTheDocument()
  })
})
