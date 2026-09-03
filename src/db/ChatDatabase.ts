import Dexie, { type Table } from 'dexie'
import type { TurnNode, ConversationTree, AppSettings } from '../types'
import type { CatalogModel } from '../lib/openRouterCatalog'

// Cached OpenRouter model catalog. One row per source key (currently just
// `openrouter`). `models` holds the normalized catalog shape owned by
// `src/lib/openRouterCatalog.ts`.
export interface CatalogRow {
  key: string
  models: CatalogModel[]
  fetchedAt: number
}

// Gemini native model id -> closest OpenRouter `google/*` id. Used by the v5
// migration to remap historical `defaultModel` / `modelUsed` values.
export const GEMINI_ID_REMAP: Record<string, string> = {
  'gemini-2.5-flash': 'google/gemini-2.5-flash',
  'gemini-2.5-pro': 'google/gemini-2.5-pro',
  'gemini-1.5-flash': 'google/gemini-flash-1.5',
  'gemini-1.5-pro': 'google/gemini-pro-1.5',
}

function remapGeminiId(model: unknown): string | undefined {
  if (typeof model !== 'string' || !model) return undefined
  if (GEMINI_ID_REMAP[model]) return GEMINI_ID_REMAP[model]
  return model.startsWith('gemini-') ? `google/${model}` : undefined
}

class ChatDatabase extends Dexie {
  nodes!: Table<TurnNode>
  trees!: Table<ConversationTree>
  settings!: Table<AppSettings>
  catalog!: Table<CatalogRow>

  constructor() {
    super('HydraGraphDB')
    this.version(1).stores({
      nodes: 'id, treeId, parentId, timestamp',
      trees: 'id, createdAt, updatedAt',
      settings: 'id',
    })

    this.version(2)
      .stores({
        nodes: 'id, treeId, parentId, timestamp',
        trees: 'id, createdAt, updatedAt',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        // Migrate settings: set provider based on geminiApiKey presence.
        // (`gemini` is a legacy provider value here — v5 remaps it to `openrouter`.)
        const allSettings = await tx.table('settings').toArray()
        for (const row of allSettings) {
          const provider = row.geminiApiKey ? 'gemini' : 'ollama'
          await tx.table('settings').update(row.id, { provider })
        }

        // Infer provider for nodes from the first settings row (or default to ollama)
        const settingsRow = allSettings[0]
        const inferredProvider = settingsRow && settingsRow.geminiApiKey ? 'gemini' : 'ollama'

        // Set provider on all existing nodes, and default errorMessage
        const allNodes = await tx.table('nodes').toArray()
        for (const node of allNodes) {
          await tx.table('nodes').update(node.id, { provider: inferredProvider, errorMessage: '' })
        }
      })

    // version(3): backfills width, height (T4.2) and stale:false (T4.6) on existing node rows
    this.version(3)
      .stores({
        nodes: 'id, treeId, parentId, timestamp',
        trees: 'id, createdAt, updatedAt',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        // Backfill width, height, and stale on all existing nodes
        const allNodes = await tx.table('nodes').toArray()
        for (const node of allNodes) {
          const updates: Record<string, number | boolean> = {}
          if (node.width === undefined || node.width === null) {
            updates.width = 320
          }
          if (node.height === undefined || node.height === null) {
            updates.height = 240
          }
          if (node.stale === undefined || node.stale === null) {
            updates.stale = false
          }
          if (Object.keys(updates).length > 0) {
            await tx.table('nodes').update(node.id, updates)
          }
        }
      })

    // version(4): backfills viewportX, viewportY, viewportZoom on tree rows (T5.9)
    this.version(4)
      .stores({
        nodes: 'id, treeId, parentId, timestamp',
        trees: 'id, createdAt, updatedAt',
        settings: 'id',
      })
      .upgrade(async (tx) => {
        // Backfill viewport settings on all existing trees
        const allTrees = await tx.table('trees').toArray()
        for (const tree of allTrees) {
          const updates: Record<string, number> = {}
          if (tree.viewportX === undefined || tree.viewportX === null) {
            updates.viewportX = 0
          }
          if (tree.viewportY === undefined || tree.viewportY === null) {
            updates.viewportY = 0
          }
          if (tree.viewportZoom === undefined || tree.viewportZoom === null) {
            updates.viewportZoom = 1
          }
          if (Object.keys(updates).length > 0) {
            await tx.table('trees').update(tree.id, updates)
          }
        }
      })

    // version(5): drop the native Gemini provider. Adds the `catalog` store for
    // the cached OpenRouter model list (Phase 2). Best-effort / lossy remap of
    // existing rows: `provider: 'gemini' -> 'openrouter'`, delete `geminiApiKey`,
    // delete `defaultModels.gemini`, remap gemini model ids to their `google/*`
    // OpenRouter equivalents on settings + nodes.
    this.version(5)
      .stores({
        nodes: 'id, treeId, parentId, timestamp',
        trees: 'id, createdAt, updatedAt',
        settings: 'id',
        catalog: 'key',
      })
      .upgrade(async (tx) => {
        const settingsRows = await tx.table('settings').toArray()
        for (const row of settingsRows) {
          const updates: Record<string, unknown> = {}
          if (row.provider === 'gemini') updates.provider = 'openrouter'
          if (row.geminiApiKey !== undefined) updates.geminiApiKey = undefined
          if (row.defaultModels && 'gemini' in row.defaultModels) {
            const nextModels = { ...row.defaultModels }
            delete nextModels.gemini
            updates.defaultModels = nextModels
          }
          const remappedDefault = remapGeminiId(row.defaultModel)
          if (remappedDefault) updates.defaultModel = remappedDefault
          if (Object.keys(updates).length > 0) {
            await tx.table('settings').update(row.id, updates)
          }
        }

        const allNodes = await tx.table('nodes').toArray()
        for (const node of allNodes) {
          const updates: Record<string, unknown> = {}
          if (node.provider === 'gemini') updates.provider = 'openrouter'
          if (node.providerOverride === 'gemini') updates.providerOverride = 'openrouter'
          const remappedModel = remapGeminiId(node.modelUsed)
          if (remappedModel) updates.modelUsed = remappedModel
          if (Object.keys(updates).length > 0) {
            await tx.table('nodes').update(node.id, updates)
          }
        }
      })
  }
}

export const db = new ChatDatabase()
