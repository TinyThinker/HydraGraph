import { useEffect, useMemo, useRef } from 'react'
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
  const liveText = useTreeStore((s) => s.liveText)
  const activeId = useActiveNodeId()
  const selectedNodeId = useSelectionStore((s) => s.selectedNodeId)

  const chain = useMemo(() => getAncestryChain(nodes, activeId), [nodes, activeId])

  const endRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end' })
  }, [chain.length, activeId, liveText])

  const onSelect = (id: string) => useSelectionStore.getState().selectAndFocus(id)

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
