import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { CompareView } from './CompareView'
import { useCompareStore } from '../store/useCompareStore'
import { useTreeStore } from '../store/useTreeStore'
import type { TurnNode } from '../types'

function createNode(overrides: Partial<TurnNode>): TurnNode {
  const id = overrides.id ?? crypto.randomUUID()
  return {
    id,
    treeId: 'tree-test',
    parentId: overrides.parentId ?? null,
    childrenIds: overrides.childrenIds ?? [],
    userPrompt: overrides.userPrompt ?? 'Shared prompt?',
    assistantResponse: overrides.assistantResponse ?? 'answer',
    positionX: 0,
    positionY: 0,
    isCollapsed: false,
    status: overrides.status ?? 'idle',
    modelUsed: overrides.modelUsed ?? 'gemini-2.5-flash',
    timestamp: overrides.timestamp ?? Date.now(),
    provider: overrides.provider ?? 'gemini',
  }
}

describe('CompareView', () => {
  beforeEach(() => {
    useTreeStore.setState({ nodes: new Map(), liveText: new Map(), activeTreeId: 'tree-test' })
    useCompareStore.setState({ open: false, anchorId: null, excludedIds: new Set() })
  })

  it('renders every sibling column and the shared-context guarantee line', async () => {
    const parent = createNode({ id: 'p', parentId: null })
    const a = createNode({ id: 'a', parentId: 'p', modelUsed: 'gemini-2.5-flash', timestamp: 1 })
    const b = createNode({ id: 'b', parentId: 'p', modelUsed: 'openai/gpt-4o', timestamp: 2 })
    useTreeStore.setState({ nodes: new Map([['p', parent], ['a', a], ['b', b]]) })

    await act(async () => {
      useCompareStore.getState().openCompare('a')
    })
    render(<CompareView />)

    expect(screen.getAllByText('gemini-2.5-flash').length).toBeGreaterThan(0)
    expect(screen.getAllByText('openai/gpt-4o').length).toBeGreaterThan(0)
    expect(screen.getByText(/inherit the same context/)).toBeInTheDocument()
  })

  it('drops a column when its sibling checkbox is unchecked', async () => {
    const parent = createNode({ id: 'p' })
    const a = createNode({ id: 'a', parentId: 'p', modelUsed: 'model-alpha', assistantResponse: 'ALPHA_BODY', timestamp: 1 })
    const b = createNode({ id: 'b', parentId: 'p', modelUsed: 'model-beta', assistantResponse: 'BETA_BODY', timestamp: 2 })
    useTreeStore.setState({ nodes: new Map([['p', parent], ['a', a], ['b', b]]) })

    await act(async () => {
      useCompareStore.getState().openCompare('a')
    })
    render(<CompareView />)

    expect(screen.getByText('ALPHA_BODY')).toBeInTheDocument()
    expect(screen.getByText('BETA_BODY')).toBeInTheDocument()

    const betaCheckbox = screen.getByLabelText('model-beta')
    fireEvent.click(betaCheckbox)

    expect(screen.getByText('ALPHA_BODY')).toBeInTheDocument()
    expect(screen.queryByText('BETA_BODY')).not.toBeInTheDocument()
  })
})
