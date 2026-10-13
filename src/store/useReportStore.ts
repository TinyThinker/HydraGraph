import { create } from 'zustand'
import { useTreeStore } from './useTreeStore'
import { useSettingsStore } from './settingsStore'
import { useCatalogStore } from './catalogStore'
import { getAncestryChain } from '../lib/ancestry'
import { reportSourceDigest } from '../lib/reportContext'
import { planReport, tooBigMessage } from '../lib/reportFit'
import { reportTitle } from '../lib/reportBrief'
import { streamLLMResponse } from '../lib/streamingClient'
import { createTokenCoalescer } from '../lib/tokenCoalescer'
import type { LLMProvider, TokenUsage, TreeReport, TurnNode } from '../types'

// Report state lives here, not in useTreeStore: the tree store only gains the
// actions that write the tree row. Pills read this store through one boolean
// selector each (`leafIds.includes(id)`, `includedIds.has(id)`), never the set
// itself, so ticking one pill does not re-render the other 199.

interface ReportState {
  /** Report mode: a pill click ticks the turn instead of selecting it. */
  selecting: boolean
  /** Ticked turns. Each one stands for its whole path to the root. */
  leafIds: string[]
  /** Every turn on a ticked path, recomputed on each toggle. */
  includedIds: Set<string>
  /** The report the panel shows. */
  activeReportId: string | null
  generating: boolean
  /** In-flight report text. Never written onto the record until the stream ends. */
  liveText: string | null
  /** Why the last generate did not start (blocked writer, too big, nothing ticked). */
  error: string | null
}

export interface GenerateOptions {
  brief: string
  provider: LLMProvider
  model: string
  /** Defaults to the ticked leaves. */
  leafIds?: string[]
  /** Rewrite this report in place instead of adding a new one. */
  reportId?: string
}

interface ReportActions {
  /** Enter report mode, optionally pre-ticking `leafIds` (e.g. editing a report's selection). */
  startSelecting: (leafIds?: string[]) => void
  toggle: (id: string) => void
  clear: () => void
  stopSelecting: () => void
  setActiveReport: (id: string | null) => void
  generate: (opts: GenerateOptions) => Promise<void>
  /** Abort the stream; partial text is kept as an error report "Stopped". */
  cancel: () => void
}

// The live run's abort. Transient session state, never persisted.
let abortRun: (() => void) | null = null

function pathsOf(leafIds: string[], nodes: Map<string, TurnNode>): Set<string> {
  const out = new Set<string>()
  for (const leafId of leafIds) for (const node of getAncestryChain(nodes, leafId)) out.add(node.id)
  return out
}

export const useReportStore = create<ReportState & ReportActions>((set, get) => ({
  selecting: false,
  leafIds: [],
  includedIds: new Set(),
  activeReportId: null,
  generating: false,
  liveText: null,
  error: null,

  startSelecting: (leafIds = []) =>
    set({ selecting: true, leafIds: [...leafIds], includedIds: pathsOf(leafIds, useTreeStore.getState().nodes) }),

  toggle: (id) =>
    set((s) => {
      const leafIds = s.leafIds.includes(id) ? s.leafIds.filter((l) => l !== id) : [...s.leafIds, id]
      return { leafIds, includedIds: pathsOf(leafIds, useTreeStore.getState().nodes) }
    }),

  clear: () => set({ leafIds: [], includedIds: new Set() }),

  stopSelecting: () => set({ selecting: false }),

  setActiveReport: (id) => set({ activeReportId: id }),

  generate: async ({ brief, provider, model, leafIds = get().leafIds, reportId }) => {
    if (get().generating) return
    const { activeTreeId, trees, nodes } = useTreeStore.getState()
    const tree = trees.find((t) => t.id === activeTreeId)
    if (!tree) return
    const settings = useSettingsStore.getState().settings
    const plan = planReport({
      leafIds, nodes, brief, provider, model, settings, catalog: useCatalogStore.getState().models,
    })
    if (!plan.writer.ok) return set({ error: plan.writer.message })
    if (plan.turns.length === 0) return set({ error: 'Tick at least one branch.' })
    if (!plan.fit.fits) return set({ error: tooBigMessage(model, plan.fit) })

    const previous = reportId ? tree.reports?.find((r) => r.id === reportId) : undefined
    const id = previous?.id ?? crypto.randomUUID()
    const base = {
      id, createdAt: previous?.createdAt ?? Date.now(), leafIds: [...leafIds], brief, provider, model,
      sourceDigest: reportSourceDigest(plan.turns),
    }
    set({ generating: true, liveText: '', error: null, activeReportId: id })

    const coalescer = createTokenCoalescer((text) => set((s) => ({ liveText: (s.liveText ?? '') + text })))
    let settled = false
    const finish = async (patch: Pick<TreeReport, 'status'> & Partial<TreeReport>) => {
      if (settled) return
      settled = true
      abortRun = null
      coalescer.flush()
      const text = get().liveText ?? ''
      const report: TreeReport = { ...base, title: reportTitle(text), text, updatedAt: Date.now(), ...patch }
      // saveReport puts the record in memory before its first await, so the
      // panel swaps live text for the saved report with no blank frame.
      const saved = useTreeStore.getState().saveReport(tree.id, report)
      set({ generating: false, liveText: null })
      await saved
    }

    const abort = await streamLLMResponse(
      plan.payload,
      settings,
      { provider, model },
      (chunk) => coalescer.push(chunk),
      (usage: TokenUsage) => void finish({ status: 'idle', ...usage }),
      (err) => void finish({ status: 'error', errorMessage: err.message }),
    )
    if (settled) return
    abortRun = () => {
      abort()
      void finish({ status: 'error', errorMessage: 'Stopped' })
    }
  },

  cancel: () => abortRun?.(),
}))
