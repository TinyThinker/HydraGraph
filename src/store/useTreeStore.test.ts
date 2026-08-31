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
    stale: overrides.stale,
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
      liveText: new Map(),
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

  it('3. appendTokenDelta writes live text without touching the node object', async () => {
    const tree = await useTreeStore.getState().createTree('My Tree')
    const rootId = tree.rootNodeId

    const nodeBeforeStream = useTreeStore.getState().nodes.get(rootId)!
    expect(nodeBeforeStream.assistantResponse).toBe('')

    useTreeStore.getState().appendTokenDelta(rootId, 'Hello')
    useTreeStore.getState().appendTokenDelta(rootId, ' world')

    const nodeAfterStream = useTreeStore.getState().nodes.get(rootId)!

    // Node object should be the SAME reference (untouched)
    expect(nodeAfterStream).toBe(nodeBeforeStream)

    // Node's assistantResponse should still be empty (tokens go to liveText, not node)
    expect(nodeAfterStream.assistantResponse).toBe('')

    // liveText should have the accumulated chunks
    expect(useTreeStore.getState().liveText.get(rootId)).toBe('Hello world')
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

    // liveText should remain empty
    expect(useTreeStore.getState().liveText.size).toBe(0)
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
      liveText: new Map(),
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

    // In-memory liveText should have the accumulated text
    expect(useTreeStore.getState().liveText.get(rootId)).toBe('abc')

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

    // In-memory liveText should have new text
    expect(useTreeStore.getState().liveText.get(rootId)).toBe('abcd')

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
      liveText: new Map(),
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
      liveText: new Map(),
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

describe('cancel generation', () => {
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
      liveText: new Map(),
    })
  })

  it('cancels streaming, preserves partial text, and returns to idle', async () => {
    const { streamLLMResponse } = await import('../lib/streamingClient')
    const abortSpy = vi.fn()
    vi.mocked(streamLLMResponse).mockImplementation(
      async (_payload, _settings, _target, _onToken, _onDone, _onError) => {
        return abortSpy
      }
    )

    const tree = await useTreeStore.getState().createTree('My Tree')
    const rootId = tree.rootNodeId

    // Submit a prompt (starts streaming)
    await useTreeStore.getState().submitPrompt(rootId, 'hi')

    // Simulate partial streaming
    useTreeStore.getState().appendTokenDelta(rootId, 'partial text')

    // Verify we're streaming with partial text (in liveText, not in node)
    expect(useTreeStore.getState().nodes.get(rootId)!.status).toBe('streaming')
    expect(useTreeStore.getState().liveText.get(rootId)).toBe('partial text')

    // Cancel the generation
    await useTreeStore.getState().cancelGeneration(rootId)

    // Assert: abort was called exactly once
    expect(abortSpy).toHaveBeenCalledTimes(1)

    // Assert: status is now idle
    expect(useTreeStore.getState().nodes.get(rootId)!.status).toBe('idle')

    // Assert: partial text is preserved
    expect(useTreeStore.getState().nodes.get(rootId)!.assistantResponse).toBe('partial text')

    // Assert: DB also reflects idle status and preserved text
    const dbNode = await db.nodes.get(rootId)
    expect(dbNode!.status).toBe('idle')
    expect(dbNode!.assistantResponse).toBe('partial text')

    // Assert: calling cancel again does not throw and abort is still only called once
    await useTreeStore.getState().cancelGeneration(rootId)
    expect(abortSpy).toHaveBeenCalledTimes(1)
  })
})

describe('regenerate and edit prompts', () => {
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
      liveText: new Map(),
    })
  })

  it('regenerate via submitPrompt clears the previous response and error and re-enters streaming', async () => {
    const { streamLLMResponse } = await import('../lib/streamingClient')
    vi.mocked(streamLLMResponse).mockImplementation(
      async (_payload, _settings, _target, _onToken, _onDone, _onError) => {
        return () => {}
      }
    )

    const tree = await useTreeStore.getState().createTree('My Tree')
    const rootId = tree.rootNodeId

    // Set node to error state with old response
    await useTreeStore.getState().updateNode(rootId, {
      userPrompt: 'q',
      assistantResponse: 'old answer',
      status: 'error',
      errorMessage: 'boom',
    })

    // Regenerate with the same prompt
    await useTreeStore.getState().submitPrompt(rootId, 'q')

    // Assert: in-memory node has cleared response and error
    const memNode = useTreeStore.getState().nodes.get(rootId)!
    expect(memNode.assistantResponse).toBe('')
    expect(memNode.errorMessage).toBe('')
    expect(memNode.status).toBe('streaming')
    expect(memNode.userPrompt).toBe('q')

    // Assert: DB also has cleared response and error
    const dbNode = await db.nodes.get(rootId)
    expect(dbNode!.assistantResponse).toBe('')
    expect(dbNode!.errorMessage).toBe('')
    expect(dbNode!.status).toBe('streaming')
  })

  it('edit via submitPrompt changes the stored prompt', async () => {
    const { streamLLMResponse } = await import('../lib/streamingClient')
    vi.mocked(streamLLMResponse).mockImplementation(
      async (_payload, _settings, _target, _onToken, _onDone, _onError) => {
        return () => {}
      }
    )

    const tree = await useTreeStore.getState().createTree('My Tree')
    const rootId = tree.rootNodeId

    // Set initial prompt
    await useTreeStore.getState().updateNode(rootId, {
      userPrompt: 'original prompt',
      assistantResponse: 'old answer',
      status: 'idle',
    })

    // Edit to a different prompt
    await useTreeStore.getState().submitPrompt(rootId, 'a different question')

    // Assert: in-memory node has new prompt
    const memNode = useTreeStore.getState().nodes.get(rootId)!
    expect(memNode.userPrompt).toBe('a different question')

    // Assert: DB also has new prompt
    const dbNode = await db.nodes.get(rootId)
    expect(dbNode!.userPrompt).toBe('a different question')
  })

  it('submitPrompt is a no-op while the node is already streaming', async () => {
    const { streamLLMResponse } = await import('../lib/streamingClient')
    vi.mocked(streamLLMResponse).mockImplementation(
      async (_payload, _settings, _target, _onToken, _onDone, _onError) => {
        return () => {}
      }
    )

    const tree = await useTreeStore.getState().createTree('My Tree')
    const rootId = tree.rootNodeId

    // Start streaming
    await useTreeStore.getState().submitPrompt(rootId, 'q')

    // Clear the mock call count
    vi.mocked(streamLLMResponse).mockClear()

    // Try to submit while streaming (should be no-op)
    await useTreeStore.getState().submitPrompt(rootId, 'q2')

    // Assert: streamLLMResponse was NOT called
    expect(vi.mocked(streamLLMResponse)).not.toHaveBeenCalled()

    // Assert: node status is still streaming
    const node = useTreeStore.getState().nodes.get(rootId)!
    expect(node.status).toBe('streaming')
  })

  it('submitPrompt requests the node\'s own modelUsed', async () => {
    const { streamLLMResponse } = await import('../lib/streamingClient')
    vi.mocked(streamLLMResponse).mockImplementation(async () => () => {})

    const tree = await useTreeStore.getState().createTree('My Tree')
    const rootId = tree.rootNodeId

    // Update node with a custom model
    await useTreeStore.getState().updateNode(rootId, { modelUsed: 'special-model-v9' })

    // Submit prompt
    await useTreeStore.getState().submitPrompt(rootId, 'hi')

    // Assert: streamLLMResponse was called with the node's custom model
    expect(vi.mocked(streamLLMResponse)).toHaveBeenCalledTimes(1)
    const call = vi.mocked(streamLLMResponse).mock.calls[0]
    expect(call[2]).toEqual({ provider: 'gemini', model: 'special-model-v9' })
  })

  it('editing/regenerating a parent leaves its children in place', async () => {
    const { streamLLMResponse } = await import('../lib/streamingClient')
    vi.mocked(streamLLMResponse).mockImplementation(
      async (_payload, _settings, _target, _onToken, _onDone, _onError) => {
        return () => {}
      }
    )

    const tree = await useTreeStore.getState().createTree('Test Tree')
    const rootId = tree.rootNodeId

    // Add a child node
    const childId = crypto.randomUUID()
    const child = createNode({
      id: childId,
      treeId: tree.id,
      parentId: rootId,
      childrenIds: [],
    })
    await useTreeStore.getState().addNode(child)

    // Verify child is in place
    expect(useTreeStore.getState().nodes.get(rootId)!.childrenIds).toContain(childId)

    // Edit/regenerate the parent
    await useTreeStore.getState().submitPrompt(rootId, 'edited')

    // Assert: child still exists in memory
    expect(useTreeStore.getState().nodes.has(childId)).toBe(true)

    // Assert: child still exists in DB
    const dbChild = await db.nodes.get(childId)
    expect(dbChild).toBeDefined()

    // Assert: parent's childrenIds still contains child
    const parentAfter = useTreeStore.getState().nodes.get(rootId)!
    expect(parentAfter.childrenIds).toContain(childId)
  })
})

describe('collapse and expand', () => {
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
      liveText: new Map(),
    })
  })

  it('toggleCollapse flips isCollapsed in memory and DB and is reversible', async () => {
    const tree = await useTreeStore.getState().createTree('Test Tree')
    const r = tree.rootNodeId

    // Initially not collapsed
    expect(useTreeStore.getState().nodes.get(r)!.isCollapsed).toBe(false)
    expect((await db.nodes.get(r))!.isCollapsed).toBe(false)

    // Toggle to collapsed
    await useTreeStore.getState().toggleCollapse(r)
    expect(useTreeStore.getState().nodes.get(r)!.isCollapsed).toBe(true)
    expect((await db.nodes.get(r))!.isCollapsed).toBe(true)

    // Toggle back to expanded
    await useTreeStore.getState().toggleCollapse(r)
    expect(useTreeStore.getState().nodes.get(r)!.isCollapsed).toBe(false)
    expect((await db.nodes.get(r))!.isCollapsed).toBe(false)
  })

  it('a hidden (collapsed-ancestor) node still streams and persists', async () => {
    const { streamLLMResponse } = await import('../lib/streamingClient')
    vi.mocked(streamLLMResponse).mockImplementation(async () => () => {})

    const tree = await useTreeStore.getState().createTree('Test Tree')
    const r = tree.rootNodeId

    // Add child a under r
    const a = crypto.randomUUID()
    await useTreeStore.getState().addNode(createNode({ id: a, treeId: tree.id, parentId: r, childrenIds: [] }))

    // Collapse r, so a is hidden on canvas
    await useTreeStore.getState().toggleCollapse(r)
    expect(useTreeStore.getState().nodes.get(r)!.isCollapsed).toBe(true)

    // Submit prompt on a (while it's hidden)
    await useTreeStore.getState().submitPrompt(a, 'q')

    // Simulate streaming
    useTreeStore.getState().appendTokenDelta(a, 'hello')

    // Finalize the stream
    await useTreeStore.getState().finalizeNode(a, { inputTokens: 1, outputTokens: 2 })

    // Assert node a is still in memory
    expect(useTreeStore.getState().nodes.has(a)).toBe(true)

    // Assert response is persisted in memory and DB
    expect(useTreeStore.getState().nodes.get(a)!.assistantResponse).toBe('hello')
    expect((await db.nodes.get(a))!.assistantResponse).toBe('hello')

    // Assert status is idle
    expect(useTreeStore.getState().nodes.get(a)!.status).toBe('idle')
  })
})

describe('delete node and subtree', () => {
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
      liveText: new Map(),
    })
  })

  it('collectSubtreeIds collects a node and all descendants', async () => {
    const tree = await useTreeStore.getState().createTree('Test Tree')
    const rootId = tree.rootNodeId

    // Add child a under root
    const aId = crypto.randomUUID()
    const a = createNode({
      id: aId,
      treeId: tree.id,
      parentId: rootId,
      childrenIds: [],
    })
    await useTreeStore.getState().addNode(a)

    // Add grandchild b under a
    const bId = crypto.randomUUID()
    const b = createNode({
      id: bId,
      treeId: tree.id,
      parentId: aId,
      childrenIds: [],
    })
    await useTreeStore.getState().addNode(b)

    // Add child c under root
    const cId = crypto.randomUUID()
    const c = createNode({
      id: cId,
      treeId: tree.id,
      parentId: rootId,
      childrenIds: [],
    })
    await useTreeStore.getState().addNode(c)

    const { collectSubtreeIds } = await import('../store/useTreeStore')
    const nodesMap = useTreeStore.getState().nodes

    // collectSubtreeIds(a) should return {a, b}
    const subtreeA = collectSubtreeIds(aId, nodesMap)
    expect(subtreeA).toEqual(new Set([aId, bId]))

    // collectSubtreeIds(root) should return {root, a, b, c}
    const subtreeRoot = collectSubtreeIds(rootId, nodesMap)
    expect(subtreeRoot).toEqual(new Set([rootId, aId, bId, cId]))

    // collectSubtreeIds(b) should return {b}
    const subtreeB = collectSubtreeIds(bId, nodesMap)
    expect(subtreeB).toEqual(new Set([bId]))
  })

  it('deleteNodeSubtree removes a node and all descendants from memory and db', async () => {
    const tree = await useTreeStore.getState().createTree('Test Tree')
    const rootId = tree.rootNodeId

    // Add child a under root
    const aId = crypto.randomUUID()
    const a = createNode({
      id: aId,
      treeId: tree.id,
      parentId: rootId,
      childrenIds: [],
    })
    await useTreeStore.getState().addNode(a)

    // Add grandchild b under a
    const bId = crypto.randomUUID()
    const b = createNode({
      id: bId,
      treeId: tree.id,
      parentId: aId,
      childrenIds: [],
    })
    await useTreeStore.getState().addNode(b)

    // Add child c under root
    const cId = crypto.randomUUID()
    const c = createNode({
      id: cId,
      treeId: tree.id,
      parentId: rootId,
      childrenIds: [],
    })
    await useTreeStore.getState().addNode(c)

    // Delete a (which also deletes b)
    await useTreeStore.getState().deleteNodeSubtree(aId)

    // Assert in-memory: r and c remain, a and b removed
    const memNodes = useTreeStore.getState().nodes
    expect(memNodes.has(rootId)).toBe(true)
    expect(memNodes.has(cId)).toBe(true)
    expect(memNodes.has(aId)).toBe(false)
    expect(memNodes.has(bId)).toBe(false)

    // Assert parent's childrenIds is updated
    expect(memNodes.get(rootId)!.childrenIds).toEqual([cId])

    // Assert DB: a and b are gone, r and c remain
    const dbA = await db.nodes.get(aId)
    const dbB = await db.nodes.get(bId)
    const dbR = await db.nodes.get(rootId)
    const dbC = await db.nodes.get(cId)
    expect(dbA).toBeUndefined()
    expect(dbB).toBeUndefined()
    expect(dbR).toBeDefined()
    expect(dbC).toBeDefined()
    expect(dbR!.childrenIds).toEqual([cId])
  })

  it('deleteNodeSubtree on root is a no-op', async () => {
    const tree = await useTreeStore.getState().createTree('Test Tree')
    const rootId = tree.rootNodeId

    // Add child under root
    const childId = crypto.randomUUID()
    const child = createNode({
      id: childId,
      treeId: tree.id,
      parentId: rootId,
      childrenIds: [],
    })
    await useTreeStore.getState().addNode(child)

    // Try to delete root
    await useTreeStore.getState().deleteNodeSubtree(rootId)

    // Assert: root and child still present in memory
    const nodes = useTreeStore.getState().nodes
    expect(nodes.has(rootId)).toBe(true)
    expect(nodes.has(childId)).toBe(true)

    // Assert: root and child still present in DB
    const dbRoot = await db.nodes.get(rootId)
    const dbChild = await db.nodes.get(childId)
    expect(dbRoot).toBeDefined()
    expect(dbChild).toBeDefined()
  })

  it('deleteNodeSubtree removes only a leaf node', async () => {
    const tree = await useTreeStore.getState().createTree('Test Tree')
    const rootId = tree.rootNodeId

    // Add child a under root
    const aId = crypto.randomUUID()
    const a = createNode({
      id: aId,
      treeId: tree.id,
      parentId: rootId,
      childrenIds: [],
    })
    await useTreeStore.getState().addNode(a)

    // Add grandchild b under a
    const bId = crypto.randomUUID()
    const b = createNode({
      id: bId,
      treeId: tree.id,
      parentId: aId,
      childrenIds: [],
    })
    await useTreeStore.getState().addNode(b)

    // Add child c under root
    const cId = crypto.randomUUID()
    const c = createNode({
      id: cId,
      treeId: tree.id,
      parentId: rootId,
      childrenIds: [],
    })
    await useTreeStore.getState().addNode(c)

    // Delete b (a leaf)
    await useTreeStore.getState().deleteNodeSubtree(bId)

    // Assert: root, a, c remain; only b removed
    const nodes = useTreeStore.getState().nodes
    expect(nodes.has(rootId)).toBe(true)
    expect(nodes.has(aId)).toBe(true)
    expect(nodes.has(cId)).toBe(true)
    expect(nodes.has(bId)).toBe(false)

    // Assert: a's childrenIds is now empty
    expect(nodes.get(aId)!.childrenIds).toEqual([])
  })

  it('deleteNodeSubtree removes liveText entries for deleted nodes', async () => {
    const tree = await useTreeStore.getState().createTree('Test Tree')
    const rootId = tree.rootNodeId

    // Add child a under root
    const aId = crypto.randomUUID()
    const a = createNode({
      id: aId,
      treeId: tree.id,
      parentId: rootId,
      childrenIds: [],
    })
    await useTreeStore.getState().addNode(a)

    // Add grandchild b under a
    const bId = crypto.randomUUID()
    const b = createNode({
      id: bId,
      treeId: tree.id,
      parentId: aId,
      childrenIds: [],
    })
    await useTreeStore.getState().addNode(b)

    // Set liveText for both a and b
    useTreeStore.setState({
      liveText: new Map([
        [aId, 'live text a'],
        [bId, 'live text b'],
      ]),
    })

    // Delete a (which also deletes b)
    await useTreeStore.getState().deleteNodeSubtree(aId)

    // Assert: liveText entries for a and b are removed
    const liveText = useTreeStore.getState().liveText
    expect(liveText.has(aId)).toBe(false)
    expect(liveText.has(bId)).toBe(false)
  })

  describe('mark descendants stale', () => {
    it('editing/regenerating a node marks every descendant stale', async () => {
      const { streamLLMResponse } = await import('../lib/streamingClient')
      vi.mocked(streamLLMResponse).mockImplementation(
        async (_payload, _settings, _target, _onToken, _onDone, _onError) => {
          return () => {}
        }
      )

      const tree = await useTreeStore.getState().createTree('My Tree')
      const r = tree.rootNodeId

      // Build tree: r has children a and c; a has child b
      const a = crypto.randomUUID()
      const b = crypto.randomUUID()
      const c = crypto.randomUUID()

      await useTreeStore.getState().addNode(createNode({ id: a, treeId: tree.id, parentId: r, childrenIds: [b] }))
      await useTreeStore.getState().addNode(createNode({ id: b, treeId: tree.id, parentId: a, childrenIds: [] }))
      await useTreeStore.getState().addNode(createNode({ id: c, treeId: tree.id, parentId: r, childrenIds: [] }))

      // Submit prompt on r
      await useTreeStore.getState().submitPrompt(r, 'edited prompt')

      // Assert: a, b, c are all stale in memory
      expect(useTreeStore.getState().nodes.get(a)!.stale).toBe(true)
      expect(useTreeStore.getState().nodes.get(b)!.stale).toBe(true)
      expect(useTreeStore.getState().nodes.get(c)!.stale).toBe(true)

      // Assert: r itself is NOT stale (the target is cleared, never marked)
      expect(useTreeStore.getState().nodes.get(r)!.stale).toBeFalsy()

      // Assert: DB also has stale=true for descendants
      expect((await db.nodes.get(a))!.stale).toBe(true)
      expect((await db.nodes.get(b))!.stale).toBe(true)
      expect((await db.nodes.get(c))!.stale).toBe(true)

      // Assert: a, b, c status is still idle (NOT auto-regenerated)
      expect(useTreeStore.getState().nodes.get(a)!.status).toBe('idle')
      expect(useTreeStore.getState().nodes.get(b)!.status).toBe('idle')
      expect(useTreeStore.getState().nodes.get(c)!.status).toBe('idle')
    })

    it('regenerating a node clears its own stale and marks its descendants', async () => {
      const { streamLLMResponse } = await import('../lib/streamingClient')
      vi.mocked(streamLLMResponse).mockImplementation(
        async (_payload, _settings, _target, _onToken, _onDone, _onError) => {
          return () => {}
        }
      )

      const tree = await useTreeStore.getState().createTree('My Tree')
      const r = tree.rootNodeId

      const a = crypto.randomUUID()
      const b = crypto.randomUUID()
      const c = crypto.randomUUID()

      await useTreeStore.getState().addNode(createNode({ id: a, treeId: tree.id, parentId: r, childrenIds: [b] }))
      await useTreeStore.getState().addNode(createNode({ id: b, treeId: tree.id, parentId: a, childrenIds: [] }))
      await useTreeStore.getState().addNode(createNode({ id: c, treeId: tree.id, parentId: r, childrenIds: [] }))

      // Manually set a.stale = true and b.stale = false
      await useTreeStore.getState().updateNode(a, { stale: true })
      await useTreeStore.getState().updateNode(b, { stale: false })

      // Regenerate a
      await useTreeStore.getState().submitPrompt(a, 'q')

      // Assert: a.stale is falsy (cleared by submitPrompt)
      expect(useTreeStore.getState().nodes.get(a)!.stale).toBeFalsy()
      expect((await db.nodes.get(a))!.stale).toBeFalsy()

      // Assert: b.stale is now true (descendant marked)
      expect(useTreeStore.getState().nodes.get(b)!.stale).toBe(true)
      expect((await db.nodes.get(b))!.stale).toBe(true)

      // Assert: c is unaffected (not under a)
      expect(useTreeStore.getState().nodes.get(c)!.stale).toBeFalsy()
      expect((await db.nodes.get(c))!.stale).toBeFalsy()
    })

    it('markDescendantsStale on a leaf is a no-op', async () => {
      const tree = await useTreeStore.getState().createTree('My Tree')
      const r = tree.rootNodeId

      const a = crypto.randomUUID()
      await useTreeStore.getState().addNode(createNode({ id: a, treeId: tree.id, parentId: r, childrenIds: [] }))

      // Mark a (leaf) as stale — should not throw and mark nothing
      await useTreeStore.getState().markDescendantsStale(a)

      // Assert: a itself is unchanged
      expect(useTreeStore.getState().nodes.get(a)!.stale).toBeFalsy()
    })

    it('markDescendantsStale does not touch the target node itself', async () => {
      const tree = await useTreeStore.getState().createTree('My Tree')
      const r = tree.rootNodeId

      const a = crypto.randomUUID()
      const b = crypto.randomUUID()

      await useTreeStore.getState().addNode(createNode({ id: a, treeId: tree.id, parentId: r, childrenIds: [b], stale: true }))
      await useTreeStore.getState().addNode(createNode({ id: b, treeId: tree.id, parentId: a, childrenIds: [] }))

      // Mark descendants of a
      await useTreeStore.getState().markDescendantsStale(a)

      // Assert: a's stale is unchanged (still true from before)
      expect(useTreeStore.getState().nodes.get(a)!.stale).toBe(true)
      expect((await db.nodes.get(a))!.stale).toBe(true)

      // Assert: b is now stale
      expect(useTreeStore.getState().nodes.get(b)!.stale).toBe(true)
    })
  })
})
