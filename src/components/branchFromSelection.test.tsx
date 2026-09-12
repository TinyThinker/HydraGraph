import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from 'react'
import { ChatStreamView } from './ChatStreamView'
import { ChatInputBar } from './ChatInputBar'
import { SelectionBranchButton } from './SelectionBranchButton'
import { useTreeStore } from '../store/useTreeStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { useComposerStore } from '../store/useComposerStore'
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

const ANSWER = 'LSM trees trade read amplification for write throughput.'

const root = node({ id: 'r', childrenIds: ['a'], userPrompt: 'storage engines?', assistantResponse: 'Two families dominate.' })
const answer = node({ id: 'a', parentId: 'r', userPrompt: 'which for ingest?', assistantResponse: ANSWER })

/** Select the text of the element containing `text` and notify listeners. */
function selectTextOf(text: string) {
  const el = screen.getByText(text)
  const range = document.createRange()
  range.selectNodeContents(el)
  const sel = window.getSelection()!
  sel.removeAllRanges()
  sel.addRange(range)
  act(() => {
    document.dispatchEvent(new Event('selectionchange'))
  })
}

function clearSelection() {
  window.getSelection()!.removeAllRanges()
  act(() => {
    document.dispatchEvent(new Event('selectionchange'))
  })
}

describe('branch from a selected passage', () => {
  beforeEach(() => {
    useTreeStore.setState({
      nodes: new Map([
        ['r', root],
        ['a', answer],
      ]),
      liveText: new Map(),
      activeTreeId: 'tree-1',
    })
    useSelectionStore.setState({ selectedNodeId: 'a', focusNonce: 0 })
    useComposerStore.setState({ draft: '', focusNonce: 0 })
  })

  it('offers no affordance until something inside a turn is selected', () => {
    render(
      <>
        <ChatStreamView />
        <SelectionBranchButton />
      </>,
    )
    expect(screen.queryByTestId('branch-on-selection')).not.toBeInTheDocument()
  })

  it('shows the affordance for a passage inside a turn', () => {
    render(
      <>
        <ChatStreamView />
        <SelectionBranchButton />
      </>,
    )
    selectTextOf(ANSWER)
    expect(screen.getByTestId('branch-on-selection')).toBeInTheDocument()
  })

  it('hides again when the selection is cleared', () => {
    render(
      <>
        <ChatStreamView />
        <SelectionBranchButton />
      </>,
    )
    selectTextOf(ANSWER)
    expect(screen.getByTestId('branch-on-selection')).toBeInTheDocument()

    clearSelection()
    expect(screen.queryByTestId('branch-on-selection')).not.toBeInTheDocument()
  })

  it('seeds the composer with the passage', () => {
    render(
      <>
        <ChatStreamView />
        <ChatInputBar />
        <SelectionBranchButton />
      </>,
    )

    selectTextOf(ANSWER)
    fireEvent.click(screen.getByTestId('branch-on-selection'))

    expect(useComposerStore.getState().draft).toBe(`> ${ANSWER}\n\n`)
    expect(screen.getByTestId('chat-input')).toHaveValue(`> ${ANSWER}\n\n`)
  })

  it('moves the active node to the turn the passage came from', () => {
    // 'a' is active, so the stream renders root -> a and both answers are on
    // screen. Branching on the ANCESTOR's text must retarget the fork to it,
    // rather than forking off whatever was selected.
    render(
      <>
        <ChatStreamView />
        <ChatInputBar />
        <SelectionBranchButton />
      </>,
    )
    expect(useSelectionStore.getState().selectedNodeId).toBe('a')

    selectTextOf('Two families dominate.')
    fireEvent.click(screen.getByTestId('branch-on-selection'))

    expect(useSelectionStore.getState().selectedNodeId).toBe('r')
    expect(useComposerStore.getState().draft).toBe('> Two families dominate.\n\n')
  })

  it('keeps text already typed, below the quote', () => {
    useComposerStore.setState({ draft: 'my half-written question', focusNonce: 0 })

    render(
      <>
        <ChatStreamView />
        <SelectionBranchButton />
      </>,
    )

    selectTextOf(ANSWER)
    fireEvent.click(screen.getByTestId('branch-on-selection'))

    expect(useComposerStore.getState().draft).toBe(`> ${ANSWER}\n\nmy half-written question`)
  })

  it('submits the quoted prompt as a new branch off that turn', async () => {
    const forkAndSubmit = vi.fn(async () => 'child-1')
    useTreeStore.setState({ forkAndSubmit } as never)

    render(
      <>
        <ChatStreamView />
        <ChatInputBar />
        <SelectionBranchButton />
      </>,
    )

    selectTextOf(ANSWER)
    fireEvent.click(screen.getByTestId('branch-on-selection'))

    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: `> ${ANSWER}\n\nwhat about reads?` } })
    fireEvent.click(screen.getByTestId('chat-send'))

    await waitFor(() =>
      expect(forkAndSubmit).toHaveBeenCalledWith('a', `> ${ANSWER}\n\nwhat about reads?`),
    )
    // Composer empties so the next prompt starts clean.
    await waitFor(() => expect(useComposerStore.getState().draft).toBe(''))
  })

  it('ignores selections outside any turn', () => {
    render(
      <>
        <div>unrelated chrome text</div>
        <ChatStreamView />
        <SelectionBranchButton />
      </>,
    )

    selectTextOf('unrelated chrome text')
    expect(screen.queryByTestId('branch-on-selection')).not.toBeInTheDocument()
  })
})
