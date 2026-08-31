import { useState, useEffect, useRef, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'
import { useSearchNav } from './useSearchNav'

interface SearchResult {
  id: string
  promptLabel: string
  snippet: string
}

export function SearchBar() {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const nodes = useTreeStore((s) => s.nodes)
  const activeTreeId = useTreeStore((s) => s.activeTreeId)
  const toggleCollapse = useTreeStore((s) => s.toggleCollapse)
  const focus = useSearchNav((s) => s.focus)

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

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []

    const matches: SearchResult[] = []

    for (const n of nodes.values()) {
      if (n.treeId !== activeTreeId) continue

      const userMatch = n.userPrompt.toLowerCase().includes(q)
      const responseMatch = n.assistantResponse.toLowerCase().includes(q)

      if (!userMatch && !responseMatch) continue

      const promptLabel = (n.userPrompt.trim() || '(no prompt)').slice(0, 60) + (n.userPrompt.length > 60 ? '…' : '')

      const matchField = responseMatch ? n.assistantResponse : n.userPrompt
      const idx = matchField.toLowerCase().indexOf(q)
      const start = Math.max(0, idx - 40)
      const end = idx + q.length + 40
      let snippet = matchField.slice(start, end).replace(/\s+/g, ' ')
      if (start > 0) snippet = '…' + snippet
      if (end < matchField.length) snippet = snippet + '…'

      matches.push({ id: n.id, promptLabel, snippet })

      if (matches.length >= 50) break
    }

    return matches
  }, [query, nodes, activeTreeId])

  const handleSelect = async (id: string) => {
    const visited = new Set<string>()
    let current = nodes.get(id)?.parentId

    while (current && !visited.has(current)) {
      visited.add(current)
      const node = nodes.get(current)
      if (!node) break
      if (node.isCollapsed) {
        await toggleCollapse(current)
      }
      current = node.parentId
    }

    focus(id)
    setOpen(false)
    setQuery('')
  }

  return (
    <div ref={containerRef} className="w-full max-w-md">
      <div className="relative w-full">
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">
          <Search size={16} />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (e.target.value.trim().length >= 2) setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search this tree…"
          className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />

        {open && query.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-full mt-1 z-40 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl py-1 max-h-80 overflow-y-auto">
            {results.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-500">No matches in this tree.</div>
            ) : (
              results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelect(r.id)}
                  className="w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors"
                >
                  <div className="text-sm text-slate-300 truncate">{r.promptLabel}</div>
                  <div className="text-[11px] text-slate-500">{r.snippet}</div>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
