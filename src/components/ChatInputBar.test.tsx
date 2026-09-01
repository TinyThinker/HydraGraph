import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatInputBar } from './ChatInputBar'
import { useSelectionStore } from '../store/useSelectionStore'

const forkAndSubmit = vi.fn(async () => 'child-9')

vi.mock('../store/useTreeStore', () => ({
  useTreeStore: (selector: (s: unknown) => unknown) =>
    selector({ forkAndSubmit, nodes: new Map() }),
}))

beforeEach(() => {
  forkAndSubmit.mockClear()
  useSelectionStore.setState({ selectedNodeId: 'root-1', focusNonce: 0 })
})

describe('ChatInputBar', () => {
  it('forks a child off the active node and shifts selection to it', async () => {
    render(<ChatInputBar />)
    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'hello there' } })
    fireEvent.click(screen.getByTestId('chat-send'))

    await waitFor(() => expect(forkAndSubmit).toHaveBeenCalledWith('root-1', 'hello there'))
    await waitFor(() => expect(useSelectionStore.getState().selectedNodeId).toBe('child-9'))
    expect(useSelectionStore.getState().focusNonce).toBe(1)
  })

  it('does not submit blank input', () => {
    render(<ChatInputBar />)
    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: '   ' } })
    fireEvent.click(screen.getByTestId('chat-send'))
    expect(forkAndSubmit).not.toHaveBeenCalled()
  })

  it('submits on Enter without Shift', async () => {
    render(<ChatInputBar />)
    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'via enter' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => expect(forkAndSubmit).toHaveBeenCalledWith('root-1', 'via enter'))
  })
})
