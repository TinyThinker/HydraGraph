import Dexie, { type Table } from 'dexie'
import type { TurnNode, ConversationTree, AppSettings, LLMProvider } from '../types'

class ChatDatabase extends Dexie {
  nodes!: Table<TurnNode>
  trees!: Table<ConversationTree>
  settings!: Table<AppSettings>

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
        // Migrate settings: set provider based on geminiApiKey presence
        const allSettings = await tx.table('settings').toArray()
        for (const row of allSettings) {
          const provider: LLMProvider = row.geminiApiKey ? 'gemini' : 'ollama'
          await tx.table('settings').update(row.id, { provider })
        }

        // Infer provider for nodes from the first settings row (or default to ollama)
        const settingsRow = allSettings[0]
        const inferredProvider: LLMProvider = settingsRow && settingsRow.geminiApiKey ? 'gemini' : 'ollama'

        // Set provider on all existing nodes, and default errorMessage
        const allNodes = await tx.table('nodes').toArray()
        for (const node of allNodes) {
          await tx.table('nodes').update(node.id, { provider: inferredProvider, errorMessage: '' })
        }
      })

    // version(3): backfills width, height (T4.2) and stale:false (T4.6) on existing node rows — do NOT add version(4)
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
  }
}

export const db = new ChatDatabase()
