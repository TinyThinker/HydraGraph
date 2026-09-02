import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from 'react'
import { FanOutModal } from './FanOutModal'
import { useTreeStore } from '../store/useTreeStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { db } from '../db/ChatDatabase'

vi.mock('../lib/streamingClient', () => ({
  streamLLMResponse: vi.fn(
    async (
      _payload: unknown,
      _settings: unknown,
      _target: unknown,
      _onToken: (t: string) => void,
      onDone: (u: { inputTokens: number; outputTokens: number }) => void,
    ) => {
      onDone({ inputTokens: 0, outputTokens: 0 })
      return () => {}
    },
  ),
}))

describe('FanOutModal', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    useTreeStore.setState({ nodes: new Map(), trees: [], activeTreeId: null, liveText: new Map() })
    useSelectionStore.setState({ selectedNodeId: null, focusNonce: 0 })
  })

  it('dispatches a fan-out into N sibling branches off the active node', async () => {
    const tree = await useTreeStore.getState().createTree('T')
    const rootId = tree.rootNodeId
    useSelectionStore.setState({ selectedNodeId: rootId, focusNonce: 0 })

    render(<FanOutModal open onClose={() => {}} />)

    // Start at 2 rows, add one -> 3
    fireEvent.click(screen.getByRole('button', { name: /Add variant/ }))
    expect(screen.getByTestId('fanout-dispatch')).toHaveTextContent('Dispatch 3 branches')

    fireEvent.change(screen.getByTestId('fanout-prompt'), { target: { value: 'compare these' } })

    await act(async () => {
      fireEvent.click(screen.getByTestId('fanout-dispatch'))
    })

    await waitFor(() => {
      const nodes = [...useTreeStore.getState().nodes.values()]
      const children = nodes.filter((n) => n.parentId === rootId)
      expect(children).toHaveLength(3)
    })
  })
})
