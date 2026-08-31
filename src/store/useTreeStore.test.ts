import { describe, it, expect, beforeEach } from 'vitest'
import { useTreeStore } from './useTreeStore'
import { db } from '../db/ChatDatabase'
import type { TurnNode } from '../types'

// Helper factory to create a TurnNode with sensible defaults
function createNode(overrides: Partial<TurnNode>): TurnNode {
  const id = overrides.id ?? crypto.randomUUID()
  return {
    id,
    treeId: overrides.treeId ?? 'tree-1',
    parentId: overrides.parentId ?? null,
    childrenIds: overrides.childrenIds ?? [],
    userPrompt: overrides.userPrompt ?? '',
    assistantResponse: overrides.assistantResponse ?? '',
    positionX: overrides.positionX ?? 400,
    positionY: overrides.positionY ?? 100,
    isCollapsed: overrides.isCollapsed ?? false,
    status: overrides.status ?? 'idle',
    modelUsed: overrides.modelUsed ?? 'test-model',
    timestamp: overrides.timestamp ?? Date.now(),
    systemPromptOverride: overrides.systemPromptOverride,
  }
}

describe('useTreeStore', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    useTreeStore.setState({
      nodes: new Map(),
      trees: [],
      activeTreeId: null,
      settings: {
        id: 'global_settings',
        ollamaBaseUrl: 'http://localhost:11434',
        defaultModel: 'gemini-2.5-flash',
        provider: 'gemini',
      },
    })
  })

  it('1. createTree creates a tree and root node', async () => {
    const tree = await useTreeStore.getState().createTree('My Tree')

    // Check database state
    const treesInDb = await db.trees.toArray()
    expect(treesInDb).toHaveLength(1)
    expect(treesInDb[0].id).toBe(tree.id)
    expect(treesInDb[0].title).toBe('My Tree')

    const nodesInDb = await db.nodes.toArray()
    expect(nodesInDb).toHaveLength(1)

    const rootNode = nodesInDb[0]
    expect(rootNode.id).toBe(tree.rootNodeId)
    expect(rootNode.parentId).toBeNull()
    expect(rootNode.treeId).toBe(tree.id)

    // Check in-memory store state
    const storeNodes = useTreeStore.getState().nodes
    expect(storeNodes.size).toBe(1)
    expect(storeNodes.get(tree.rootNodeId)).toBeDefined()
    expect(storeNodes.get(tree.rootNodeId)!.id).toBe(tree.rootNodeId)
  })

  it('2. addNode appends child to parent and updates both memory and db', async () => {
    const tree = await useTreeStore.getState().createTree('My Tree')
    const rootId = tree.rootNodeId

    const child = createNode({
      id: crypto.randomUUID(),
      treeId: tree.id,
      parentId: rootId,
      childrenIds: [],
    })

    await useTreeStore.getState().addNode(child)

    // Check in-memory state: parent should have child in childrenIds
    const memoryParent = useTreeStore.getState().nodes.get(rootId)!
    expect(memoryParent.childrenIds).toContain(child.id)

    // Check database: parent should have child in childrenIds
    const dbParent = await db.nodes.get(rootId)
    expect(dbParent!.childrenIds).toContain(child.id)

    // Check child exists in memory and db
    const memoryChild = useTreeStore.getState().nodes.get(child.id)
    expect(memoryChild).toBeDefined()
    expect(memoryChild!.id).toBe(child.id)

    const dbChild = await db.nodes.get(child.id)
    expect(dbChild).toBeDefined()
    expect(dbChild!.id).toBe(child.id)
  })

  it('3. appendTokenDelta creates new object and does not mutate old reference', async () => {
    const tree = await useTreeStore.getState().createTree('My Tree')
    const rootId = tree.rootNodeId

    const before = useTreeStore.getState().nodes.get(rootId)!
    const beforeResponse = before.assistantResponse
    expect(beforeResponse).toBe('')

    useTreeStore.getState().appendTokenDelta(rootId, 'Hello')
    useTreeStore.getState().appendTokenDelta(rootId, ' world')

    const after = useTreeStore.getState().nodes.get(rootId)!

    // After should be a different object reference
    expect(after).not.toBe(before)

    // Before should not have been mutated
    expect(before.assistantResponse).toBe(beforeResponse)

    // After should have the accumulated text
    expect(after.assistantResponse).toBe('Hello world')
  })

  it('4. appendTokenDelta for absent id is a no-op', async () => {
    const tree = await useTreeStore.getState().createTree('My Tree')
    const rootId = tree.rootNodeId

    const nodesRef = useTreeStore.getState().nodes
    const rootBefore = nodesRef.get(rootId)!

    useTreeStore.getState().appendTokenDelta('does-not-exist', 'x')

    // Nodes Map reference should be unchanged
    expect(useTreeStore.getState().nodes).toBe(nodesRef)

    // Root node should still be the same object
    expect(useTreeStore.getState().nodes.get(rootId)).toBe(rootBefore)
  })
})
