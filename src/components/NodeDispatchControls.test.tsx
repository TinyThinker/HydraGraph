import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NodeDispatchControls } from './NodeDispatchControls'
import type { TurnNode } from '../types'

const updateNode = vi.fn(async () => {})

vi.mock('../store/useTreeStore', () => ({
  useTreeStore: (selector: (s: unknown) => unknown) => selector({ updateNode }),
}))

function node(overrides: Partial<TurnNode>): TurnNode {
  return {
    id: 'n1',
    treeId: 't1',
    parentId: 'root',
    childrenIds: [],
    userPrompt: 'ask something',
    assistantResponse: 'an answer',
    positionX: 0,
    positionY: 0,
    isCollapsed: false,
    status: 'idle',
    modelUsed: 'gemini-2.5-flash',
    timestamp: 0,
    ...overrides,
  }
}

beforeEach(() => {
  updateNode.mockClear()
})

describe('NodeDispatchControls', () => {
  it('persists a provider override, using undefined for Inherit', () => {
    render(<NodeDispatchControls node={node({ providerOverride: 'openrouter' })} />)
    const select = screen.getByRole('combobox', { name: 'Provider' })
    fireEvent.change(select, { target: { value: 'ollama' } })
    expect(updateNode).toHaveBeenCalledWith('n1', { providerOverride: 'ollama' })

    fireEvent.change(select, { target: { value: '' } })
    expect(updateNode).toHaveBeenCalledWith('n1', { providerOverride: undefined })
  })

  it('commits the model field on blur', () => {
    render(<NodeDispatchControls node={node({})} />)
    const input = screen.getByLabelText('Model')
    fireEvent.change(input, { target: { value: 'gpt-4o-mini' } })
    fireEvent.blur(input)
    expect(updateNode).toHaveBeenCalledWith('n1', { modelUsed: 'gpt-4o-mini' })
  })

  it('applies a persona preset and can clear it', () => {
    const { rerender } = render(<NodeDispatchControls node={node({})} />)
    fireEvent.click(screen.getByRole('button', { name: 'Skeptic' }))
    expect(updateNode).toHaveBeenCalledWith(
      'n1',
      expect.objectContaining({ systemPromptOverride: expect.stringContaining('skeptic') }),
    )

    rerender(<NodeDispatchControls node={node({ systemPromptOverride: 'set' })} />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(updateNode).toHaveBeenCalledWith('n1', { systemPromptOverride: undefined })
  })

  it('disables inputs while the turn streams', () => {
    render(<NodeDispatchControls node={node({ status: 'streaming' })} />)
    expect(screen.getByLabelText('Model')).toBeDisabled()
  })
})
