import { useState } from 'react'
import { Settings } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'
import { SettingsModal } from './SettingsModal'

export function HeaderBar() {
  const [modalOpen, setModalOpen] = useState(false)
  const activeTreeId = useTreeStore((s) => s.activeTreeId)
  const trees = useTreeStore((s) => s.trees)

  const activeTree = activeTreeId ? trees.find((t) => t.id === activeTreeId) : null
  const title = activeTree?.title ?? 'Untitled'

  return (
    <>
      <div className="h-12 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900">
        <span className="text-slate-200 font-medium">{title}</span>
        <button
          onClick={() => setModalOpen(true)}
          className="text-slate-400 hover:text-slate-200 transition-colors p-2"
        >
          <Settings size={20} />
        </button>
      </div>
      <SettingsModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
