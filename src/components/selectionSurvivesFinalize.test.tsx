import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { SplitLayout } from './SplitLayout'
import { useTreeStore } from '../store/useTreeStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/settingsStore'
import { db } from '../db/ChatDatabase'

/**
 * Regression: the chat pane used to blank the instant a response finished.
 *
 * `selected` was written into React Flow imperatively (setNodes) while
 * useCanvasGraph rebuilt every wrapper whenever the store's node map changed
 * identity. finalizeNode changes that map, so the rebuilt wrappers dropped the
 * flag, React Flow fired onSelectionChange with [], CanvasSelectionSync wrote
 * selectedNodeId = null, and useActiveNodeId fell back to the empty root.
 *
 * Token deltas only touch `liveText`, never `nodes`, which is why streaming
 * looked fine right up to the moment it completed.
 */

/** An SSE stream the test can hold open, push into, then close. */
function controllableFetch() {
  const queue: string[] = []
  let waiter: (() => void) | null = null
  let closed = false

  const push = (s: string) => {
    queue.push(s)
    waiter?.()
    waiter = null
  }
  const finish = () => {
    closed = true
    waiter?.()
    waiter = null
  }

  const reader = {
    async read(): Promise<{ done: boolean; value?: Uint8Array }> {
      while (queue.length === 0 && !closed) {
        await new Promise<void>((r) => {
          waiter = r
        })
      }
      const next = queue.shift()
      if (next === undefined) return { done: true, value: undefined }
      return { done: false, value: new TextEncoder().encode(next) }
    },
  }

  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    text: async () => '',
    body: { getReader: () => reader },
  }))

  return { fetchMock, push, finish }
}

const settle = (ms = 60) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })

describe('selection survives a finished generation', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, openRouterApiKey: 'k' },
      hydrated: true,
    })
    useTreeStore.setState({
      nodes: new Map(),
      trees: [],
      activeTreeId: null,
      liveText: new Map(),
      lastSpawnedNodeId: null,
    })
    useSelectionStore.setState({ selectedNodeId: null, focusNonce: 0 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('keeps the finished answer on screen without re-selecting the node', async () => {
    const tree = await useTreeStore.getState().createTree('T')
    const { fetchMock, push, finish } = controllableFetch()
    vi.stubGlobal('fetch', fetchMock)

    render(
      <ReactFlowProvider>
        <SplitLayout />
      </ReactFlowProvider>,
    )
    await settle()

    let childId: string | null = null
    await act(async () => {
      childId = await useTreeStore.getState().forkAndSubmit(tree.rootNodeId, 'why?')
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(childId).not.toBeNull()

    // Mid-stream: the node is selected and its tokens are on screen.
    await act(async () => {
      push('data: {"choices":[{"delta":{"content":"Hello streamed answer"}}]}\n\n')
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(useSelectionStore.getState().selectedNodeId).toBe(childId)
    expect(screen.getByText(/Hello streamed answer/)).toBeInTheDocument()

    // Finish the stream. finalizeNode replaces the node object in the map.
    await act(async () => {
      push('data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":5,"completion_tokens":3}}\n\n')
      push('data: [DONE]\n\n')
      finish()
      await new Promise((r) => setTimeout(r, 80))
    })

    // The selection must survive, and the answer must still be rendered
    // WITHOUT the user clicking away and back.
    expect(useSelectionStore.getState().selectedNodeId).toBe(childId)
    expect(useTreeStore.getState().nodes.get(childId!)!.assistantResponse).toBe(
      'Hello streamed answer',
    )
    expect(screen.getByText(/Hello streamed answer/)).toBeInTheDocument()
    expect(screen.queryByText(/Select a node on the graph/)).not.toBeInTheDocument()
  })

  it('survives any other store write that replaces the node map', async () => {
    const tree = await useTreeStore.getState().createTree('T')
    const rootId = tree.rootNodeId

    render(
      <ReactFlowProvider>
        <SplitLayout />
      </ReactFlowProvider>,
    )
    await settle()

    act(() => {
      useSelectionStore.getState().selectAndFocus(rootId)
    })
    await settle()
    expect(useSelectionStore.getState().selectedNodeId).toBe(rootId)

    // A plain node update hands the map a new identity, same as finalizeNode.
    await act(async () => {
      await useTreeStore.getState().updateNode(rootId, { userPrompt: 'edited' })
      await new Promise((r) => setTimeout(r, 40))
    })

    expect(useSelectionStore.getState().selectedNodeId).toBe(rootId)
  })

  it('marks the selected node selected on the canvas without an imperative setNodes', async () => {
    const tree = await useTreeStore.getState().createTree('T')
    const rootId = tree.rootNodeId

    const { container } = render(
      <ReactFlowProvider>
        <SplitLayout />
      </ReactFlowProvider>,
    )
    await settle()

    act(() => {
      useSelectionStore.getState().selectAndFocus(rootId)
    })
    await settle()

    const el = container.querySelector(`.react-flow__node[data-id="${rootId}"]`)
    expect(el).not.toBeNull()
    expect(el!.classList.contains('selected')).toBe(true)

    // ...and it stays selected across a node-map rewrite.
    await act(async () => {
      await useTreeStore.getState().updateNode(rootId, { userPrompt: 'edited' })
      await new Promise((r) => setTimeout(r, 40))
    })
    const after = container.querySelector(`.react-flow__node[data-id="${rootId}"]`)
    expect(after!.classList.contains('selected')).toBe(true)
  })
})
