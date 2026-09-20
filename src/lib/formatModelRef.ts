import type { LLMProvider, TurnNode } from '../types'

/**
 * Compact `provider/model` label for a dispatch pair. Blank provider reads as
 * `inherit` (falls through to tree / global default); blank model as `(default)`.
 * Pure — no store, no React.
 */
export function formatModelRef(
  provider: LLMProvider | null | undefined,
  model: string | null | undefined,
): string {
  return `${provider ?? 'inherit'}/${model || '(default)'}`
}

/**
 * The pill's second line when a node departs from the inherited dispatch
 * default — `null` when it doesn't, so the summary keeps both lines instead.
 *
 * Fan-out siblings are dispatched with a byte-identical prompt by
 * construction: that *is* the experiment, so no summarizer can ever tell them
 * apart. The model is the only thing that differs, and it is precisely what
 * the comparison is about.
 *
 * Reads the node's own fields plus one primitive default. The tempting
 * condition — "do my siblings share my prompt" — needs the whole node map, and
 * re-deriving that for every pill on every store commit (streaming frames
 * included) is what the canvas render budget exists to prevent.
 *
 * Compact on purpose: `formatModelRef` would render
 * `openrouter/anthropic/claude-3.7-sonnet`, which overruns the pill and gets
 * truncated — reintroducing the defect this line exists to fix. An OpenRouter
 * slug already names its vendor, so the provider prefix is redundant there and
 * is kept only for `ollama`, where "this ran locally" is the point.
 *
 * Known limit: `inheritedModel` is the global default. The tree record is not
 * held in memory (only `submitPrompt` reads it, from Dexie), so a tree with its
 * own default model labels every pill rather than none — noisy, not wrong.
 */
export function pillModelRef(
  node: Pick<TurnNode, 'providerOverride' | 'modelUsed'>,
  inheritedModel: string,
): string | null {
  const model = node.modelUsed.trim()
  const departs =
    node.providerOverride !== undefined || (model !== '' && model !== inheritedModel.trim())
  if (!departs) return null

  if (node.providerOverride === 'ollama') return `ollama/${model || '(default)'}`
  return model || formatModelRef(node.providerOverride, model)
}
