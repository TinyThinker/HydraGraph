import { useEffect, useRef } from 'react'
import { useReactFlow, useOnSelectionChange, useStore } from '@xyflow/react'
import { useTreeStore } from '../store/useTreeStore'
import { useReaderPanel } from './useReaderPanel'
import { resolveNavTarget, isTypingTarget } from '../lib/treeNav'
import { NODE_WIDTH, NODE_HEIGHT } from '../lib/nodeDimensions'
import { db } from '../db/ChatDatabase'

export function CanvasViewport() {
  const activeTreeId = useTreeStore((s) => s.activeTreeId)
  const { setViewport, fitView, getZoom, setCenter, setNodes } = useReactFlow()
  const transform = useStore((s) => s.transform)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const selectedRef = useRef<string | null>(null)

  // A. Restore viewport on tree load
  useEffect(() => {
    if (!activeTreeId) return

    db.trees.get(activeTreeId).then((tree) => {
      if (!tree) {
        fitView()
        return
      }
      if (tree.viewportZoom != null && tree.viewportX != null && tree.viewportY != null) {
        setViewport({ x: tree.viewportX, y: tree.viewportY, zoom: tree.viewportZoom })
      } else {
        fitView()
      }
    })
  }, [activeTreeId, setViewport, fitView])

  // B. Persist viewport on pan/zoom (debounced)
  useEffect(() => {
    const id = useTreeStore.getState().activeTreeId
    if (!id) return

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    debounceTimerRef.current = setTimeout(() => {
      db.trees.update(id, {
        viewportX: transform[0],
        viewportY: transform[1],
        viewportZoom: transform[2],
      })
      debounceTimerRef.current = null
    }, 400)

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [transform])

  // C. Keyboard navigation
  useOnSelectionChange({
    onChange: ({ nodes }) => {
      selectedRef.current = nodes[0]?.id ?? null
    },
  })

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      const nodes = useTreeStore.getState().nodes
      const current = selectedRef.current

      let dir: 'parent' | 'child' | 'prev' | 'next' | null = null

      switch (e.key) {
        case 'ArrowUp':
          dir = 'parent'
          break
        case 'ArrowDown':
          dir = 'child'
          break
        case 'ArrowLeft':
          dir = 'prev'
          break
        case 'ArrowRight':
          dir = 'next'
          break
        case 'b':
        case 'B': {
          e.preventDefault()
          if (!current) return
          const node = nodes.get(current)
          if (!node) return
          const settings = useTreeStore.getState().settings
          useTreeStore.getState().addNode({
            id: crypto.randomUUID(),
            treeId: node.treeId,
            parentId: node.id,
            childrenIds: [],
            userPrompt: '',
            assistantResponse: '',
            positionX: node.positionX,
            positionY: node.positionY,
            isCollapsed: false,
            status: 'idle',
            modelUsed: settings.defaultModel,
            timestamp: Date.now(),
          })
          return
        }
        case 'r':
        case 'R': {
          if (current) useReaderPanel.getState().open(current)
          return
        }
        default:
          return
      }

      if (dir) {
        e.preventDefault()
        let targetId: string | null = null

        if (current == null) {
          const root = Array.from(nodes.values()).find((n) => n.parentId == null)
          targetId = root?.id ?? null
        } else {
          targetId = resolveNavTarget(current, dir, nodes)
        }

        if (targetId == null) return

        setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === targetId })))
        selectedRef.current = targetId

        const t = nodes.get(targetId)
        if (t) setCenter(t.positionX + NODE_WIDTH / 2, t.positionY + NODE_HEIGHT / 2, { zoom: getZoom(), duration: 300 })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setNodes, setCenter, getZoom])

  return null
}
