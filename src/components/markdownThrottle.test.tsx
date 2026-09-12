import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { ChatStreamView } from './ChatStreamView'
import { useTreeStore } from '../store/useTreeStore'
import { useSelectionStore } from '../store/useSelectionStore'
import {
  enableRenderTally,
  disableRenderTally,
  resetRenderTally,
  getMarkdownParseCount,
} from '../lib/renderTally'
import { MARKDOWN_THROTTLE_MS } from './useThrottledText'
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

const TOKENS = 40
/** Spacing between simulated deltas — roughly a fast model's real token rate. */
const TOKEN_GAP_MS = 15

describe('streaming Markdown is parsed on a throttle, not per token', () => {
  beforeEach(() => {
    const root = node({ id: 'r', childrenIds: ['a'], userPrompt: 'q', assistantResponse: 'a' })
    const streaming = node({ id: 'a', parentId: 'r', userPrompt: 'deep question', status: 'streaming' })
    useTreeStore.setState({
      nodes: new Map([
        ['r', root],
        ['a', streaming],
      ]),
      liveText: new Map(),
      activeTreeId: 'tree-1',
    })
    useSelectionStore.setState({ selectedNodeId: 'a', focusNonce: 0 })
    resetRenderTally()
  })

  it('parses far fewer times than tokens received', async () => {
    render(<ChatStreamView />)

    enableRenderTally()
    resetRenderTally()

    // Pace the deltas so the run spans several throttle windows — a burst that
    // fits inside a single window would pass trivially.
    for (let i = 0; i < TOKENS; i++) {
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        useTreeStore.getState().appendTokenDelta('a', `word${i} `)
        await new Promise((r) => setTimeout(r, TOKEN_GAP_MS))
      })
    }

    const parsesDuringStream = getMarkdownParseCount()
    disableRenderTally()

    // Unthrottled this was one full-document parse per token. Throttled it is
    // bounded by elapsed time, not token count: roughly
    // (TOKENS * TOKEN_GAP_MS) / MARKDOWN_THROTTLE_MS windows, plus slack for
    // timer jitter under jsdom.
    const windows = Math.ceil((TOKENS * TOKEN_GAP_MS) / MARKDOWN_THROTTLE_MS)
    expect(parsesDuringStream).toBeGreaterThan(0)
    expect(parsesDuringStream).toBeLessThanOrEqual(windows + 3)
    expect(parsesDuringStream).toBeLessThan(TOKENS / 2)
  })

  it('publishes the exact final text as soon as streaming stops', async () => {
    render(<ChatStreamView />)

    await act(async () => {
      useTreeStore.getState().appendTokenDelta('a', '# Heading\n\nbody text')
    })

    // Mid-stream the settled value may still be catching up; finishing must
    // publish the real text immediately, not one throttle window later.
    await act(async () => {
      await useTreeStore.getState().finalizeNode('a', { inputTokens: 1, outputTokens: 2 })
    })

    expect(useTreeStore.getState().liveText.has('a')).toBe(false)
    expect(await screen.findByText('Heading')).toBeInTheDocument()
    expect(screen.getByText('body text')).toBeInTheDocument()
  })

  it('settles in-flight text within one throttle window', async () => {
    render(<ChatStreamView />)

    await act(async () => {
      useTreeStore.getState().appendTokenDelta('a', 'streaming words here')
      await new Promise((r) => setTimeout(r, MARKDOWN_THROTTLE_MS * 2))
    })

    expect(screen.getByText(/streaming words here/)).toBeInTheDocument()
  })
})
