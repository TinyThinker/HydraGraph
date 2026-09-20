import type { ConversationTree, TurnNode } from '../types'
import { DEMO_SYSTEM_PROMPT, DEMO_TREE_TITLE, DEMO_TURNS } from './demoContent'
import { resolveContextPayload } from './contextEngine'
import { layoutTree } from './autoLayout'

/**
 * Builds the shipped no-key demo tree from the canned transcript in
 * `demoContent.ts`.
 *
 * Fixed ids on purpose: `DEMO_TREE_ID` is how the UI recognises "the user is
 * looking at the demo, not their own work" (calm banner instead of the
 * no-provider warning), and it makes re-seeding idempotent — the rows are
 * replaced, never duplicated.
 *
 * Token counts are *derived*, not invented: `inputTokens` is the same ~4
 * chars/token estimate over the same resolved context the real dispatch path
 * would have sent (system prompt + every ancestor message), and `outputTokens`
 * is the response text. So the cost receipt is arithmetic over text the visitor
 * can read, and the branch-vs-linear gap it reports is a real property of the
 * tree's shape rather than a marketing number.
 *
 * Pure: no store, no Dexie. `now` is injectable so tests are deterministic.
 */

export const DEMO_TREE_ID = 'demo-deep-context-v1'

/** Spacing between canned turns, so the receipt's turn order is stable. */
const TURN_GAP_MS = 4 * 60 * 1000

/** Trunk default — what a new turn in the demo tree would dispatch with. */
const DEMO_DEFAULT_MODEL = 'anthropic/claude-3.5-sonnet'

export function isDemoTree(treeId: string | null | undefined): boolean {
  return treeId === DEMO_TREE_ID
}

function approxTokens(text: string): number {
  return Math.round(text.length / 4)
}

export function buildDemoTree(now: number = Date.now()): {
  tree: ConversationTree
  nodes: TurnNode[]
} {
  const childrenOf = new Map<string, string[]>()
  for (const turn of DEMO_TURNS) {
    if (turn.parentId == null) continue
    const siblings = childrenOf.get(turn.parentId) ?? []
    siblings.push(turn.id)
    childrenOf.set(turn.parentId, siblings)
  }

  const oldest = now - (DEMO_TURNS.length - 1) * TURN_GAP_MS

  // Pass 1: the rows themselves, without positions or token counts.
  const draft: TurnNode[] = DEMO_TURNS.map((turn, i) => ({
    id: turn.id,
    treeId: DEMO_TREE_ID,
    parentId: turn.parentId,
    childrenIds: childrenOf.get(turn.id) ?? [],
    userPrompt: turn.prompt,
    assistantResponse: turn.response,
    systemPromptOverride: turn.persona,
    positionX: 0,
    positionY: 0,
    isCollapsed: false,
    status: 'idle',
    modelUsed: turn.model,
    provider: 'openrouter',
    timestamp: oldest + i * TURN_GAP_MS,
    errorMessage: '',
    stale: false,
  }))

  // Pass 2: positions and token counts both need the whole map.
  const map = new Map(draft.map((n) => [n.id, n]))
  const positions = layoutTree(map)

  const nodes: TurnNode[] = draft.map((node) => {
    const pos = positions.get(node.id) ?? { x: 0, y: 0 }
    const { systemPrompt, messages } = resolveContextPayload(node.id, map, DEMO_SYSTEM_PROMPT)
    const contextChars =
      systemPrompt.length + messages.reduce((sum, m) => sum + m.content.length, 0)

    return {
      ...node,
      positionX: pos.x,
      positionY: pos.y,
      inputTokens: Math.round(contextChars / 4),
      outputTokens: approxTokens(node.assistantResponse),
    }
  })

  const root = nodes.find((n) => n.parentId === null)
  if (!root) throw new Error('Demo transcript has no root turn (none with parentId null).')

  const tree: ConversationTree = {
    id: DEMO_TREE_ID,
    title: DEMO_TREE_TITLE,
    rootNodeId: root.id,
    defaultSystemPrompt: DEMO_SYSTEM_PROMPT,
    createdAt: root.timestamp,
    // Sorts to the top of the tree switcher when re-seeded alongside real trees.
    updatedAt: now,
    defaultProvider: 'openrouter',
    defaultModel: DEMO_DEFAULT_MODEL,
    // Viewport deliberately unset: CanvasViewport falls back to fitView(), so a
    // first-time visitor sees the whole tree rather than a restored corner.
  }

  return { tree, nodes }
}
