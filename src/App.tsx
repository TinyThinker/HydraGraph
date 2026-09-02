import { useEffect, useRef, useState } from 'react'
import './index.css'
import { useTreeStore } from './store/useTreeStore'
import { useSettingsStore } from './store/settingsStore'
import { SplitLayout } from './components/SplitLayout'
import { HeaderBar } from './components/HeaderBar'
import { ReaderPanel } from './components/ReaderPanel'
import { CompareView } from './components/CompareView'
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
      const { loadAllTrees, loadTree, createTree } = useTreeStore.getState()
      await useSettingsStore.getState().loadSettings()
      await loadAllTrees()

      const { activeTreeId } = useSettingsStore.getState().settings
      const { trees } = useTreeStore.getState()
      const remembered = trees.find((t) => t.id === activeTreeId)

      if (remembered) {
        await loadTree(remembered.id)
      } else if (trees.length > 0) {
        await loadTree(trees[0].id)
      } else {
        await createTree('New Research')
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
    </div>
  )
}
