import { useState } from 'react'
import { Settings, LayoutGrid, DollarSign, Columns3 } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'
import { useCompareStore } from '../store/useCompareStore'
import { useSettingsModalStore } from '../store/useSettingsModalStore'
import { useActiveNodeId } from './useActiveNodeId'
import { SettingsModal } from './SettingsModal'
import { TreeSwitcher } from './TreeSwitcher'
import { SearchBar } from './SearchBar'
import { ExportButton } from './ExportButton'
import { ImportButton } from './ImportButton'
import { CostReceipt } from './CostReceipt'
import { ProviderBanner } from './ProviderBanner'
import { StorageBanner } from './StorageBanner'
import { ExportNudge } from './ExportNudge'

export function HeaderBar() {
  const modalOpen = useSettingsModalStore((s) => s.open)
  const openSettings = useSettingsModalStore((s) => s.openSettings)
  const closeSettings = useSettingsModalStore((s) => s.closeSettings)
  const [confirmRelayout, setConfirmRelayout] = useState(false)
  const [showReceipt, setShowReceipt] = useState(false)
  const relayoutActiveTree = useTreeStore((s) => s.relayoutActiveTree)

  const activeId = useActiveNodeId()
  const siblingCount = useTreeStore((s) => {
    const active = activeId ? s.nodes.get(activeId) : undefined
    if (!active || active.parentId == null) return 0
    let count = 0
    for (const n of s.nodes.values()) if (n.parentId === active.parentId) count++
    return count
  })
  const canCompare = siblingCount >= 2

  return (
    <>
      <div className="h-12 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-900">
        <TreeSwitcher />
        <div className="flex-1 flex justify-center px-4">
          <SearchBar />
        </div>
        <div className="relative flex items-center gap-1">
          <button
            onClick={() => setConfirmRelayout(true)}
            className="text-slate-400 hover:text-slate-200 transition-colors p-2"
            title="Re-run auto-layout for the whole tree"
          >
            <LayoutGrid size={20} />
          </button>
          <ExportButton />
          <ImportButton />
          <button
            onClick={() => setShowReceipt((v) => !v)}
            title="Cost receipt for this tree"
            className={`transition-colors p-2 ${
              showReceipt ? 'text-slate-200' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign size={20} />
          </button>
          <button
            onClick={() => activeId && useCompareStore.getState().openCompare(activeId)}
            disabled={!canCompare}
            title="Compare sibling branches"
            className={`transition-colors p-2 ${
              canCompare ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 opacity-40'
            }`}
          >
            <Columns3 size={20} />
          </button>
          <button
            onClick={openSettings}
            className="text-slate-400 hover:text-slate-200 transition-colors p-2"
          >
            <Settings size={20} />
          </button>
          {showReceipt && (
            <div className="absolute right-0 top-full mt-1 z-20">
              <CostReceipt />
            </div>
          )}
        </div>
      </div>
      {confirmRelayout && (
        <div className="bg-amber-950/40 border-b border-amber-800/50 text-amber-300 text-sm px-4 py-3">
          <div className="mb-2">Re-running auto-layout will discard your manual node positions.</div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                await relayoutActiveTree()
                setConfirmRelayout(false)
              }}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1 rounded transition-colors nodrag"
            >
              Re-layout
            </button>
            <button
              onClick={() => setConfirmRelayout(false)}
              className="bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium px-3 py-1 rounded transition-colors nodrag"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <StorageBanner />
      <ProviderBanner onOpenSettings={openSettings} />
      <ExportNudge />
      <SettingsModal open={modalOpen} onClose={closeSettings} />
    </>
  )
}
