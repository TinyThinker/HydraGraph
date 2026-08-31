import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useTreeStore } from './useTreeStore'
import { db } from '../db/ChatDatabase'
import type { TurnNode } from '../types'

vi.mock('../lib/streamingClient', () => ({
  streamLLMResponse: vi.fn(),
}))

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

describe('throttled streaming writes', () => {
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

  it('coalesces rapid token appends into a single DB write per window', async () => {
    const tree = await useTreeStore.getState().createTree('My Tree')
    const rootId = tree.rootNodeId

    // Verify initial state: assistantResponse is empty in DB
    let dbNode = await db.nodes.get(rootId)
    expect(dbNode!.assistantResponse).toBe('')

    // Append tokens rapidly
    useTreeStore.getState().appendTokenDelta(rootId, 'a')
    useTreeStore.getState().appendTokenDelta(rootId, 'b')
    useTreeStore.getState().appendTokenDelta(rootId, 'c')

    // Immediately after append, DB should still have old text (no synchronous write)
    dbNode = await db.nodes.get(rootId)
    expect(dbNode!.assistantResponse).toBe('')

    // In-memory should have the accumulated text
    expect(useTreeStore.getState().nodes.get(rootId)!.assistantResponse).toBe('abc')

    // Wait for throttle window (~400ms) plus small buffer
    await new Promise((r) => setTimeout(r, 450))

    // Now DB should have the coalesced text
    dbNode = await db.nodes.get(rootId)
    expect(dbNode!.assistantResponse).toBe('abc')

    // Append more tokens (timer should re-arm for the next window)
    useTreeStore.getState().appendTokenDelta(rootId, 'd')

    // DB should still have the old text before timer fires
    dbNode = await db.nodes.get(rootId)
    expect(dbNode!.assistantResponse).toBe('abc')

    // In-memory should have new text
    expect(useTreeStore.getState().nodes.get(rootId)!.assistantResponse).toBe('abcd')

    // Wait for throttle window again
    await new Promise((r) => setTimeout(r, 450))

    // Now DB should have the new text
    dbNode = await db.nodes.get(rootId)
    expect(dbNode!.assistantResponse).toBe('abcd')
  })

  it('finalizeNode cancels the pending throttled write and persists the final text', async () => {
    const tree = await useTreeStore.getState().createTree('My Tree')
    const rootId = tree.rootNodeId

    // Append a token (schedules throttled flush)
    useTreeStore.getState().appendTokenDelta(rootId, 'x')

    // Immediately finalize (should cancel pending flush and write final state)
    await useTreeStore.getState().finalizeNode(rootId, { inputTokens: 0, outputTokens: 0 })

    // DB should have the final text and status should be 'idle'
    let dbNode = await db.nodes.get(rootId)
    expect(dbNode!.assistantResponse).toBe('x')
    expect(dbNode!.status).toBe('idle')

    // Wait well beyond the throttle window to prove timer was cancelled
    await new Promise((r) => setTimeout(r, 500))

    // DB state should not have changed (timer did not fire)
    const dbNodeAfter = await db.nodes.get(rootId)
    expect(dbNodeAfter!.assistantResponse).toBe('x')
    expect(dbNodeAfter!.status).toBe('idle')
  })
})

describe('stream error surfacing', () => {
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

  it('persists error message to DB and in-memory state on stream error', async () => {
    const { streamLLMResponse } = await import('../lib/streamingClient')
    vi.mocked(streamLLMResponse).mockImplementation(
      async (_payload, _settings, _target, _onToken, _onDone, onError) => {
        onError(new Error('HTTP 401: invalid api key'))
        return () => {}
      }
    )

    const tree = await useTreeStore.getState().createTree('My Tree')
    const rootId = tree.rootNodeId

    await useTreeStore.getState().submitPrompt(rootId, 'hi')

    // Check DB state
    const dbNode = await db.nodes.get(rootId)
    expect(dbNode!.status).toBe('error')
    expect(dbNode!.errorMessage).toContain('invalid api key')

    // Check in-memory state
    const memNode = useTreeStore.getState().nodes.get(rootId)
    expect(memNode!.status).toBe('error')
    expect(memNode!.errorMessage).toContain('invalid api key')
  })

  it('clears errorMessage when starting a new prompt', async () => {
    const { streamLLMResponse } = await import('../lib/streamingClient')
    vi.mocked(streamLLMResponse).mockImplementation(
      async (_payload, _settings, _target, _onToken, _onDone, onError) => {
        onError(new Error('HTTP 401: invalid api key'))
        return () => {}
      }
    )

    const tree = await useTreeStore.getState().createTree('My Tree')
    const rootId = tree.rootNodeId

    await useTreeStore.getState().submitPrompt(rootId, 'hi')

    // Verify error was persisted
    let dbNode = await db.nodes.get(rootId)
    expect(dbNode!.errorMessage).toContain('invalid api key')

    // Reconfigure mock to succeed this time
    vi.mocked(streamLLMResponse).mockImplementation(
      async (_payload, _settings, _target, _onToken, onDone, _onError) => {
        onDone({ inputTokens: 0, outputTokens: 0 })
        return () => {}
      }
    )

    // Submit a new prompt
    await useTreeStore.getState().submitPrompt(rootId, 'again')

    // Check that errorMessage is cleared
    dbNode = await db.nodes.get(rootId)
    expect(dbNode!.errorMessage).toBe('')

    const memNode = useTreeStore.getState().nodes.get(rootId)
    expect(memNode!.errorMessage).toBe('')
  })
})

describe('zombie streaming recovery on load', () => {
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

  it('rewrites stale streaming nodes to error on loadTree and keeps partial text', async () => {
    // Create a tree
    const tree = await useTreeStore.getState().createTree('Test Tree')
    const treeId = tree.id
    const rootId = tree.rootNodeId

    // Insert a stale streaming node (simulating an interrupted stream from a previous session)
    const streamingNodeId = crypto.randomUUID()
    const streamingNode = createNode({
      id: streamingNodeId,
      treeId,
      parentId: rootId,
      assistantResponse: 'partial answer so far',
      status: 'streaming',
    })

    // Insert an idle node with completed response
    const idleNodeId = crypto.randomUUID()
    const idleNode = createNode({
      id: idleNodeId,
      treeId,
      parentId: rootId,
      assistantResponse: 'done',
      status: 'idle',
    })

    await db.nodes.put(streamingNode)
    await db.nodes.put(idleNode)

    // Clear the in-memory store to simulate a page reload
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

    // Load the tree (should trigger zombie recovery)
    await useTreeStore.getState().loadTree(treeId)

    // Check the streaming node in memory: should now be error with message, partial text preserved
    const memoryStreamingNode = useTreeStore.getState().nodes.get(streamingNodeId)
    expect(memoryStreamingNode).toBeDefined()
    expect(memoryStreamingNode!.status).toBe('error')
    expect(memoryStreamingNode!.errorMessage).toBeTruthy()
    expect(memoryStreamingNode!.assistantResponse).toBe('partial answer so far')

    // Check the streaming node in DB: should also be error with message
    const dbStreamingNode = await db.nodes.get(streamingNodeId)
    expect(dbStreamingNode).toBeDefined()
    expect(dbStreamingNode!.status).toBe('error')
    expect(dbStreamingNode!.errorMessage).toBeTruthy()
    expect(dbStreamingNode!.assistantResponse).toBe('partial answer so far')

    // Check the idle node: should be untouched
    const memoryIdleNode = useTreeStore.getState().nodes.get(idleNodeId)
    expect(memoryIdleNode).toBeDefined()
    expect(memoryIdleNode!.status).toBe('idle')
    expect(memoryIdleNode!.assistantResponse).toBe('done')
    expect(memoryIdleNode!.errorMessage).toBeFalsy()

    const dbIdleNode = await db.nodes.get(idleNodeId)
    expect(dbIdleNode).toBeDefined()
    expect(dbIdleNode!.status).toBe('idle')
    expect(dbIdleNode!.assistantResponse).toBe('done')
    expect(dbIdleNode!.errorMessage).toBeFalsy()
  })
})
