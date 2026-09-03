import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { describe, it, expect } from 'vitest'
import { db } from './ChatDatabase'

const DB_NAME = 'HydraGraphDB'

// Loosened views for reading legacy fields the current types no longer model.
type LegacySettings = Record<string, unknown> & {
  defaultModels?: Record<string, string>
}

async function seedV4() {
  await db.close()
  await Dexie.delete(DB_NAME)

  const legacy = new Dexie(DB_NAME)
  legacy.version(4).stores({
    nodes: 'id, treeId, parentId, timestamp',
    trees: 'id, createdAt, updatedAt',
    settings: 'id',
  })
  await legacy.open()

  await legacy.table('settings').put({
    id: 'global_settings',
    provider: 'gemini',
    geminiApiKey: 'AIza-secret',
    openRouterApiKey: 'or-key',
    ollamaBaseUrl: 'http://localhost:11434',
    openRouterBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'gemini-2.5-flash',
    defaultModels: {
      gemini: 'gemini-1.5-pro',
      openrouter: 'openai/gpt-4o-mini',
      ollama: 'llama3',
    },
  })

  const baseNode = {
    treeId: 't1',
    parentId: null,
    childrenIds: [] as string[],
    userPrompt: 'q',
    assistantResponse: 'a',
    positionX: 0,
    positionY: 0,
    isCollapsed: false,
    status: 'idle',
    timestamp: 1,
  }
  await legacy.table('nodes').bulkPut([
    { ...baseNode, id: 'n1', modelUsed: 'gemini-2.5-flash', provider: 'gemini', providerOverride: 'gemini' },
    { ...baseNode, id: 'n2', modelUsed: 'gemini-2.0-flash-exp', provider: 'gemini' },
    { ...baseNode, id: 'n3', modelUsed: 'openai/gpt-4o', provider: 'ollama' },
  ])

  legacy.close()
}

describe('ChatDatabase v5 migration (remove Gemini)', () => {
  it('remaps gemini -> openrouter across settings + nodes and adds the catalog store', async () => {
    await seedV4()

    // Opening the current (v5) schema triggers the upgrade.
    await db.open()

    const settings = (await db.settings.get('global_settings')) as unknown as LegacySettings
    expect(settings.provider).toBe('openrouter')
    expect(settings.geminiApiKey).toBeUndefined()
    expect(settings.openRouterApiKey).toBe('or-key')
    expect(settings.defaultModel).toBe('google/gemini-2.5-flash')
    expect(settings.defaultModels?.gemini).toBeUndefined()
    expect(settings.defaultModels?.openrouter).toBe('openai/gpt-4o-mini')
    expect(settings.defaultModels?.ollama).toBe('llama3')

    const n1 = await db.nodes.get('n1')
    expect(n1?.provider).toBe('openrouter')
    expect(n1?.providerOverride).toBe('openrouter')
    expect(n1?.modelUsed).toBe('google/gemini-2.5-flash')

    const n2 = await db.nodes.get('n2')
    expect(n2?.provider).toBe('openrouter')
    // Unknown gemini id -> generic google/* prefix remap.
    expect(n2?.modelUsed).toBe('google/gemini-2.0-flash-exp')

    const n3 = await db.nodes.get('n3')
    expect(n3?.provider).toBe('ollama')
    expect(n3?.modelUsed).toBe('openai/gpt-4o')

    // The new catalog store is present and writable.
    await db.catalog.put({ key: 'openrouter', models: [], fetchedAt: 123 })
    expect((await db.catalog.get('openrouter'))?.fetchedAt).toBe(123)
  })
})
