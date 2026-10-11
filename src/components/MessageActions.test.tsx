import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MessageActions } from './MessageActions'
import { useSettingsModalStore } from '../store/useSettingsModalStore'
import type { TurnNode } from '../types'

const submitPrompt = vi.fn(async () => () => {})
const cancelGeneration = vi.fn(async () => {})

vi.mock('../store/useTreeStore', () => ({
  useTreeStore: (selector: (s: unknown) => unknown) =>
    selector({ submitPrompt, cancelGeneration }),
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
  submitPrompt.mockClear()
  cancelGeneration.mockClear()
})

describe('MessageActions', () => {
  it('offers Stop while streaming and cancels the generation', () => {
    render(<MessageActions node={node({ status: 'streaming' })} />)
    fireEvent.click(screen.getByRole('button', { name: /stop/i }))
    expect(cancelGeneration).toHaveBeenCalledWith('n1')
  })

  it('offers Retry on an errored turn regardless of active state', async () => {
    render(<MessageActions node={node({ status: 'error', errorMessage: 'boom' })} isActive={false} />)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    await waitFor(() => expect(submitPrompt).toHaveBeenCalledWith('n1', 'ask something'))
  })

  it('offers Regenerate on the active idle turn', async () => {
    render(<MessageActions node={node({ status: 'idle' })} isActive />)
    fireEvent.click(screen.getByRole('button', { name: /regenerate/i }))
    await waitFor(() => expect(submitPrompt).toHaveBeenCalledWith('n1', 'ask something'))
  })

  it('stays out of the way on an inactive idle turn', () => {
    const { container } = render(<MessageActions node={node({ status: 'idle' })} isActive={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for a turn with no prompt (the tree root)', () => {
    const { container } = render(
      <MessageActions node={node({ userPrompt: '', status: 'idle' })} isActive />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it.each([
    'OpenRouter 401: {"error":{"message":"No auth credentials found"}}',
    'Ollama 403: forbidden',
    'Failed to fetch',
    'Load failed',
    'NetworkError when attempting to fetch resource.',
  ])('offers Check connection for %s, which opens Settings', (errorMessage) => {
    useSettingsModalStore.setState({ open: false })
    render(<MessageActions node={node({ status: 'error', errorMessage })} />)
    fireEvent.click(screen.getByRole('button', { name: /check connection/i }))
    expect(useSettingsModalStore.getState().open).toBe(true)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('does not offer Check connection for other errors', () => {
    render(<MessageActions node={node({ status: 'error', errorMessage: 'OpenRouter 429: rate limited' })} />)
    expect(screen.queryByRole('button', { name: /check connection/i })).not.toBeInTheDocument()
  })
})
