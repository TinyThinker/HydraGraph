import { create } from 'zustand'
import { db } from '../db/ChatDatabase'
import { resolveContextPayload } from '../lib/contextEngine'
import { streamLLMResponse } from '../lib/streamingClient'
import { createTokenCoalescer } from '../lib/tokenCoalescer'
import { resolveDispatchForNode, type FanOutVariant } from '../services/llm'
import { useSettingsStore } from './settingsStore'
import { computeChildPosition, layoutTree } from '../lib/autoLayout'
import { parseImportDoc, remapImportedTree } from '../lib/treeExport'
import { buildDemoTree } from '../lib/demoTree'
import type { TurnNode, ConversationTree, NodeStatus, TokenUsage } from '../types'

interface TreeStoreState {
  nodes: Map<string, TurnNode>
  trees: ConversationTree[]
  activeTreeId: string | null
  liveText: Map<string, string>
  fitViewNonce: number
  /**
   * Id of the most recently spawned child node (an actual branch off an
   * existing parent, never a root). CanvasSelectionSync watches this to route
   * a fresh spawn through the same select + auto-center path as a click.
   */
  lastSpawnedNodeId: string | null
}

interface TreeStoreActions {
  loadTree: (treeId: string) => Promise<void>
  createTree: (title: string) => Promise<ConversationTree>
  addNode: (node: TurnNode) => Promise<void>
  updateNode: (id: string, patch: Partial<TurnNode>) => Promise<void>
  appendTokenDelta: (id: string, chunk: string) => void
  setNodeStatus: (id: string, status: NodeStatus) => void
  finalizeNode: (id: string, usage: TokenUsage) => Promise<void>
  setActiveTree: (treeId: string) => void
  loadAllTrees: () => Promise<void>
  submitPrompt: (nodeId: string, userPrompt: string) => Promise<() => void>
  forkAndSubmit: (parentId: string, userPrompt: string) => Promise<string | null>
  fanOutAndSubmit: (parentId: string, userPrompt: string, variants: FanOutVariant[]) => Promise<string[]>
  cancelGeneration: (id: string) => Promise<void>
  deleteNodeSubtree: (id: string) => Promise<void>
  markDescendantsStale: (id: string) => Promise<void>
  toggleCollapse: (id: string) => Promise<void>
  relayoutActiveTree: () => Promise<void>
  renameTree: (treeId: string, title: string) => Promise<void>
  deleteTree: (treeId: string) => Promise<void>
  importTree: (text: string) => Promise<{ ok: boolean; error?: string; treeId?: string }>
  /**
   * Write (or rewrite) the shipped demo tree and open it. Idempotent — fixed
   * ids mean re-seeding replaces the rows instead of piling up copies, so any
   * edits a visitor made to the demo are reset rather than duplicated.
   */
  seedDemoTree: () => Promise<ConversationTree>
}

// Module-scope: map of node id → pending flush timer
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

// Module-scope: map of node id → abort function (transient session state, never persisted)
const abortRegistry = new Map<string, () => void>()

// Schedule a throttled flush for a node id. If a timer already exists,
// do nothing (the existing timer will write the latest text when it fires).
// Otherwise, set a timer for ~400ms that reads the current in-flight text from liveText
// and writes it to the database.
function scheduleThrottledFlush(nodeId: string) {
  if (pendingTimers.has(nodeId)) {
    return // Already scheduled; new text will be written when timer fires
  }

  const timerId = setTimeout(() => {
    const liveText = useTreeStore.getState().liveText.get(nodeId)
    if (liveText !== undefined) {
      db.nodes.update(nodeId, { assistantResponse: liveText }).catch((err) => {
        console.error(`[throttled flush error for ${nodeId}]`, err)
      })
    }
    pendingTimers.delete(nodeId)
  }, 400)

  pendingTimers.set(nodeId, timerId)
}

// Cancel any pending throttled flush for a node id.
function cancelThrottledFlush(nodeId: string) {
  const timerId = pendingTimers.get(nodeId)
  if (timerId) {
    clearTimeout(timerId)
    pendingTimers.delete(nodeId)
  }
}

// Recompute the full deterministic layout and return a NEW Map where every
// reachable node is replaced with { ...node, positionX, positionY }. Nodes
// absent from the layout result (orphans) are copied through unchanged.
export function relayoutNodes(nodes: Map<string, TurnNode>): Map<string, TurnNode> {
  const positions = layoutTree(nodes)
  const next = new Map<string, TurnNode>()
  for (const [id, node] of nodes) {
    const pos = positions.get(id)
    next.set(id, pos ? { ...node, positionX: pos.x, positionY: pos.y } : node)
  }
  return next
}

// Collect a node and all its descendants into a Set of ids.
// Uses explicit stack to guard against cycles and missing entries.
export function collectSubtreeIds(rootId: string, nodes: Map<string, TurnNode>): Set<string> {
  const result = new Set<string>()
  const stack = [rootId]

  while (stack.length > 0) {
    const current = stack.pop()!
    if (result.has(current)) continue // Guard against cycles

    const node = nodes.get(current)
    if (!node) continue // Guard against missing entries

    result.add(current)
    stack.push(...node.childrenIds)
  }

  return result
}

export const useTreeStore = create<TreeStoreState & TreeStoreActions>((set, get) => {
  const touchActiveTree = async () => {
    const { activeTreeId, trees } = get()
    if (!activeTreeId) return
    const now = Date.now()
    await db.trees.update(activeTreeId, { updatedAt: now })
    set({ trees: trees.map((t) => (t.id === activeTreeId ? { ...t, updatedAt: now } : t)) })
  }

  // Persist every changed position from `next` to Dexie in one transaction,
  // then commit `next` to state. `next` is expected to be the output of
  // relayoutNodes (a fresh Map with new node references where positions changed).
  const persistLayout = async (next: Map<string, TurnNode>) => {
    const prev = get().nodes
    const changed: Array<[string, TurnNode]> = []
    for (const [id, node] of next) {
      const before = prev.get(id)
      if (before && before.positionX === node.positionX && before.positionY === node.positionY) continue
      changed.push([id, node])
    }
    if (changed.length > 0) {
      await db.transaction('rw', [db.nodes], async () => {
        for (const [id, node] of changed) {
          await db.nodes.update(id, { positionX: node.positionX, positionY: node.positionY })
        }
      })
    }
    set({ nodes: next })
  }

  const recomputeLayout = async () => {
    const next = relayoutNodes(get().nodes)
    await persistLayout(next)
  }

  return {
    nodes: new Map(),
    trees: [],
    activeTreeId: null,
    liveText: new Map(),
    fitViewNonce: 0,
    lastSpawnedNodeId: null,

    loadAllTrees: async () => {
      const trees = await db.trees.orderBy('createdAt').reverse().toArray()
      set({ trees })
    },

    loadTree: async (treeId) => {
      const nodeArray = await db.nodes.where('treeId').equals(treeId).toArray()

      // Constant message for recovered zombie nodes
      const STALE_STREAM_MESSAGE = 'Generation was interrupted before it finished (the page was reloaded or closed).'

      // Detect zombie streaming nodes (stale streams from a previous session)
      const staleStreamingIds = nodeArray
        .filter((n) => n.status === 'streaming')
        .map((n) => n.id)

      // If there are stale streaming nodes, recover them in a single transaction
      if (staleStreamingIds.length > 0) {
        await db.transaction('rw', [db.nodes], async () => {
          for (const id of staleStreamingIds) {
            await db.nodes.update(id, {
              status: 'error',
              errorMessage: STALE_STREAM_MESSAGE,
            })
          }
        })
      }

      // Build in-memory array/Map with corrected copies where streaming → error
      const correctedArray = nodeArray.map((n) => {
        if (n.status === 'streaming') {
          return { ...n, status: 'error' as NodeStatus, errorMessage: STALE_STREAM_MESSAGE }
        }
        return n
      })

      const nodes = new Map(correctedArray.map((n) => [n.id, n]))
      set({ nodes, activeTreeId: treeId })
      await useSettingsStore.getState().setActiveTreeId(treeId)
    },

    createTree: async (title) => {
      const now = Date.now()
      const rootNodeId = crypto.randomUUID()
      const treeId = crypto.randomUUID()

      const rootNode: TurnNode = {
        id: rootNodeId,
        treeId,
        parentId: null,
        childrenIds: [],
        userPrompt: '',
        assistantResponse: '',
        positionX: 400,
        positionY: 100,
        isCollapsed: false,
        status: 'idle',
        modelUsed: useSettingsStore.getState().settings.defaultModel,
        timestamp: now,
      }

      const tree: ConversationTree = {
        id: treeId,
        title,
        rootNodeId,
        defaultSystemPrompt: 'You are a helpful AI research assistant.',
        createdAt: now,
        updatedAt: now,
      }

      await db.transaction('rw', [db.nodes, db.trees], async () => {
        await db.nodes.add(rootNode)
        await db.trees.add(tree)
      })

      const nodes = new Map([[rootNodeId, rootNode]])
      set((state) => ({ nodes, activeTreeId: treeId, trees: [tree, ...state.trees] }))
      await useSettingsStore.getState().setActiveTreeId(treeId)
      return tree
    },

    addNode: async (node) => {
      let placed = node
      if (node.parentId) {
        const parent = get().nodes.get(node.parentId)
        if (parent) {
          const pos = computeChildPosition(node.parentId, get().nodes)
          placed = { ...node, positionX: pos.x, positionY: pos.y }
        }
      }

      await db.nodes.add(placed)

      const parent = placed.parentId ? get().nodes.get(placed.parentId) : undefined
      const isChildSpawn = !!(parent && placed.parentId)
      if (isChildSpawn && parent && placed.parentId) {
        const updatedParent = { ...parent, childrenIds: [...parent.childrenIds, placed.id] }
        await db.nodes.update(placed.parentId, { childrenIds: updatedParent.childrenIds })
        set((state) => {
          const next = new Map(state.nodes)
          next.set(placed.parentId!, updatedParent)
          next.set(placed.id, placed)
          return { nodes: next }
        })
      } else {
        set((state) => {
          const next = new Map(state.nodes)
          next.set(placed.id, placed)
          return { nodes: next }
        })
      }

      // Positions are 100% derived from tree structure: recompute the full
      // deterministic layout and persist it. Covers branching and forkAndSubmit.
      await recomputeLayout()

      // Only a real child spawn (existing parent) routes through select+center.
      if (isChildSpawn) set({ lastSpawnedNodeId: placed.id })

      await touchActiveTree()
    },

    updateNode: async (id, patch) => {
      const existing = get().nodes.get(id)
      if (!existing) return
      const updated = { ...existing, ...patch }
      await db.nodes.update(id, patch)
      set((state) => {
        const next = new Map(state.nodes)
        next.set(id, updated)
        return { nodes: next }
      })
      if ('systemPromptOverride' in patch) {
        await touchActiveTree()
      }
    },

    appendTokenDelta: (id, chunk) => {
      set((state) => {
        // If node doesn't exist, it's a ghost id — no-op
        if (!state.nodes.has(id)) return state
        // Append to liveText, creating new Map
        const newLiveText = new Map(state.liveText)
        const current = state.liveText.get(id) ?? ''
        newLiveText.set(id, current + chunk)
        return { liveText: newLiveText }
      })
      // Schedule throttled flush to persist the latest text to IndexedDB
      scheduleThrottledFlush(id)
    },

    setNodeStatus: (id, status) => {
      set((state) => {
        const existing = state.nodes.get(id)
        if (!existing) return state
        const next = new Map(state.nodes)
        next.set(id, { ...existing, status })
        return { nodes: next }
      })
    },

    finalizeNode: async (id, usage) => {
      // Cancel any pending throttled flush so it cannot fire a stale write after this final write
      cancelThrottledFlush(id)
      abortRegistry.delete(id)

      const existing = get().nodes.get(id)
      if (!existing) return

      // Compute final text: use liveText if present, otherwise fall back to existing node response
      const finalText = get().liveText.get(id) ?? existing.assistantResponse

      const patch = { status: 'idle' as NodeStatus, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }
      const updated = { ...existing, ...patch, assistantResponse: finalText }
      await db.nodes.update(id, { ...patch, assistantResponse: finalText })
      set((state) => {
        const nextNodes = new Map(state.nodes)
        nextNodes.set(id, updated)
        const nextLiveText = new Map(state.liveText)
        nextLiveText.delete(id)
        return { nodes: nextNodes, liveText: nextLiveText }
      })
      await touchActiveTree()
    },

    setActiveTree: (treeId) => set({ activeTreeId: treeId }),

    submitPrompt: async (nodeId, userPrompt) => {
      const { nodes, activeTreeId, appendTokenDelta, finalizeNode } = get()

      const tree = activeTreeId ? await db.trees.get(activeTreeId) : null
      const defaultSystemPrompt = tree?.defaultSystemPrompt ?? 'You are a helpful AI research assistant.'

      // Persist prompt + set streaming status + clear stale flag on the target
      const existing = nodes.get(nodeId)
      if (!existing) return () => {}
      if (existing.status === 'streaming') return () => {}

      // Resolve the dispatch target fresh on every submit: node override ->
      // tree default -> global settings store. Reading the settings store here
      // (rather than a cached copy) is what makes provider / API-key changes in
      // Settings apply on the very next prompt without a reload.
      const globalSettings = useSettingsStore.getState().settings
      const target = resolveDispatchForNode(existing, tree, globalSettings)

      const updated = { ...existing, userPrompt, status: 'streaming' as NodeStatus, assistantResponse: '', provider: target.provider, modelUsed: target.model, errorMessage: '', inputTokens: undefined, outputTokens: undefined, stale: false }
      await db.nodes.update(nodeId, { userPrompt, status: 'streaming', assistantResponse: '', provider: target.provider, modelUsed: target.model, errorMessage: '', inputTokens: undefined, outputTokens: undefined, stale: false })
      set((state) => {
        const next = new Map(state.nodes)
        next.set(nodeId, updated)
        // Remove any stale liveText entry for this node
        const nextLiveText = new Map(state.liveText)
        nextLiveText.delete(nodeId)
        return { nodes: next, liveText: nextLiveText }
      })

      await touchActiveTree()

      // Clear any stale timer from a previous run so it cannot write into this fresh stream
      cancelThrottledFlush(nodeId)
      abortRegistry.delete(nodeId)

      // Mark all descendants as stale
      await get().markDescendantsStale(nodeId)

      const payload = resolveContextPayload(nodeId, get().nodes, defaultSystemPrompt)

      // Local async function to persist error state: cancel pending flush, read current text, and write error + text to DB
      const persistError = async (err: unknown) => {
        console.error('[stream error]', err)
        const message = err instanceof Error ? err.message : String(err)
        cancelThrottledFlush(nodeId)
        abortRegistry.delete(nodeId)
        const currentNode = get().nodes.get(nodeId)
        if (currentNode) {
          // Compute text: use liveText if present, otherwise fall back to node's current response
          const text = get().liveText.get(nodeId) ?? currentNode.assistantResponse
          await db.nodes.update(nodeId, { status: 'error', assistantResponse: text, errorMessage: message })
          set((state) => {
            const nextNodes = new Map(state.nodes)
            nextNodes.set(nodeId, { ...currentNode, status: 'error', assistantResponse: text, errorMessage: message })
            const nextLiveText = new Map(state.liveText)
            nextLiveText.delete(nodeId)
            return { nodes: nextNodes, liveText: nextLiveText }
          })
        }
      }

      // Batch deltas into one store commit per frame. Every exit from the
      // stream (done, error, abort) must settle the buffer first: a flush that
      // landed after liveText was cleared would resurrect an entry for a node
      // that is no longer streaming, and the chat pane reads a present liveText
      // entry as "still streaming".
      const coalescer = createTokenCoalescer((text) => appendTokenDelta(nodeId, text))

      try {
        const abort = await streamLLMResponse(
          payload,
          globalSettings,
          target,
          (chunk) => coalescer.push(chunk),
          (usage) => {
            coalescer.flush()
            finalizeNode(nodeId, usage)
          },
          (err) => {
            coalescer.flush()
            persistError(err)
          },
        )

        const abortAll = () => {
          coalescer.cancel()
          abort()
        }
        abortRegistry.set(nodeId, abortAll)
        return abortAll
      } catch (err) {
        coalescer.cancel()
        await persistError(err)
        return () => {}
      }
    },

    // Fork a fresh child off `parentId` and immediately dispatch `userPrompt`
    // into it. Sibling branches are untouched — addNode appends to the parent's
    // childrenIds rather than replacing them. Returns the new child id (or null
    // if the parent / active tree is missing).
    forkAndSubmit: async (parentId, userPrompt) => {
      const { activeTreeId, nodes } = get()
      const parent = nodes.get(parentId)
      if (!activeTreeId || !parent) return null

      const childId = crypto.randomUUID()
      const child: TurnNode = {
        id: childId,
        treeId: activeTreeId,
        parentId,
        childrenIds: [],
        userPrompt: '',
        assistantResponse: '',
        positionX: parent.positionX,
        positionY: parent.positionY,
        isCollapsed: false,
        status: 'idle',
        modelUsed: useSettingsStore.getState().settings.defaultModel,
        timestamp: Date.now(),
      }

      await get().addNode(child)
      await get().submitPrompt(childId, userPrompt)
      return childId
    },

    // Fan-out: fork N children off the SAME parent (identical ancestry), each
    // carrying its own provider / model / persona override, then dispatch the
    // same prompt into all of them in parallel. Children are ADDED sequentially
    // (addNode mutates the parent's childrenIds and recomputes layout, so those
    // calls must not race); only the dispatch is parallelised. Returns the new
    // child ids in variant order (empty array if the parent / active tree is
    // missing, or no variants were given).
    fanOutAndSubmit: async (parentId, userPrompt, variants) => {
      const { activeTreeId, nodes } = get()
      const parent = nodes.get(parentId)
      if (!activeTreeId || !parent || variants.length === 0) return []

      const defaultModel = useSettingsStore.getState().settings.defaultModel

      const children: TurnNode[] = variants.map((variant, i) => ({
        id: crypto.randomUUID(),
        treeId: activeTreeId,
        parentId,
        childrenIds: [],
        userPrompt: '',
        assistantResponse: '',
        positionX: parent.positionX,
        positionY: parent.positionY,
        isCollapsed: false,
        status: 'idle',
        providerOverride: variant.provider ?? undefined,
        modelUsed: variant.model?.trim() || defaultModel,
        systemPromptOverride: variant.systemPromptOverride?.trim() || undefined,
        timestamp: Date.now() + i,
      }))

      const childIds = children.map((c) => c.id)

      for (const child of children) await get().addNode(child)

      await Promise.all(childIds.map((id) => get().submitPrompt(id, userPrompt)))

      return childIds
    },

    cancelGeneration: async (id) => {
      // Call abort function if registered
      const abort = abortRegistry.get(id)
      if (abort) {
        abort()
        abortRegistry.delete(id)
      }

      // Cancel pending throttled flush
      cancelThrottledFlush(id)

      // Read current node from memory
      const node = get().nodes.get(id)
      if (!node) return

      // Compute text: use liveText if present, otherwise fall back to node's current response
      const text = get().liveText.get(id) ?? node.assistantResponse

      // Update DB with idle status and preserved text
      await db.nodes.update(id, { status: 'idle', assistantResponse: text })

      // Update memory immutably
      set((state) => {
        const nextNodes = new Map(state.nodes)
        nextNodes.set(id, { ...node, status: 'idle', assistantResponse: text })
        const nextLiveText = new Map(state.liveText)
        nextLiveText.delete(id)
        return { nodes: nextNodes, liveText: nextLiveText }
      })
    },

    deleteNodeSubtree: async (id) => {
      const target = get().nodes.get(id)
      if (!target) return

      // Guard: do not delete the tree root
      if (target.parentId === null) return

      const ids = collectSubtreeIds(id, get().nodes)

      // Cancel any in-flight operations for each descendant
      for (const nodeId of ids) {
        const abort = abortRegistry.get(nodeId)
        if (abort) {
          abort()
          abortRegistry.delete(nodeId)
        }
        cancelThrottledFlush(nodeId)
      }

      const parentId = target.parentId
      const parent = get().nodes.get(parentId)

      // Persist to DB
      await db.transaction('rw', [db.nodes], async () => {
        await db.nodes.bulkDelete([...ids])
        if (parent) {
          await db.nodes.update(parentId, { childrenIds: parent.childrenIds.filter((c) => c !== id) })
        }
      })

      // Update memory immutably
      set((state) => {
        const next = new Map(state.nodes)
        for (const nodeId of ids) {
          next.delete(nodeId)
        }

        // Update parent's childrenIds in memory if it still exists
        if (parent && next.has(parentId)) {
          next.set(parentId, { ...parent, childrenIds: parent.childrenIds.filter((c) => c !== id) })
        }

        // Remove liveText entries for deleted nodes
        let nextLiveText = state.liveText
        for (const nodeId of ids) {
          if (state.liveText.has(nodeId)) {
            nextLiveText = new Map(nextLiveText)
            nextLiveText.delete(nodeId)
          }
        }

        return { nodes: next, liveText: nextLiveText }
      })

      // Remaining nodes' positions are derived from structure: recompute + persist.
      await recomputeLayout()
      await touchActiveTree()
    },

    markDescendantsStale: async (id) => {
      const nodes = get().nodes
      const subtree = collectSubtreeIds(id, nodes)
      subtree.delete(id) // Only mark descendants, not the target itself

      const toMark = [...subtree].filter((d) => {
        const n = nodes.get(d)
        return !!n && !n.stale
      })

      if (toMark.length === 0) return

      // Persist to DB
      await db.transaction('rw', [db.nodes], async () => {
        for (const d of toMark) {
          await db.nodes.update(d, { stale: true })
        }
      })

      // Update memory immutably
      set((state) => {
        const next = new Map(state.nodes)
        for (const d of toMark) {
          const n = next.get(d)
          if (n) {
            next.set(d, { ...n, stale: true })
          }
        }
        return { nodes: next }
      })
    },

    toggleCollapse: async (id) => {
      const existing = get().nodes.get(id)
      if (!existing) return
      const nextVal = !existing.isCollapsed
      await db.nodes.update(id, { isCollapsed: nextVal })
      set((state) => {
        const m = new Map(state.nodes)
        const n = m.get(id)
        if (n) m.set(id, { ...n, isCollapsed: nextVal })
        return { nodes: m }
      })
    },

    relayoutActiveTree: async () => {
      const { nodes, activeTreeId } = get()
      if (!activeTreeId || nodes.size === 0) return

      await persistLayout(relayoutNodes(nodes))
      set((state) => ({ fitViewNonce: state.fitViewNonce + 1 }))
    },

    renameTree: async (treeId, title) => {
      const trimmed = title.trim()
      if (!trimmed) return

      await db.trees.update(treeId, { title: trimmed })
      set((state) => ({
        trees: state.trees.map((t) => (t.id === treeId ? { ...t, title: trimmed } : t)),
      }))
    },

    deleteTree: async (treeId) => {
    // Collect this tree's node ids: use DB query as source of truth
    const nodeIds = (await db.nodes.where('treeId').equals(treeId).toArray()).map((n) => n.id)

    // Delete in one transaction
    await db.transaction('rw', [db.nodes, db.trees], async () => {
      await db.nodes.bulkDelete(nodeIds)
      await db.trees.delete(treeId)
    })

    // Update memory: remove tree immutably
    const nextTrees = get().trees.filter((t) => t.id !== treeId)
    set({ trees: nextTrees })

    // Guard: if no trees remain, create a fresh one and activate it
    if (nextTrees.length === 0) {
      await get().createTree('New Research')
      return
    }

    // If deleted tree was active, pick next one and activate it
    if (get().activeTreeId === treeId) {
      const remaining = get().trees
      const sorted = [...remaining].sort((a, b) => b.updatedAt - a.updatedAt)
      const nextTree = sorted[0]
      if (nextTree) {
        await get().loadTree(nextTree.id)
      }
    }
    },

    importTree: async (text) => {
      const parsed = parseImportDoc(text)
      if (!parsed.ok) {
        return { ok: false, error: parsed.error }
      }

      const { tree, nodes } = remapImportedTree(parsed.doc)

      try {
        await db.transaction('rw', [db.trees, db.nodes], async () => {
          await db.trees.add(tree)
          await db.nodes.bulkAdd(nodes)
        })
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }

      set((state) => ({ trees: [tree, ...state.trees] }))
      await get().loadTree(tree.id)
      return { ok: true, treeId: tree.id }
    },

    seedDemoTree: async () => {
      const { tree, nodes } = buildDemoTree()

      await db.transaction('rw', [db.trees, db.nodes], async () => {
        const staleIds = await db.nodes.where('treeId').equals(tree.id).primaryKeys()
        if (staleIds.length > 0) await db.nodes.bulkDelete(staleIds as string[])
        await db.trees.put(tree)
        await db.nodes.bulkAdd(nodes)
      })

      set((state) => ({ trees: [tree, ...state.trees.filter((t) => t.id !== tree.id)] }))
      await get().loadTree(tree.id)
      return tree
    },
  }
})
