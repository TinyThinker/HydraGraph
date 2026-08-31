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
}

const DEFAULT_SETTINGS: AppSettings = {
  id: 'global_settings',
  ollamaBaseUrl: 'http://localhost:11434',
  defaultModel: 'gemini-2.5-flash',
  provider: 'gemini',
}

// Module-scope: map of node id → pending flush timer
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

// Schedule a throttled flush for a node id. If a timer already exists,
// do nothing (the existing timer will write the latest text when it fires).
// Otherwise, set a timer for ~400ms that reads the current in-memory node text
// and writes it to the database.
function scheduleThrottledFlush(nodeId: string) {
  if (pendingTimers.has(nodeId)) {
    return // Already scheduled; new text will be written when timer fires
  }

  const timerId = setTimeout(() => {
    const node = useTreeStore.getState().nodes.get(nodeId)
    if (node) {
      db.nodes.update(nodeId, { assistantResponse: node.assistantResponse }).catch((err) => {
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

export const useTreeStore = create<TreeStoreState & TreeStoreActions>((set, get) => ({
  nodes: new Map(),
  trees: [],
  activeTreeId: null,
  settings: DEFAULT_SETTINGS,

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
    const nodes = new Map(nodeArray.map((n) => [n.id, n]))
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
      const existing = state.nodes.get(id)
      if (!existing) return state
      const next = new Map(state.nodes)
      next.set(id, { ...existing, assistantResponse: existing.assistantResponse + chunk })
      return { nodes: next }
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

    const existing = get().nodes.get(id)
    if (!existing) return
    const patch = { status: 'idle' as NodeStatus, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens }
    const updated = { ...existing, ...patch }
    await db.nodes.update(id, { ...patch, assistantResponse: updated.assistantResponse })
    set((state) => {
      const next = new Map(state.nodes)
      next.set(id, updated)
      return { nodes: next }
    })
    if (get().activeTreeId) {
      await db.trees.update(get().activeTreeId!, { updatedAt: Date.now() })
    }
  },

  setActiveTree: (treeId) => set({ activeTreeId: treeId }),

  submitPrompt: async (nodeId, userPrompt) => {
    const { nodes, settings, activeTreeId, appendTokenDelta, finalizeNode, setNodeStatus } = get()

    const tree = activeTreeId ? await db.trees.get(activeTreeId) : null
    const defaultSystemPrompt = tree?.defaultSystemPrompt ?? 'You are a helpful AI research assistant.'

    // Persist prompt + set streaming status
    const existing = nodes.get(nodeId)
    if (!existing) return () => {}
    const updated = { ...existing, userPrompt, status: 'streaming' as NodeStatus, assistantResponse: '', provider: settings.provider }
    await db.nodes.update(nodeId, { userPrompt, status: 'streaming', assistantResponse: '', provider: settings.provider })
    set((state) => {
      const next = new Map(state.nodes)
      next.set(nodeId, updated)
      return { nodes: next }
    })

    // Clear any stale timer from a previous run so it cannot write into this fresh stream
    cancelThrottledFlush(nodeId)

    const payload = resolveContextPayload(nodeId, get().nodes, defaultSystemPrompt)

    // Local async function to persist error state: cancel pending flush, read current text, and write error + text to DB
    const persistError = async (err: unknown) => {
      console.error('[stream error]', err)
      cancelThrottledFlush(nodeId)
      const currentNode = get().nodes.get(nodeId)
      if (currentNode) {
        await db.nodes.update(nodeId, { status: 'error', assistantResponse: currentNode.assistantResponse })
      }
      setNodeStatus(nodeId, 'error')
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

      return abort
    } catch (err) {
      await persistError(err)
      return () => {}
    }
  },
}))
