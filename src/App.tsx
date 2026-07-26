import { useEffect, useState } from 'react'
import './index.css'
import { useTreeStore } from './store/useTreeStore'
import { Canvas } from './components/Canvas'

export default function App() {
  const { loadSettings, loadAllTrees, loadTree, createTree } = useTreeStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    async function boot() {
      await loadSettings()
      await loadAllTrees()
      const { settings } = useTreeStore.getState()
      if (settings.activeTreeId) {
        await loadTree(settings.activeTreeId)
      } else {
        await createTree('New Research')
      }
      setReady(true)
    }
    boot()
  }, [])

  if (!ready) return <div className="h-full bg-slate-950" />
  return <Canvas />
}
