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

        // Set provider on all existing nodes
        const allNodes = await tx.table('nodes').toArray()
        for (const node of allNodes) {
          await tx.table('nodes').update(node.id, { provider: inferredProvider })
        }

        // TODO: Add more field back-fills here (e.g., errorMessage default)
      })
  }
}

export const db = new ChatDatabase()
