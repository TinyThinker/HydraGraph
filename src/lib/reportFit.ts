import { buildReportPayload, collectReportTurns } from './reportContext'
import { resolvePrice, formatUSD } from './pricing'
import type { CatalogModel } from './openRouterCatalog'
import type { ContextResolutionResult, LLMProvider, TurnNode } from '../types'

/** Room left for the report itself when checking whether a selection fits. */
export const OUTPUT_RESERVE_TOKENS = 8000
/** Headroom on the input estimate, because chars/4 is only a ruler, not a count. */
export const INPUT_MARGIN = 0.15

/** chars/4 over system + messages — the same ruler as `contextEstimate.ts`. */
export function estimateTokens(payload: ContextResolutionResult): number {
  const chars = payload.systemPrompt.length + payload.messages.reduce((sum, m) => sum + m.content.length, 0)
  return Math.round(chars / 4)
}

export interface FitResult {
  fits: boolean
  /** Input with margin, plus the output reserve. */
  needed: number
  /** The model's context window; `null` when unknown (then `fits` is true). */
  limit: number | null
}

export function checkFit({
  inputTokens,
  contextWindow,
  outputReserve = OUTPUT_RESERVE_TOKENS,
}: {
  inputTokens: number
  contextWindow: number | null
  outputReserve?: number
}): FitResult {
  const needed = Math.ceil(inputTokens * (1 + INPUT_MARGIN)) + outputReserve
  if (contextWindow === null) return { fits: true, needed, limit: null }
  return { fits: needed <= contextWindow, needed, limit: contextWindow }
}

/** The model's context window from the OpenRouter catalog. Ollama is not a report writer. */
export function contextWindowFor(provider: LLMProvider, model: string, catalog: CatalogModel[]): number | null {
  if (provider !== 'openrouter') return null
  return catalog.find((m) => m.id === model)?.contextWindow ?? null
}

export type ReportWriterStatus = { ok: true } | { ok: false; reason: 'ollama' | 'no-key'; message: string }

export const REPORT_BLOCK_MESSAGES = {
  ollama: 'Reports use OpenRouter for now. Pick an OpenRouter model.',
  'no-key': 'Add an OpenRouter key in Settings to write reports.',
} as const

/**
 * Whether a report may be sent with this provider. Reports are OpenRouter-only:
 * Ollama silently cuts the oldest input past its context setting, and that path
 * is untested. Chat turns on Ollama are unaffected.
 */
export function reportWriterStatus(provider: LLMProvider, settings: { openRouterApiKey?: string }): ReportWriterStatus {
  if (provider === 'ollama') return { ok: false, reason: 'ollama', message: REPORT_BLOCK_MESSAGES.ollama }
  if (!settings.openRouterApiKey?.trim()) {
    return { ok: false, reason: 'no-key', message: REPORT_BLOCK_MESSAGES['no-key'] }
  }
  return { ok: true }
}

export interface ReportPlan {
  turns: TurnNode[]
  payload: ContextResolutionResult
  inputTokens: number
  fit: FitResult
  writer: ReportWriterStatus
}

/**
 * Everything the composer shows and `generate` checks before sending: the
 * transcript, its size, whether it fits, and whether this writer is allowed.
 * Pure — the caller passes in the store snapshots.
 */
export function planReport(input: {
  leafIds: string[]
  nodes: Map<string, TurnNode>
  brief: string
  provider: LLMProvider
  model: string
  settings: { openRouterApiKey?: string }
  catalog: CatalogModel[]
}): ReportPlan {
  const turns = collectReportTurns(input.leafIds, input.nodes)
  const payload = buildReportPayload(turns, input.brief)
  const inputTokens = estimateTokens(payload)
  const fit = checkFit({ inputTokens, contextWindow: contextWindowFor(input.provider, input.model, input.catalog) })
  return { turns, payload, inputTokens, fit, writer: reportWriterStatus(input.provider, input.settings) }
}

/** "Too big for <model>: ~N tokens, limit M" — shared by the store and the composer. */
export function tooBigMessage(model: string, fit: FitResult): string {
  return `Too big for ${model}: ~${fit.needed.toLocaleString('en-US')} tokens, limit ${(fit.limit ?? 0).toLocaleString('en-US')}`
}

/** Assumed report length for the cost estimate; the real figure lands on the record. */
const EST_OUTPUT_TOKENS = 2000

const k = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n))

/** The line under the model picker: size against the window, plus an estimated cost. */
export function fitLine(plan: ReportPlan, model: string, catalog: CatalogModel[]): string {
  if (!plan.fit.fits) return `Too big for this model: ~${k(plan.fit.needed)} tokens of ${k(plan.fit.limit ?? 0)}`
  const size = plan.fit.limit === null ? `~${k(plan.inputTokens)} tokens · limit unknown` : `~${k(plan.inputTokens)} tokens of ${k(plan.fit.limit)}`
  const price = resolvePrice(model, 'openrouter', catalog)
  if (!price) return size
  const cost = (plan.inputTokens * price.inputPerM + EST_OUTPUT_TOKENS * price.outputPerM) / 1_000_000
  return `${size} · est. ${formatUSD(cost)}`
}
