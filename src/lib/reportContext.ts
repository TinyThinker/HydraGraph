import { getAncestryChain } from './ancestry'
import type { ContextResolutionResult, TurnNode } from '../types'

/**
 * Every turn a report reads: the union of each ticked leaf's path to the root,
 * deduped, in depth-first order from the root so each branch reads as one block
 * after the shared trunk. Ids missing from `nodes` are skipped.
 *
 * Pure function — no side effects, no store access.
 */
export function collectReportTurns(leafIds: string[], nodes: Map<string, TurnNode>): TurnNode[] {
  const included = new Set<string>()
  const roots: string[] = []
  for (const leafId of leafIds) {
    const chain = getAncestryChain(nodes, leafId)
    if (chain.length === 0) continue
    if (!roots.includes(chain[0].id)) roots.push(chain[0].id)
    for (const node of chain) included.add(node.id)
  }

  const ordered: TurnNode[] = []
  const visit = (id: string) => {
    const node = nodes.get(id)
    if (!node || !included.has(id)) return
    ordered.push(node)
    included.delete(id)
    for (const childId of node.childrenIds) visit(childId)
  }
  for (const rootId of roots) visit(rootId)
  return ordered
}

/** Short citation tag per turn (`t1`, `t2`, …), in transcript order. */
export function reportTags(turns: TurnNode[]): Map<string, string> {
  return new Map(turns.map((turn, i) => [turn.id, `t${i + 1}`]))
}

const TRANSCRIPT_INTRO =
  'Below is a branching conversation. Each turn is tagged [tN] and says which turn it ' +
  'continues; a branch point is a turn the conversation forked from. Cite turns by tag.'

function turnHeader(turn: TurnNode, tags: Map<string, string>, turns: TurnNode[]): string {
  const parts = [`[${tags.get(turn.id)}]`]
  const parentTag = turn.parentId ? tags.get(turn.parentId) : undefined
  parts.push(parentTag ? `continues ${parentTag}` : 'start')
  const branches = turns.filter((t) => t.parentId === turn.id).length
  if (branches > 1) parts.push(`branch point (${branches} branches)`)
  return parts.join(' · ')
}

/**
 * The request a report sends: the brief as the system prompt, and one user
 * message holding the whole transcript. Persona overrides are named on the
 * turn they apply to.
 */
export function buildReportPayload(turns: TurnNode[], brief: string): ContextResolutionResult {
  const tags = reportTags(turns)
  const blocks = turns.map((turn) => {
    const lines = [turnHeader(turn, tags, turns)]
    const persona = turn.systemPromptOverride?.trim()
    if (persona) lines.push(`Persona: ${persona}`)
    lines.push(`User:\n${turn.userPrompt}`)
    if (turn.assistantResponse.trim()) lines.push(`Assistant:\n${turn.assistantResponse}`)
    return lines.join('\n')
  })
  return {
    systemPrompt: brief,
    messages: [{ role: 'user', content: [TRANSCRIPT_INTRO, ...blocks].join('\n\n') }],
  }
}

/**
 * Cheap fingerprint of a report's sources: prompt and response lengths per turn,
 * in order, FNV-1a hashed. Holds no node ids, so it survives export → import.
 * A regenerated answer of exactly the same length reads as unchanged (accepted).
 */
export function reportSourceDigest(turns: TurnNode[]): string {
  const input = turns.map((t) => `${t.userPrompt.length}:${t.assistantResponse.length}`).join(',')
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
