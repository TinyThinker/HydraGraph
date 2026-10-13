import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useReportStore } from './useReportStore'
import { useTreeStore } from './useTreeStore'
import { useSettingsStore, DEFAULT_SETTINGS } from './settingsStore'
import { useCatalogStore } from './catalogStore'
import { streamLLMResponse } from '../lib/streamingClient'
import { REPORT_BLOCK_MESSAGES } from '../lib/reportFit'
import { db } from '../db/ChatDatabase'
import type { ConversationTree, TokenUsage, TurnNode } from '../types'

vi.mock('../lib/streamingClient', () => ({ streamLLMResponse: vi.fn() }))

function turn(id: string, parentId: string | null, childrenIds: string[] = []): TurnNode {
  return {
    id, treeId: 't', parentId, childrenIds, userPrompt: id, assistantResponse: '',
    positionX: 0, positionY: 0, isCollapsed: false, status: 'idle', modelUsed: 'm', timestamp: 0,
  }
}

// r → a → (b1, b2)
const nodes = new Map(
  [turn('r', null, ['a']), turn('a', 'r', ['b1', 'b2']), turn('b1', 'a'), turn('b2', 'a')].map((n) => [n.id, n]),
)

describe('useReportStore selection', () => {
  beforeEach(() => {
    useTreeStore.setState({ nodes })
    useReportStore.setState({ selecting: false, leafIds: [], includedIds: new Set() })
  })

  it('ticking two leaves with a shared trunk includes the union of their paths', () => {
    const { startSelecting, toggle } = useReportStore.getState()
    startSelecting()
    toggle('b1')
    toggle('b2')
    const s = useReportStore.getState()
    expect(s.leafIds).toEqual(['b1', 'b2'])
    expect([...s.includedIds].sort()).toEqual(['a', 'b1', 'b2', 'r'])
  })

  it('toggling a leaf again removes it and its unshared path', () => {
    const { toggle } = useReportStore.getState()
    toggle('b1')
    toggle('b2')
    toggle('b2')
    expect([...useReportStore.getState().includedIds].sort()).toEqual(['a', 'b1', 'r'])
  })

  it('returns new references on every toggle (immutable updates)', () => {
    const before = useReportStore.getState()
    before.toggle('b1')
    const after = useReportStore.getState()
    expect(after.leafIds).not.toBe(before.leafIds)
    expect(after.includedIds).not.toBe(before.includedIds)
  })

  it('startSelecting can pre-tick leaves; clear and stop reset', () => {
    useReportStore.getState().startSelecting(['b2'])
    expect(useReportStore.getState()).toMatchObject({ selecting: true, leafIds: ['b2'] })
    useReportStore.getState().clear()
    expect(useReportStore.getState().includedIds.size).toBe(0)
    useReportStore.getState().stopSelecting()
    expect(useReportStore.getState().selecting).toBe(false)
  })
})

describe('useReportStore.generate', () => {
  const KEYED = { ...DEFAULT_SETTINGS, openRouterApiKey: 'sk-or-test' }
  const opts = { brief: 'Write it.', provider: 'openrouter' as const, model: 'a/big' }
  type Handlers = { onToken: (c: string) => void; onDone: (u: TokenUsage) => void; onError: (e: Error) => void }
  let handlers: Handlers
  const abort = vi.fn()

  const savedReports = () => useTreeStore.getState().trees.find((t) => t.id === 't')?.reports ?? []

  beforeEach(async () => {
    await db.delete()
    await db.open()
    const tree: ConversationTree = { id: 't', title: 'T', rootNodeId: 'r', defaultSystemPrompt: '', createdAt: 0, updatedAt: 0 }
    await db.trees.add(tree)
    useTreeStore.setState({ nodes, trees: [tree], activeTreeId: 't', liveText: new Map() })
    useSettingsStore.setState({ settings: KEYED })
    useCatalogStore.setState({
      models: [
        { id: 'a/big', label: 'Big', inputPerM: 1, outputPerM: 2, tier: 'mid', contextWindow: 128_000 },
        { id: 'a/tiny', label: 'Tiny', inputPerM: 1, outputPerM: 2, tier: 'cheap', contextWindow: 8_000 },
      ],
    })
    useReportStore.setState({ leafIds: ['b1', 'b2'], generating: false, liveText: null, error: null, activeReportId: null })
    abort.mockReset()
    vi.mocked(streamLLMResponse).mockReset()
    vi.mocked(streamLLMResponse).mockImplementation(async (_p, _s, _t, onToken, onDone, onError) => {
      handlers = { onToken, onDone, onError }
      return abort
    })
  })

  it('done saves the record with tokens, digest and title', async () => {
    await useReportStore.getState().generate(opts)
    expect(useReportStore.getState().generating).toBe(true)
    handlers.onToken('# Findings\n\nBody')
    handlers.onDone({ inputTokens: 900, outputTokens: 120 })
    await vi.waitFor(() => expect(savedReports()).toHaveLength(1))

    const [report] = savedReports()
    expect(report).toMatchObject({
      title: 'Findings', text: '# Findings\n\nBody', status: 'idle', inputTokens: 900, outputTokens: 120,
      leafIds: ['b1', 'b2'], brief: 'Write it.', model: 'a/big',
    })
    expect(report.sourceDigest).toMatch(/^[0-9a-f]{8}$/)
    expect(useReportStore.getState()).toMatchObject({ generating: false, liveText: null, activeReportId: report.id })
    expect((await db.trees.get('t'))!.reports).toHaveLength(1)
  })

  it('an error saves an error record with the partial text', async () => {
    await useReportStore.getState().generate(opts)
    handlers.onToken('partial')
    handlers.onError(new Error('OpenRouter 500: boom'))
    await vi.waitFor(() => expect(savedReports()).toHaveLength(1))
    expect(savedReports()[0]).toMatchObject({ status: 'error', errorMessage: 'OpenRouter 500: boom', text: 'partial' })
  })

  it('a selection too big for the model never calls the stream', async () => {
    useTreeStore.setState({
      nodes: new Map([...nodes].map(([id, n]) => [id, { ...n, assistantResponse: 'x'.repeat(40_000) }])),
    })
    await useReportStore.getState().generate({ ...opts, model: 'a/tiny' })
    expect(streamLLMResponse).not.toHaveBeenCalled()
    expect(useReportStore.getState().error).toMatch(/^Too big for a\/tiny: ~[\d,]+ tokens, limit 8,000$/)
  })

  it('Ollama and a missing key never call the stream', async () => {
    await useReportStore.getState().generate({ ...opts, provider: 'ollama' })
    expect(useReportStore.getState().error).toBe(REPORT_BLOCK_MESSAGES.ollama)
    useSettingsStore.setState({ settings: DEFAULT_SETTINGS })
    await useReportStore.getState().generate(opts)
    expect(useReportStore.getState().error).toBe(REPORT_BLOCK_MESSAGES['no-key'])
    expect(streamLLMResponse).not.toHaveBeenCalled()
  })

  it('cancel aborts and keeps the partial text as a "Stopped" report', async () => {
    await useReportStore.getState().generate(opts)
    handlers.onToken('half a rep')
    useReportStore.getState().cancel()
    expect(abort).toHaveBeenCalled()
    await vi.waitFor(() => expect(savedReports()).toHaveLength(1))
    expect(savedReports()[0]).toMatchObject({ status: 'error', errorMessage: 'Stopped', text: 'half a rep' })
  })

  it('regenerating a report rewrites it in place and keeps createdAt', async () => {
    await useReportStore.getState().generate(opts)
    handlers.onDone({ inputTokens: 1, outputTokens: 1 })
    await vi.waitFor(() => expect(savedReports()).toHaveLength(1))
    const first = savedReports()[0]

    await useReportStore.getState().generate({ ...opts, reportId: first.id })
    handlers.onToken('# Again')
    handlers.onDone({ inputTokens: 2, outputTokens: 2 })
    await vi.waitFor(() => expect(savedReports()[0].text).toBe('# Again'))
    expect(savedReports()).toHaveLength(1)
    expect(savedReports()[0].createdAt).toBe(first.createdAt)
  })
})
