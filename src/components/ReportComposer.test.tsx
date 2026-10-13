import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReportComposer } from './ReportComposer'
import { useReportStore } from '../store/useReportStore'
import { useTreeStore } from '../store/useTreeStore'
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/settingsStore'
import { useCatalogStore } from '../store/catalogStore'
import { REPORT_BLOCK_MESSAGES } from '../lib/reportFit'
import type { ConversationTree, TurnNode } from '../types'

vi.mock('../lib/streamingClient', () => ({ streamLLMResponse: vi.fn() }))

function turn(id: string, parentId: string | null, childrenIds: string[] = [], answer = 'short'): TurnNode {
  return {
    id, treeId: 't', parentId, childrenIds, userPrompt: `prompt ${id}`, assistantResponse: answer,
    positionX: 0, positionY: 0, isCollapsed: false, status: 'idle', modelUsed: 'm', timestamp: 0,
  }
}

const tree: ConversationTree = {
  id: 't', title: 'T', rootNodeId: 'r', defaultSystemPrompt: '', createdAt: 0, updatedAt: 0,
  defaultProvider: 'openrouter', defaultModel: 'a/big',
}

function setNodes(answer = 'short') {
  const all = [turn('r', null, ['a', 'b'], answer), turn('a', 'r', [], answer), turn('b', 'r', [], answer)]
  useTreeStore.setState({ nodes: new Map(all.map((n) => [n.id, n])), trees: [tree], activeTreeId: 't' })
}

const fitText = () => screen.getByTestId('report-fit').textContent
const generateButton = () => screen.getByRole('button', { name: 'Generate report' })

describe('ReportComposer', () => {
  beforeEach(() => {
    setNodes()
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, openRouterApiKey: 'sk-or-x' } })
    useCatalogStore.setState({
      models: [
        { id: 'a/big', label: 'Big', inputPerM: 1, outputPerM: 2, tier: 'mid', contextWindow: 128_000 },
        { id: 'a/tiny', label: 'Tiny', inputPerM: 1, outputPerM: 2, tier: 'cheap', contextWindow: 8_000 },
        { id: 'a/nowin', label: 'No window', inputPerM: 1, outputPerM: 2, tier: 'mid' },
      ],
    })
    useReportStore.setState({ leafIds: [], includedIds: new Set(), selecting: true, error: null, generating: false })
  })

  it('Generate is disabled with nothing ticked', () => {
    render(<ReportComposer />)
    expect(screen.getByText('0 branches · 0 turns selected')).toBeTruthy()
    expect(generateButton()).toHaveProperty('disabled', true)
  })

  it('shows size against the window and an estimated cost when it fits', () => {
    useReportStore.setState({ leafIds: ['a', 'b'] })
    render(<ReportComposer />)
    expect(screen.getByText('2 branches · 3 turns selected')).toBeTruthy()
    expect(fitText()).toMatch(/^~\d+ tokens of 128k · est\. \$/)
    expect(generateButton()).toHaveProperty('disabled', false)
  })

  it('says too big and disables Generate when it does not fit', () => {
    setNodes('x'.repeat(40_000))
    useReportStore.setState({ leafIds: ['a', 'b'] })
    render(<ReportComposer />)
    fireEvent.change(screen.getByLabelText('Writer model (OpenRouter)'), { target: { value: 'a/tiny' } })
    expect(fitText()).toMatch(/^Too big for this model: ~\d+k tokens of 8k$/)
    expect(generateButton()).toHaveProperty('disabled', true)
  })

  it('says the limit is unknown when the catalog has no window', () => {
    useReportStore.setState({ leafIds: ['a'] })
    render(<ReportComposer />)
    fireEvent.change(screen.getByLabelText('Writer model (OpenRouter)'), { target: { value: 'a/nowin' } })
    expect(fitText()).toContain('limit unknown')
  })

  it('without a key it shows the no-key message and disables Generate', () => {
    useSettingsStore.setState({ settings: DEFAULT_SETTINGS })
    useReportStore.setState({ leafIds: ['a'] })
    render(<ReportComposer />)
    expect(fitText()).toBe(REPORT_BLOCK_MESSAGES['no-key'])
    expect(generateButton()).toHaveProperty('disabled', true)
  })

  it('Generate sends the edited brief and the picked model', () => {
    const generate = vi.fn().mockResolvedValue(undefined)
    useReportStore.setState({ leafIds: ['a'], generate })
    render(<ReportComposer />)
    fireEvent.change(screen.getByLabelText('Brief'), { target: { value: 'Just the risks.' } })
    fireEvent.click(generateButton())
    expect(generate).toHaveBeenCalledWith({ brief: 'Just the risks.', provider: 'openrouter', model: 'a/big' })
  })
})
