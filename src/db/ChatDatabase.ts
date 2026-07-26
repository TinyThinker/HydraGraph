import Dexie, { type Table } from 'dexie'
import type { TurnNode, ConversationTree, AppSettings } from '../types'

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
  }
}

export const db = new ChatDatabase()
