import { resolveContextPayload } from './contextEngine'
import type { TurnNode } from '../types'

// Rough token budget beyond which a deep chain gets a "near the limit" warning.
// One obvious place to tune.
export const CONTEXT_WARN_TOKENS = 6000

// Character-based heuristic (~4 chars/token) over the resolved context payload:
// system prompt + every ancestor message. Excludes the target node's own
// response (resolveContextPayload already does).
export function estimateContextTokens(nodeId: string, nodes: Map<string, TurnNode>): number {
  const payload = resolveContextPayload(nodeId, nodes, 'You are a helpful AI research assistant.')
  const totalChars = payload.systemPrompt.length + payload.messages.reduce((sum, msg) => sum + msg.content.length, 0)
  return Math.round(totalChars / 4)
}
