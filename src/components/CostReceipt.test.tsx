import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CostReceipt } from './CostReceipt'
import { COUNTERFACTUAL_NOTE, COUNTERFACTUAL_DETAIL, ACTUAL_DETAIL } from '../lib/treeCost'
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

  // Prompts and responses are long on purpose: the saving row only appears
  // once the modelled linear thread is dearer than real spend, which a
  // two-character transcript never is.
  const PROMPT = 'u'.repeat(400)
  const RESPONSE = 'a'.repeat(4000)

  function threePricedTurns() {
    const turns = ['a', 'b', 'c'].map((id, i) =>
      node({
        id,
        parentId: i === 0 ? null : 'a',
        childrenIds: i === 0 ? ['b', 'c'] : [],
        timestamp: i + 1,
        userPrompt: PROMPT,
        assistantResponse: RESPONSE,
        inputTokens: 150,
        outputTokens: 1000,
      }),
    )
    useTreeStore.setState({ nodes: new Map(turns.map((n) => [n.id, n])) })
  }

  it('renders the three receipt rows for priced turns', () => {
    threePricedTurns()

    render(<CostReceipt />)
    expect(screen.getByText(/This tree · 3 turns · 1 forks/)).toBeInTheDocument()
    expect(screen.getByText(/Same 3 turns, one linear thread/)).toBeInTheDocument()
    expect(screen.getByText(/Context you didn't pay for/)).toBeInTheDocument()
  })

  it('shows a muted message when there are no priced turns', () => {
    render(<CostReceipt />)
    expect(screen.getByText('No priced turns yet.')).toBeInTheDocument()
  })

  // The measured row and the modelled row used to render identically, which
  // let "you saved $X" borrow the authority of "this tree cost $Y".
  describe('separates the measured number from the estimated one', () => {
    it('marks the linear-thread row as an estimate', () => {
      threePricedTurns()
      render(<CostReceipt />)
      expect(screen.getByText('(est.)')).toBeInTheDocument()
    })

    it('prefixes every estimate-derived figure with ~ and leaves the measured one bare', () => {
      threePricedTurns()
      const { container } = render(<CostReceipt />)
      const text = container.textContent ?? ''

      // The counterfactual, the saved dollars and the saved percentage all
      // descend from the estimate; the tree's own cost does not.
      expect(text).toMatch(/~\$\d/)
      expect(text).toMatch(/~\d+%/)
      expect(text).not.toMatch(/forks\s*~\$/)
    })

    it('states the assumptions in the panel, not only on hover', () => {
      threePricedTurns()
      render(<CostReceipt />)
      expect(screen.getByText(COUNTERFACTUAL_NOTE)).toBeInTheDocument()
      expect(screen.getByText(COUNTERFACTUAL_NOTE).textContent).toMatch(/no prompt caching/)
    })

    it('carries the full caveat as a tooltip on both estimate rows', () => {
      threePricedTurns()
      render(<CostReceipt />)
      const estimateRow = screen.getByText(/Same 3 turns, one linear thread/).closest('div')
      const savedRow = screen.getByText(/Context you didn't pay for/).closest('div')

      expect(estimateRow).toHaveAttribute('title', COUNTERFACTUAL_DETAIL)
      expect(savedRow).toHaveAttribute('title', COUNTERFACTUAL_DETAIL)
    })

    it('says the measured row is measured', () => {
      threePricedTurns()
      render(<CostReceipt />)
      const actualRow = screen.getByText(/This tree · 3 turns/).closest('div')
      expect(actualRow).toHaveAttribute('title', ACTUAL_DETAIL)
    })

    it('shows no estimate caveat when there is nothing priced to estimate from', () => {
      render(<CostReceipt />)
      expect(screen.queryByText(COUNTERFACTUAL_NOTE)).not.toBeInTheDocument()
    })

    // A shallow tree re-sends almost nothing, so the modelled linear thread
    // can undercut real spend. This used to render as "~$-0.0000 saved ·
    // ~-12%" in emerald, under the heading "Context you didn't pay for".
    it('never claims a negative saving', () => {
      const a = node({ id: 'a', userPrompt: 'q1', assistantResponse: 'a1', inputTokens: 100, outputTokens: 200 })
      const b = node({ id: 'b', parentId: 'a', timestamp: 2, userPrompt: 'q2', assistantResponse: 'a2', inputTokens: 100, outputTokens: 200 })
      useTreeStore.setState({ nodes: new Map([a, b].map((n) => [n.id, n])) })

      const { container } = render(<CostReceipt />)
      const text = container.textContent ?? ''

      expect(text).not.toMatch(/-\$/)
      expect(text).not.toMatch(/-\d+%/)
      expect(screen.queryByText(/Context you didn't pay for/)).not.toBeInTheDocument()
      expect(screen.getByText(/No saving to show yet/)).toBeInTheDocument()
    })

    it('still reports the measured spend when there is no saving to claim', () => {
      const a = node({ id: 'a', userPrompt: 'q1', assistantResponse: 'a1', inputTokens: 100, outputTokens: 200 })
      useTreeStore.setState({ nodes: new Map([['a', a]]) })

      render(<CostReceipt />)
      expect(screen.getByText(/This tree · 1 turns/)).toBeInTheDocument()
    })
  })

  // Regression: an errored turn used to be reported as "unknown model
  // pricing", sending people to the model picker to fix a failed request.
  it('names the real reason a turn was excluded', () => {
    const ok = node({ id: 'ok', userPrompt: 'q', assistantResponse: 'a', inputTokens: 100, outputTokens: 200 })
    const errored = node({ id: 'err', timestamp: 2, userPrompt: 'never finished' })
    const unlisted = node({
      id: 'unlisted',
      timestamp: 3,
      userPrompt: 'q',
      assistantResponse: 'a',
      modelUsed: 'some-unlisted-model-v9',
      inputTokens: 100,
      outputTokens: 200,
    })
    useTreeStore.setState({ nodes: new Map([ok, errored, unlisted].map((n) => [n.id, n])) })

    render(<CostReceipt />)
    expect(screen.getByText('1 turn excluded — no token counts recorded')).toBeInTheDocument()
    expect(screen.getByText('1 turn excluded — unknown model pricing')).toBeInTheDocument()
  })

  it('pluralises and omits the lines that do not apply', () => {
    const ok = node({ id: 'ok', userPrompt: 'q', assistantResponse: 'a', inputTokens: 100, outputTokens: 200 })
    const e1 = node({ id: 'e1', timestamp: 2, userPrompt: 'unfinished' })
    const e2 = node({ id: 'e2', timestamp: 3, userPrompt: 'also unfinished' })
    useTreeStore.setState({ nodes: new Map([ok, e1, e2].map((n) => [n.id, n])) })

    render(<CostReceipt />)
    expect(screen.getByText('2 turns excluded — no token counts recorded')).toBeInTheDocument()
    expect(screen.queryByText(/unknown model pricing/)).not.toBeInTheDocument()
  })
})
