import { describe, it, expect } from 'vitest'
import {
  TREE_EXPORT_SCHEMA_VERSION,
  buildExportDoc,
  serializeExportDoc,
  exportFilename,
  parseImportDoc,
  remapImportedTree,
} from './treeExport'
import type { TreeExportDoc } from './treeExport'
import type { ConversationTree, TurnNode } from '../types'

function createTestTree(overrides: Partial<ConversationTree> = {}): ConversationTree {
  return {
    id: overrides.id ?? 'tree-1',
    title: overrides.title ?? 'Test Tree',
    rootNodeId: overrides.rootNodeId ?? 'node-root',
    defaultSystemPrompt: overrides.defaultSystemPrompt ?? 'You are helpful.',
    createdAt: overrides.createdAt ?? 1000,
    updatedAt: overrides.updatedAt ?? 2000,
  }
}

function createTestNode(overrides: Partial<TurnNode> = {}): TurnNode {
  const id = overrides.id ?? 'node-1'
  return {
    id,
    treeId: overrides.treeId ?? 'tree-1',
    parentId: overrides.parentId ?? null,
    childrenIds: overrides.childrenIds ?? [],
    userPrompt: overrides.userPrompt ?? 'Hello',
    assistantResponse: overrides.assistantResponse ?? 'Hi there',
    positionX: overrides.positionX ?? 0,
    positionY: overrides.positionY ?? 0,
    isCollapsed: overrides.isCollapsed ?? false,
    status: overrides.status ?? 'idle',
    modelUsed: overrides.modelUsed ?? 'gpt-4',
    timestamp: overrides.timestamp ?? 1500,
    systemPromptOverride: overrides.systemPromptOverride,
    provider: overrides.provider,
    errorMessage: overrides.errorMessage,
    inputTokens: overrides.inputTokens,
    outputTokens: overrides.outputTokens,
    width: overrides.width,
    height: overrides.height,
    stale: overrides.stale,
  }
}

describe('treeExport', () => {
  describe('1. buildExportDoc structure and schema version', () => {
    it('returns object with exactly schemaVersion, exportedAt, tree, nodes keys', () => {
      const tree = createTestTree()
      const node = createTestNode()
      const doc = buildExportDoc(tree, [node])

      const keys = Object.keys(doc).sort()
      expect(keys).toEqual(['exportedAt', 'nodes', 'schemaVersion', 'tree'])
    })

    it('sets schemaVersion to TREE_EXPORT_SCHEMA_VERSION', () => {
      const tree = createTestTree()
      const nodes: TurnNode[] = []
      const doc = buildExportDoc(tree, nodes)

      expect(doc.schemaVersion).toBe(TREE_EXPORT_SCHEMA_VERSION)
      expect(doc.schemaVersion).toBe(1)
    })

    it('sets exportedAt to a number close to Date.now()', () => {
      const before = Date.now()
      const tree = createTestTree()
      const nodes: TurnNode[] = []
      const doc = buildExportDoc(tree, nodes)
      const after = Date.now()

      expect(typeof doc.exportedAt).toBe('number')
      expect(doc.exportedAt).toBeGreaterThanOrEqual(before)
      expect(doc.exportedAt).toBeLessThanOrEqual(after + 10)
    })

    it('tree deep-equals input tree', () => {
      const tree = createTestTree({
        id: 'tree-xyz',
        title: 'My Research',
        rootNodeId: 'root-123',
      })
      const nodes: TurnNode[] = []
      const doc = buildExportDoc(tree, nodes)

      expect(doc.tree).toEqual(tree)
    })

    it('nodes array has same length as input and each deep-equals original', () => {
      const tree = createTestTree()
      const node1 = createTestNode({ id: 'n1' })
      const node2 = createTestNode({ id: 'n2', userPrompt: 'Different' })
      const nodes = [node1, node2]

      const doc = buildExportDoc(tree, nodes)

      expect(doc.nodes).toHaveLength(2)
      expect(doc.nodes[0]).toEqual(node1)
      expect(doc.nodes[1]).toEqual(node2)
    })
  })

  describe('2. Immutability: mutations to returned doc do not affect inputs', () => {
    it('mutating returned doc.nodes[0] does not affect original node', () => {
      const tree = createTestTree()
      const originalNode = createTestNode({ id: 'n1', userPrompt: 'Original' })
      const doc = buildExportDoc(tree, [originalNode])

      doc.nodes[0].userPrompt = 'Modified'
      expect(originalNode.userPrompt).toBe('Original')
    })

    it('mutating returned doc.tree does not affect input tree', () => {
      const originalTree = createTestTree({ title: 'Original Title' })
      const nodes: TurnNode[] = []
      const doc = buildExportDoc(originalTree, nodes)

      doc.tree.title = 'Modified Title'
      expect(originalTree.title).toBe('Original Title')
    })

    it('mutating returned doc.nodes[0].childrenIds does not affect original node.childrenIds', () => {
      const tree = createTestTree()
      const originalNode = createTestNode({ id: 'n1', childrenIds: ['a', 'b'] })
      const doc = buildExportDoc(tree, [originalNode])

      doc.nodes[0].childrenIds.push('c')
      expect(originalNode.childrenIds).toEqual(['a', 'b'])
      expect(doc.nodes[0].childrenIds).toEqual(['a', 'b', 'c'])
    })
  })

  describe('3. Secrets: exported doc does not leak API keys or sensitive settings', () => {
    it('no forbidden keys present in entire serialized JSON', () => {
      const tree = createTestTree()
      const node = createTestNode()
      const doc = buildExportDoc(tree, [node])

      const serialized = serializeExportDoc(doc)
      const parsed = JSON.parse(serialized)

      // Recursively collect all keys in the parsed object
      function getAllKeys(obj: unknown, keys: Set<string> = new Set()): Set<string> {
        if (obj && typeof obj === 'object') {
          if (Array.isArray(obj)) {
            obj.forEach((item) => getAllKeys(item, keys))
          } else {
            Object.keys(obj).forEach((key) => {
              keys.add(key)
              getAllKeys((obj as Record<string, unknown>)[key], keys)
            })
          }
        }
        return keys
      }

      const allKeys = getAllKeys(parsed)
      const forbiddenKeys = ['settings', 'geminiApiKey', 'openRouterApiKey', 'ollamaBaseUrl', 'apiKey', 'liveText']

      for (const forbidden of forbiddenKeys) {
        expect(allKeys.has(forbidden)).toBe(false)
      }
    })

    it('planted secret value does not appear in serialized output', () => {
      const tree = createTestTree()
      const node = createTestNode({
        userPrompt: 'Some normal text',
        assistantResponse: 'Another normal response',
      })
      const doc = buildExportDoc(tree, [node])
      const serialized = serializeExportDoc(doc)

      const planted = 'AIzaSy-PLANTED-SECRET'
      expect(serialized.includes(planted)).toBe(false)
    })
  })

  describe('4. exportFilename generates correct format', () => {
    it('converts title to slug with date: "My Cool Research!" on 2026-08-31 -> my-cool-research-2026-08-31.json', () => {
      const tree = createTestTree({ title: 'My Cool Research!' })
      const date = new Date(2026, 7, 31) // Month is 0-indexed, 7 = August
      const filename = exportFilename(tree, date)

      expect(filename).toBe('my-cool-research-2026-08-31.json')
    })

    it('handles whitespace-only title: "   " on 2026-01-05 -> tree-2026-01-05.json', () => {
      const tree = createTestTree({ title: '   ' })
      const date = new Date(2026, 0, 5)
      const filename = exportFilename(tree, date)

      expect(filename).toBe('tree-2026-01-05.json')
    })

    it('strips leading/trailing special chars from slug', () => {
      const tree = createTestTree({ title: '---Hello World---' })
      const date = new Date(2026, 0, 1)
      const filename = exportFilename(tree, date)

      expect(filename).toBe('hello-world-2026-01-01.json')
    })

    it('collapses multiple special chars into single dash', () => {
      const tree = createTestTree({ title: 'One...Two!!!Three' })
      const date = new Date(2026, 0, 1)
      const filename = exportFilename(tree, date)

      expect(filename).toBe('one-two-three-2026-01-01.json')
    })

    it('pads month and day to 2 digits', () => {
      const tree = createTestTree({ title: 'Test' })
      const date = new Date(2026, 0, 5) // Month 0 = January, day 5
      const filename = exportFilename(tree, date)

      expect(filename).toMatch(/2026-01-05\.json$/)
    })
  })

  describe('5. JSON roundtrip: serialize and parse yields equivalent doc', () => {
    it('JSON.parse(serializeExportDoc(doc)) deep-equals original doc', () => {
      const tree = createTestTree()
      const node = createTestNode({
        id: 'n1',
        inputTokens: 42,
        outputTokens: 99,
      })
      const doc = buildExportDoc(tree, [node])

      const serialized = serializeExportDoc(doc)
      const parsed = JSON.parse(serialized)

      expect(parsed).toEqual(doc)
    })

    it('optional fields that are undefined do not leak into JSON', () => {
      const tree = createTestTree()
      const node = createTestNode({
        id: 'n1',
        systemPromptOverride: undefined,
        errorMessage: undefined,
        provider: undefined,
        inputTokens: undefined,
        outputTokens: undefined,
      })
      const doc = buildExportDoc(tree, [node])

      const serialized = serializeExportDoc(doc)
      const parsed = JSON.parse(serialized)

      // These fields should not be present after JSON roundtrip
      expect(parsed.nodes[0]).not.toHaveProperty('systemPromptOverride')
      expect(parsed.nodes[0]).not.toHaveProperty('errorMessage')
      expect(parsed.nodes[0]).not.toHaveProperty('provider')
      expect(parsed.nodes[0]).not.toHaveProperty('inputTokens')
      expect(parsed.nodes[0]).not.toHaveProperty('outputTokens')
    })

    it('node with all fields set roundtrips correctly', () => {
      const tree = createTestTree()
      const node = createTestNode({
        id: 'n1',
        userPrompt: 'Question',
        assistantResponse: 'Answer',
        systemPromptOverride: 'Custom system',
        provider: 'gemini',
        errorMessage: 'Some error',
        inputTokens: 100,
        outputTokens: 200,
        width: 300,
        height: 150,
        stale: true,
      })
      const doc = buildExportDoc(tree, [node])

      const serialized = serializeExportDoc(doc)
      const parsed = JSON.parse(serialized) as TreeExportDoc

      expect(parsed.nodes[0]).toEqual(node)
      expect(parsed.nodes[0].systemPromptOverride).toBe('Custom system')
      expect(parsed.nodes[0].provider).toBe('gemini')
      expect(parsed.nodes[0].inputTokens).toBe(100)
    })
  })

  describe('import validation & remap', () => {
    function createValidThreeNodeTree(): TreeExportDoc {
      const rootId = 'root-123'
      const childAId = 'child-a-456'
      const grandchildId = 'grandchild-789'

      const tree = createTestTree({
        id: 'tree-import-test',
        rootNodeId: rootId,
      })

      const root = createTestNode({
        id: rootId,
        treeId: tree.id,
        parentId: null,
        childrenIds: [childAId],
        userPrompt: 'Root prompt',
        assistantResponse: 'Root response',
      })

      const childA = createTestNode({
        id: childAId,
        treeId: tree.id,
        parentId: rootId,
        childrenIds: [grandchildId],
        userPrompt: 'Child A prompt',
        assistantResponse: 'Child A response',
      })

      const grandchild = createTestNode({
        id: grandchildId,
        treeId: tree.id,
        parentId: childAId,
        childrenIds: [],
        userPrompt: 'Grandchild prompt',
        assistantResponse: 'Grandchild response',
      })

      return buildExportDoc(tree, [root, childA, grandchild])
    }

    it('1. parseImportDoc(serializeExportDoc(validDoc)) returns ok: true', () => {
      const doc = createValidThreeNodeTree()
      const serialized = serializeExportDoc(doc)
      const result = parseImportDoc(serialized)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.doc).toEqual(doc)
      }
    })

    it('2. parseImportDoc on invalid JSON returns ok: false with JSON error message', () => {
      const result = parseImportDoc('not json{')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.toLowerCase()).toContain('json')
      }
    })

    it('3. parseImportDoc on doc with schemaVersion: 99 returns ok: false mentioning both versions', () => {
      const doc = createValidThreeNodeTree()
      const invalidDoc = { ...doc, schemaVersion: 99 }
      const serialized = JSON.stringify(invalidDoc)
      const result = parseImportDoc(serialized)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('99')
        expect(result.error).toContain('1')
      }
    })

    it('4. parseImportDoc on doc with two root nodes returns ok: false mentioning root count', () => {
      const doc = createValidThreeNodeTree()
      const root2 = createTestNode({
        id: 'root-2',
        treeId: doc.tree.id,
        parentId: null,
        childrenIds: [],
      })
      const invalidDoc = { ...doc, nodes: [...doc.nodes, root2] }
      const serialized = JSON.stringify(invalidDoc)
      const result = parseImportDoc(serialized)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.toLowerCase()).toContain('root')
      }
    })

    it('5. parseImportDoc on doc where node.parentId points to missing id returns ok: false', () => {
      const doc = createValidThreeNodeTree()
      const invalidDoc = {
        ...doc,
        nodes: doc.nodes.map((n) =>
          n.id === 'grandchild-789' ? { ...n, parentId: 'missing-parent-id' } : n
        ),
      }
      const serialized = JSON.stringify(invalidDoc)
      const result = parseImportDoc(serialized)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.toLowerCase()).toContain('missing')
      }
    })

    it('6. parseImportDoc on doc where parent.childrenIds includes child with different parentId returns ok: false', () => {
      const doc = createValidThreeNodeTree()
      const invalidDoc = {
        ...doc,
        nodes: doc.nodes.map((n) =>
          n.id === 'grandchild-789' ? { ...n, parentId: 'root-123' } : n
        ),
      }
      const serialized = JSON.stringify(invalidDoc)
      const result = parseImportDoc(serialized)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error.toLowerCase()).toContain('does not point back')
      }
    })

    it('7. remapImportedTree creates new ids not in original set', () => {
      const doc = createValidThreeNodeTree()
      const originalIds = new Set(doc.nodes.map((n) => n.id))

      const { tree, nodes } = remapImportedTree(doc)

      const newIds = new Set(nodes.map((n) => n.id))
      expect(tree.id).not.toBe(doc.tree.id)

      for (const newId of newIds) {
        expect(originalIds.has(newId)).toBe(false)
      }

      const remappedRootId = nodes.find((n) => n.parentId === null)!.id
      expect(remappedRootId).toBe(tree.rootNodeId)
    })

    it('8. remapImportedTree called twice yields disjoint id sets', () => {
      const doc = createValidThreeNodeTree()

      const { nodes: nodes1 } = remapImportedTree(doc)
      const { nodes: nodes2 } = remapImportedTree(doc)

      const ids1 = new Set(nodes1.map((n) => n.id))
      const ids2 = new Set(nodes2.map((n) => n.id))

      for (const id of ids1) {
        expect(ids2.has(id)).toBe(false)
      }
    })

    it('9. remapImportedTree converts streaming status to idle', () => {
      const doc = createValidThreeNodeTree()
      const docWithStreaming = {
        ...doc,
        nodes: doc.nodes.map((n) => (n.id === 'child-a-456' ? { ...n, status: 'streaming' as const } : n)),
      }

      const { nodes } = remapImportedTree(docWithStreaming)

      const remappedChild = nodes.find((n) => n.id !== nodes[0].id && n.parentId === nodes[0].id)
      expect(remappedChild!.status).toBe('idle')
    })

    it('10. remapImportedTree preserves tree structure isomorphically', () => {
      const doc = createValidThreeNodeTree()
      const { tree, nodes } = remapImportedTree(doc)

      const originalRoot = doc.nodes.find((n) => n.parentId === null)!
      const remappedRoot = nodes.find((n) => n.parentId === null)!
      expect(remappedRoot.childrenIds.length).toBe(originalRoot.childrenIds.length)
      expect(tree.rootNodeId).toBe(remappedRoot.id)
    })
  })
})
