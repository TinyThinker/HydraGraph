import { useEffect, useRef, useState } from 'react'
import './index.css'
import { useTreeStore } from './store/useTreeStore'
import { useSettingsStore } from './store/settingsStore'
import { useCatalogStore } from './store/catalogStore'
import { SplitLayout } from './components/SplitLayout'
import { HeaderBar } from './components/HeaderBar'
import { ReaderPanel } from './components/ReaderPanel'
import { CompareView } from './components/CompareView'
import { SelectionBranchButton } from './components/SelectionBranchButton'
import { BuildStamp } from './components/BuildStamp'
import { installRenderHarness } from './lib/renderTally'

export default function App() {
  const bootedRef = useRef(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (import.meta.env.DEV) {
      installRenderHarness()
    }
  }, [])

  useEffect(() => {
    if (bootedRef.current) return
    bootedRef.current = true

    async function boot() {
      const { loadAllTrees, loadTree, seedDemoTree } = useTreeStore.getState()
      await useSettingsStore.getState().loadSettings()
      // Refresh the live model/price catalog in the background (TTL-guarded,
      // falls back to cache then the bundled snapshot). Not awaited — the UI
      // renders off the bundled seed until it lands.
      void useCatalogStore.getState().loadCatalog()
      await loadAllTrees()

      const { activeTreeId } = useSettingsStore.getState().settings
      const { trees } = useTreeStore.getState()
      const remembered = trees.find((t) => t.id === activeTreeId)

      if (remembered) {
        await loadTree(remembered.id)
      } else if (trees.length > 0) {
        await loadTree(trees[0].id)
      } else {
        // First run: land on the shipped demo tree rather than an empty canvas.
        // Canned responses, no key required — see `lib/demoTree.ts`.
        await seedDemoTree()
      }
      setReady(true)
    }
    boot()
  }, [])

  if (!ready) return <div className="h-full bg-slate-950" />
  return (
    <div className="h-full flex flex-col">
      <HeaderBar />
      <div className="flex-1 min-h-0 flex">
        <SplitLayout />
        <ReaderPanel />
      </div>
      <CompareView />
      <SelectionBranchButton />
      <BuildStamp />
    </div>
  )
}
