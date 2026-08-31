import { useEffect, useRef, useState } from 'react'
import './index.css'
import { useTreeStore } from './store/useTreeStore'
import { Canvas } from './components/Canvas'
import { HeaderBar } from './components/HeaderBar'
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
      const { loadSettings, loadAllTrees, loadTree, createTree } = useTreeStore.getState()
      await loadSettings()
      await loadAllTrees()
      const { settings } = useTreeStore.getState()
      if (settings.activeTreeId) {
        await loadTree(settings.activeTreeId)
      } else {
        const freshState = useTreeStore.getState()
        if (!freshState.settings.activeTreeId && !freshState.activeTreeId) {
          await createTree('New Research')
        }
      }
      setReady(true)
    }
    boot()
  }, [])

  if (!ready) return <div className="h-full bg-slate-950" />
  return (
    <div className="h-full flex flex-col">
      <HeaderBar />
      <div className="flex-1 min-h-0">
        <Canvas />
      </div>
    </div>
  )
}
