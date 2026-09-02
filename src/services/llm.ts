import type { AppSettings, ConversationTree, LLMProvider, TurnNode } from '../types'

// The resolved (provider, model) pair handed to the streaming client for a
// single prompt dispatch.
export interface DispatchTarget {
  provider: LLMProvider
  model: string
}

// Optional node-level overrides. A node pins a provider/model only when the
// user has explicitly chosen one for that turn; absent fields fall through.
export interface NodeDispatchOverride {
  provider?: LLMProvider | null
  model?: string | null
}

// One branch of a fan-out: the provider / model / persona a single forked
// child should carry. All fields optional — an absent field falls back to the
// tree / global defaults at dispatch time.
export interface FanOutVariant {
  provider?: LLMProvider | null
  model?: string | null
  systemPromptOverride?: string | null
}

function firstNonEmpty(...values: Array<string | null | undefined>): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return undefined
}

/**
 * Resolve which provider + model a prompt dispatch should use.
 *
 * Precedence, highest first:
 *   1. Node-level override (the turn the user is submitting)
 *   2. Tree-level default (the active conversation tree)
 *   3. Global settings store (per-provider default, then the flat fallback)
 *
 * The global store is always the last resort, so switching providers or the
 * default model in Settings takes effect on the very next prompt without a
 * reload.
 */
export function resolveDispatchTarget(
  nodeOverride: NodeDispatchOverride | null | undefined,
  tree: Pick<ConversationTree, 'defaultProvider' | 'defaultModel'> | null | undefined,
  settings: AppSettings,
): DispatchTarget {
  const provider: LLMProvider =
    nodeOverride?.provider ?? tree?.defaultProvider ?? settings.provider

  const model =
    firstNonEmpty(
      nodeOverride?.model,
      tree?.defaultModel,
      settings.defaultModels?.[provider],
      settings.defaultModel,
    ) ?? settings.defaultModel

  return { provider, model }
}

// Convenience overload for the common case of resolving straight from a stored
// node. Reads only the fields that represent a genuine per-node override:
// `providerOverride` (per-turn provider) and `modelUsed` (per-turn model), both
// honored here at the highest precedence before the tree/settings fallbacks.
export function resolveDispatchForNode(
  node: Pick<TurnNode, 'modelUsed' | 'providerOverride'> | null | undefined,
  tree: Pick<ConversationTree, 'defaultProvider' | 'defaultModel'> | null | undefined,
  settings: AppSettings,
): DispatchTarget {
  return resolveDispatchTarget(
    { provider: node?.providerOverride ?? null, model: node?.modelUsed },
    tree,
    settings,
  )
}
