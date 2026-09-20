import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { TurnNodeComponent } from './TurnNode'
import { useTreeStore } from '../store/useTreeStore'
import { useSettingsStore } from '../store/settingsStore'
import type { TurnNode } from '../types'

vi.mock('../lib/streamingClient', () => ({ streamLLMResponse: vi.fn() }))

const DEFAULT_MODEL = 'openai/gpt-4o-mini'

function node(over: Partial<TurnNode>): TurnNode {
  return {
    id: 'n',
    treeId: 't',
    parentId: 'root',
    childrenIds: [],
    userPrompt: '',
    assistantResponse: '',
    positionX: 0,
    positionY: 0,
    isCollapsed: false,
    status: 'idle',
    modelUsed: DEFAULT_MODEL,
    timestamp: 1,
    ...over,
  }
}

function renderPill(n: TurnNode) {
  useTreeStore.setState({ nodes: new Map([[n.id, n]]), activeTreeId: 't' })
  return render(
    <ReactFlowProvider>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <TurnNodeComponent {...({ data: n, selected: false } as any)} />
    </ReactFlowProvider>,
  )
}

/** The element carrying the summary text, whose clamp/truncate class is the subject. */
function summaryEl(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll('div')).find(
    (el) => el.children.length === 0 && (el.textContent ?? '').trim() === text,
  )
}

describe('station pill label', () => {
  beforeEach(() => {
    useSettingsStore.setState((s) => ({
      settings: { ...s.settings, defaultModel: DEFAULT_MODEL },
    }))
  })

  // The pill is 72px tall and spent 27.5px of it, while CSS `truncate` threw
  // away 40-60% of every label `stationSummary` produced.
  it('gives the summary two lines when there is nothing to disambiguate', () => {
    const text = 'what are the load bearing assumptions in this design'
    const { container } = renderPill(node({ userPrompt: text }))

    const el = summaryEl(container, text)
    expect(el).toBeDefined()
    expect(el!.className).toContain('line-clamp-2')
    expect(el!.className).not.toContain('truncate')
  })

  // Fan-out siblings share one prompt by construction, so the model is the
  // only thing that tells them apart. It gets its own row — role + two summary
  // lines + model is 55px of the pill's 72, so the summary keeps both lines.
  it('names the model when this turn departs from the default, without costing the summary a line', () => {
    const text = 'which tenant dominates the write volume'
    const { container } = renderPill(
      node({ userPrompt: text, modelUsed: 'anthropic/claude-3.7-sonnet' }),
    )

    expect(screen.getByText('anthropic/claude-3.7-sonnet')).toBeInTheDocument()
    expect(summaryEl(container, text)!.className).toContain('line-clamp-2')
  })

  it('shows no model line for a turn that simply inherits the default', () => {
    renderPill(node({ userPrompt: 'a question', modelUsed: DEFAULT_MODEL }))
    expect(screen.queryByText(DEFAULT_MODEL)).not.toBeInTheDocument()
  })

  it('marks a locally-run turn as ollama', () => {
    renderPill(node({ userPrompt: 'a question', providerOverride: 'ollama', modelUsed: 'llama3' }))
    expect(screen.getByText('ollama/llama3')).toBeInTheDocument()
  })

  // slate-500 failed WCAG AA even undimmed (3.75:1); slate-400 gives 6.96:1.
  it('renders the role label at an accessible weight', () => {
    renderPill(node({ userPrompt: 'a question' }))
    const role = screen.getByText('You').parentElement!
    expect(role.className).toContain('text-slate-400')
    expect(role.className).not.toContain('text-slate-500')
  })

  // The label described where the branch came from, never what it asked.
  it('labels a quote-seeded branch with the question, not the quoted passage', () => {
    renderPill(
      node({ userPrompt: '> Pillar 5: The Guarded Boundary\n\nhow do I verify this in CI' }),
    )
    expect(screen.getByText('how do I verify this in CI')).toBeInTheDocument()
    expect(screen.queryByText(/Pillar 5/)).not.toBeInTheDocument()
  })
})
