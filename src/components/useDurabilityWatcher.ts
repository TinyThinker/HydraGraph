import { useEffect, useRef } from 'react'
import { useTreeStore } from '../store/useTreeStore'
import { useSettingsStore } from '../store/settingsStore'
import { reportWriteFailure } from '../store/storageStatusStore'
import { hasRealWork } from '../lib/realWork'
import { isPersisted, requestPersistence } from '../lib/storageHealth'
import type { PersistResult } from '../types'

function activeTreeHasRealWork(): boolean {
  const { trees, activeTreeId, nodes } = useTreeStore.getState()
  const tree = trees.find((t) => t.id === activeTreeId)
  return hasRealWork(tree, nodes.values())
}

function saveResult(persistResult: PersistResult) {
  return useSettingsStore.getState().recordDurability({ persistResult }).catch(reportWriteFailure)
}

// The user or browser may have changed persistence since the last session.
// Only a definite answer overwrites the stored result.
async function refreshStoredResult() {
  const stored = useSettingsStore.getState().settings.persistResult
  if (!stored) return
  const persisted = await isPersisted()
  if (persisted === null) return
  const fresh: PersistResult = persisted ? 'granted' : stored === 'granted' ? 'denied' : stored
  if (fresh !== stored) await saveResult(fresh)
}

/**
 * Asks the browser to persist storage the first time this session the active
 * tree holds real work, unless it already said yes. Chrome can turn an early
 * "no" into a "yes" as the site gets used, so a stored "denied" is asked again
 * next session. Mount once, after boot (`enabled`).
 */
export function useDurabilityWatcher(enabled: boolean) {
  const askedRef = useRef(false)

  useEffect(() => {
    if (!enabled || askedRef.current) return
    let disposed = false
    let unsubscribe: (() => void) | undefined

    const tryAsk = () => {
      if (askedRef.current || !activeTreeHasRealWork()) return
      askedRef.current = true
      unsubscribe?.()
      void requestPersistence().then((result) => {
        if (import.meta.env.DEV) console.info('[durability] persist() →', result)
        return saveResult(result)
      })
    }

    void refreshStoredResult().then(() => {
      if (disposed || askedRef.current) return
      if (useSettingsStore.getState().settings.persistResult === 'granted') {
        askedRef.current = true
        return
      }
      tryAsk()
      if (!askedRef.current) unsubscribe = useTreeStore.subscribe(tryAsk)
    })

    return () => {
      disposed = true
      unsubscribe?.()
    }
  }, [enabled])
}
