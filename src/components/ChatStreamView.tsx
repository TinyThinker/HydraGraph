import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTreeStore } from '../store/useTreeStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { getAncestryChain } from '../lib/ancestry'
import { ChatMessage } from './ChatMessage'
import { useActiveNodeId } from './useActiveNodeId'

/**
 * Right pane: the linear chat stream for the active node's lineage. Renders the
 * ordered ancestry array `[root -> ... -> selected]` as chat bubbles and keeps
 * itself pinned to the bottom while a response streams in.
 */
export function ChatStreamView() {
  const nodes = useTreeStore((s) => s.nodes)
  const activeId = useActiveNodeId()
  const selectedNodeId = useSelectionStore((s) => s.selectedNodeId)

  // Subscribe to the length of the ACTIVE node's in-flight text, not the whole
  // liveText map. Subscribing to the map re-rendered this list — and every
  // ChatMessage in it — for a token arriving on any branch in the tree,
  // including ones not on screen during a fan-out.
  const liveLength = useTreeStore((s) => (activeId ? (s.liveText.get(activeId)?.length ?? 0) : 0))

  const chain = useMemo(() => getAncestryChain(nodes, activeId), [nodes, activeId])

  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [chain.length, activeId, liveLength])

  // Stable identity, or ChatMessage's memo() can never bail out.
  const onSelect = useCallback((id: string) => useSelectionStore.getState().selectAndFocus(id), [])

  const visibleTurns = chain.filter(
    (n) => n.userPrompt || n.assistantResponse || n.status !== 'idle',
  )

  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3" data-testid="chat-stream">
      {visibleTurns.length === 0 ? (
        <p className="text-sm text-slate-500">
          Select a node on the graph to see its conversation lineage here.
        </p>
      ) : (
        visibleTurns.map((node) => (
          <ChatMessage
            key={node.id}
            node={node}
            isActive={node.id === selectedNodeId}
            onSelect={onSelect}
          />
        ))
      )}
      <div ref={endRef} />
    </div>
  )
}
