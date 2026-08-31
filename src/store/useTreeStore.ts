import { create } from 'zustand'
import { db } from '../db/ChatDatabase'
import { resolveContextPayload } from '../lib/contextEngine'
import { streamLLMResponse } from '../lib/streamingClient'
import type { TurnNode, ConversationTree, AppSettings, NodeStatus, TokenUsage } from '../types'

interface TreeStoreState {
  nodes: Map<string, TurnNode>
  trees: ConversationTree[]
  activeTreeId: string | null
  settings: AppSettings
  liveText: Map<string, string>
}

interface TreeStoreActions {
  loadSettings: () => Promise<void>
  saveSettings: (patch: Partial<AppSettings>) => Promise<void>
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
  cancelGeneration: (id: string) => Promise<void>
  deleteNodeSubtree: (id: string) => Promise<void>
}

const DEFAULT_SETTINGS: AppSettings = {
  id: 'global_settings',
  ollamaBaseUrl: 'http://localhost:11434',
  defaultModel: 'gemini-2.5-flash',
  provider: 'gemini',
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

export const useTreeStore = create<TreeStoreState & TreeStoreActions>((set, get) => ({
  nodes: new Map(),
  trees: [],
  activeTreeId: null,
  settings: DEFAULT_SETTINGS,
  liveText: new Map(),

  loadSettings: async () => {
    const saved = await db.settings.get('global_settings')
    if (saved) {
      set({ settings: saved })
    } else {
      const defaults = { ...DEFAULT_SETTINGS }
      await db.settings.put(defaults)
      set({ settings: defaults })
    }
  },

  saveSettings: async (patch) => {
    const current = get().settings
    const merged = { ...current, ...patch }

    // Derive provider if not explicitly provided in patch
    if (!patch.provider) {
      if (merged.geminiApiKey) {
        merged.provider = 'gemini'
      } else if (merged.ollamaBaseUrl) {
        merged.provider = 'ollama'
      } else {
        merged.provider = current.provider
      }
    }

    await db.settings.put(merged)
    set({ settings: merged })
  },

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
    const nextSettings = { ...get().settings, activeTreeId: treeId }
    set({ nodes, activeTreeId: treeId, settings: nextSettings })
    await db.settings.put(nextSettings)
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
      modelUsed: get().settings.defaultModel,
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
    const nextSettings = { ...get().settings, activeTreeId: treeId }
    set((state) => ({ nodes, activeTreeId: treeId, settings: nextSettings, trees: [tree, ...state.trees] }))
    await db.settings.put(nextSettings)
    return tree
  },

  addNode: async (node) => {
    await db.nodes.add(node)

    if (node.parentId) {
      const parent = get().nodes.get(node.parentId)
      if (parent) {
        const updatedParent = { ...parent, childrenIds: [...parent.childrenIds, node.id] }
        await db.nodes.update(node.parentId, { childrenIds: updatedParent.childrenIds })
        set((state) => {
          const next = new Map(state.nodes)
          next.set(node.parentId!, updatedParent)
          next.set(node.id, node)
          return { nodes: next }
        })
        return
      }
    }

    set((state) => {
      const next = new Map(state.nodes)
      next.set(node.id, node)
      return { nodes: next }
    })
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
    if (get().activeTreeId) {
      await db.trees.update(get().activeTreeId!, { updatedAt: Date.now() })
    }
  },

  setActiveTree: (treeId) => set({ activeTreeId: treeId }),

  submitPrompt: async (nodeId, userPrompt) => {
    const { nodes, settings, activeTreeId, appendTokenDelta, finalizeNode } = get()

    const tree = activeTreeId ? await db.trees.get(activeTreeId) : null
    const defaultSystemPrompt = tree?.defaultSystemPrompt ?? 'You are a helpful AI research assistant.'

    // Persist prompt + set streaming status
    const existing = nodes.get(nodeId)
    if (!existing) return () => {}
    if (existing.status === 'streaming') return () => {}
    const updated = { ...existing, userPrompt, status: 'streaming' as NodeStatus, assistantResponse: '', provider: settings.provider, errorMessage: '', inputTokens: undefined, outputTokens: undefined }
    await db.nodes.update(nodeId, { userPrompt, status: 'streaming', assistantResponse: '', provider: settings.provider, errorMessage: '', inputTokens: undefined, outputTokens: undefined })
    set((state) => {
      const next = new Map(state.nodes)
      next.set(nodeId, updated)
      // Remove any stale liveText entry for this node
      const nextLiveText = new Map(state.liveText)
      nextLiveText.delete(nodeId)
      return { nodes: next, liveText: nextLiveText }
    })

    // Clear any stale timer from a previous run so it cannot write into this fresh stream
    cancelThrottledFlush(nodeId)
    abortRegistry.delete(nodeId)

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

    try {
      const abort = await streamLLMResponse(
        payload,
        settings,
        { provider: settings.provider, model: existing.modelUsed || settings.defaultModel },
        (chunk) => appendTokenDelta(nodeId, chunk),
        (usage) => finalizeNode(nodeId, usage),
        (err) => {
          persistError(err)
        },
      )

      abortRegistry.set(nodeId, abort)
      return abort
    } catch (err) {
      await persistError(err)
      return () => {}
    }
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

    // Bump tree timestamp
    if (get().activeTreeId) {
      await db.trees.update(get().activeTreeId!, { updatedAt: Date.now() })
    }
  },
}))
