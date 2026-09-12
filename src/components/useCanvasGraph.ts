import { useRef, useCallback, useMemo, useState, useEffect } from 'react'
import { applyNodeChanges, type Node, type NodeChange } from '@xyflow/react'
import { useTreeStore } from '../store/useTreeStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { computeHiddenIds } from '../lib/collapse'
import { activePathIds, edgeAppearance, pillDimClassName } from '../lib/pathHighlight'
import { NODE_WIDTH, NODE_HEIGHT } from '../lib/nodeDimensions'
import type { TurnNodeData } from '../types'

// Owns the store->React Flow node/edge derivation, the referentially-stable
// wrapper cache, and the active-path highlight overlay. Manual node dragging and
// resizing are disabled, so Canvas is left as a thin JSX shell.
export function useCanvasGraph() {
  const nodes = useTreeStore((s) => s.nodes)
  const selectedNodeId = useSelectionStore((s) => s.selectedNodeId)
  const nodeWrapperCache = useRef<Map<string, Node<TurnNodeData>>>(new Map())

  // Compute hidden nodes (those with a collapsed ancestor)
  const hiddenIds = useMemo(() => computeHiddenIds(nodes), [nodes])

  // Ids on the active path root -> selected node (null = dim nothing).
  const activeIds = useMemo(
    () => activePathIds(nodes, selectedNodeId),
    [nodes, selectedNodeId],
  )

  // Reuse each node's RF wrapper object while its store object, dim class AND
  // selected flag are unchanged, so repositioning one node does not hand every
  // other card a new `data` prop.
  //
  // `selected` is DERIVED from useSelectionStore rather than poked into React
  // Flow imperatively via setNodes(). It has to be: this memo rebuilds a
  // wrapper whenever its store node changes identity (finalizeNode, stale
  // marking, re-layout), and a rebuilt wrapper that omitted `selected` would
  // silently drop the selection — React Flow then fires onSelectionChange with
  // an empty array, CanvasSelectionSync writes selectedNodeId = null, and the
  // chat pane falls back to the empty root. That is the "pane blanks the moment
  // a response finishes" bug.
  const rfNodesFromStore = useMemo<Node<TurnNodeData>[]>(() => {
    const cache = nodeWrapperCache.current
    const result = Array.from(nodes.values())
      .filter((n) => !hiddenIds.has(n.id))
      .map((n) => {
        const className = pillDimClassName(n.id, activeIds)
        const selected = n.id === selectedNodeId
        const cached = cache.get(n.id)
        if (cached && cached.data === n && cached.className === className && cached.selected === selected) {
          return cached
        }
        const wrapper: Node<TurnNodeData> = {
          id: n.id,
          type: 'turnNode',
          position: { x: n.positionX, y: n.positionY },
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          className,
          selected,
          data: n as TurnNodeData,
        }
        cache.set(n.id, wrapper)
        return wrapper
      })
    for (const id of cache.keys()) if (!nodes.has(id)) cache.delete(id)
    return result
  }, [nodes, hiddenIds, activeIds, selectedNodeId])

  const [localNodes, setLocalNodes] = useState(rfNodesFromStore)

  // Always accept store changes.
  useEffect(() => {
    setLocalNodes(rfNodesFromStore)
  }, [rfNodesFromStore])

  const structureKey = useMemo(
    () => Array.from(nodes.values()).map((n) => `${n.id}>${n.parentId}>${n.isCollapsed ? 'c' : 'o'}`).sort().join('|'),
    [nodes],
  )
  // Edges derive from the structure key plus the active path, so they keep a
  // stable reference until structure or selection actually changes.
  const edges = useMemo(
    () =>
      structureKey
        .split('|')
        .filter(Boolean)
        .map((pair) => pair.split('>'))
        .filter(([, parentId]) => parentId !== 'null')
        .filter(([id, parentId]) => !hiddenIds.has(id) && !hiddenIds.has(parentId))
        .map(([id, parentId]) => ({
          id: `${parentId}-${id}`,
          source: parentId,
          target: id,
          type: 'smoothstep',
          ...edgeAppearance(parentId, id, activeIds),
        })),
    [structureKey, hiddenIds, activeIds],
  )

  const onNodesChange = useCallback(
    (changes: NodeChange<Node<TurnNodeData>>[]) => {
      setLocalNodes((nds) => applyNodeChanges(changes, nds))
    },
    [],
  )

  return { localNodes, edges, onNodesChange }
}
