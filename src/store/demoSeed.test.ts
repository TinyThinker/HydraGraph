import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useTreeStore } from './useTreeStore'
import { useSettingsStore, DEFAULT_SETTINGS } from './settingsStore'
import { db } from '../db/ChatDatabase'
import { DEMO_TREE_ID } from '../lib/demoTree'
import { DEMO_TURNS } from '../lib/demoContent'

beforeEach(async () => {
  await db.delete()
  await db.open()
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS }, hydrated: true })
  useTreeStore.setState({
    nodes: new Map(),
    trees: [],
    activeTreeId: null,
    liveText: new Map(),
    lastSpawnedNodeId: null,
  })
})

afterEach(async () => {
  await db.delete()
})

describe('seedDemoTree', () => {
  it('persists the demo tree and opens it', async () => {
    const tree = await useTreeStore.getState().seedDemoTree()

    expect(tree.id).toBe(DEMO_TREE_ID)
    expect(await db.trees.get(DEMO_TREE_ID)).toBeDefined()
    expect(await db.nodes.where('treeId').equals(DEMO_TREE_ID).count()).toBe(DEMO_TURNS.length)

    const state = useTreeStore.getState()
    expect(state.activeTreeId).toBe(DEMO_TREE_ID)
    expect(state.nodes.size).toBe(DEMO_TURNS.length)
    // Opening it also becomes the remembered tree, so a reload comes back here.
    expect(useSettingsStore.getState().settings.activeTreeId).toBe(DEMO_TREE_ID)
  })

  it('is idempotent — re-seeding replaces rather than duplicating', async () => {
    await useTreeStore.getState().seedDemoTree()
    await useTreeStore.getState().seedDemoTree()

    expect(await db.nodes.where('treeId').equals(DEMO_TREE_ID).count()).toBe(DEMO_TURNS.length)
    expect(await db.trees.count()).toBe(1)
    expect(useTreeStore.getState().trees.filter((t) => t.id === DEMO_TREE_ID)).toHaveLength(1)
  })

  it('resets a demo tree the visitor poked at', async () => {
    const { seedDemoTree } = useTreeStore.getState()
    const tree = await seedDemoTree()
    const rootId = tree.rootNodeId

    await useTreeStore.getState().updateNode(rootId, { assistantResponse: 'scribbled over' })
    expect(useTreeStore.getState().nodes.get(rootId)!.assistantResponse).toBe('scribbled over')

    await seedDemoTree()
    expect(useTreeStore.getState().nodes.get(rootId)!.assistantResponse).not.toBe('scribbled over')
  })

  it('leaves a visitor’s own trees alone', async () => {
    const mine = await useTreeStore.getState().createTree('My research')
    await useTreeStore.getState().seedDemoTree()

    expect(await db.trees.count()).toBe(2)
    expect(await db.trees.get(mine.id)).toBeDefined()
    expect(await db.nodes.where('treeId').equals(mine.id).count()).toBe(1)
  })
})
