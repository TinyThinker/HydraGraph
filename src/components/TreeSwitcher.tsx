import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Plus, Sparkles } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'
import { TreeSwitcherRow } from './TreeSwitcherRow'

export function TreeSwitcher() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const trees = useTreeStore((s) => s.trees)
  const activeTreeId = useTreeStore((s) => s.activeTreeId)
  const loadTree = useTreeStore((s) => s.loadTree)
  const createTree = useTreeStore((s) => s.createTree)
  const seedDemoTree = useTreeStore((s) => s.seedDemoTree)

  const activeTree = activeTreeId ? trees.find((t) => t.id === activeTreeId) : null
  const sorted = [...trees].sort((a, b) => b.updatedAt - a.updatedAt)

  // Close on outside click
  useEffect(() => {
    if (!open) return

    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [open])

  const handleNewTree = async () => {
    const title = window.prompt('New tree title', 'New Research')
    if (title && title.trim()) {
      await createTree(title.trim())
      setOpen(false)
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-slate-200 font-medium flex items-center gap-1.5 hover:text-white transition-colors"
      >
        {activeTree?.title ?? 'Untitled'}
        <ChevronDown size={16} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-40 w-72 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 max-h-96 overflow-y-auto">
          <button
            onClick={handleNewTree}
            className="w-full flex items-center gap-2 text-xs text-indigo-400 hover:bg-slate-800 px-3 py-2 transition-colors"
          >
            <Plus size={14} />
            New tree
          </button>

          {/* Re-seeds the shipped demo (fixed ids, so it never duplicates) and
              opens it — the way back after poking at it or deleting it. */}
          <button
            onClick={async () => {
              await seedDemoTree()
              setOpen(false)
            }}
            className="w-full flex items-center gap-2 text-xs text-slate-400 hover:bg-slate-800 hover:text-slate-200 px-3 py-2 transition-colors"
          >
            <Sparkles size={14} />
            Reset demo tree
          </button>

          <div className="border-t border-slate-700 my-1" />

          {sorted.map((tree) => (
            <TreeSwitcherRow
              key={tree.id}
              tree={tree}
              isActive={tree.id === activeTreeId}
              onSelect={async () => {
                await loadTree(tree.id)
                setOpen(false)
              }}
              onClosePanel={() => setOpen(false)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
