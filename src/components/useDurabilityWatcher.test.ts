import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useDurabilityWatcher } from './useDurabilityWatcher'
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/settingsStore'
import { useTreeStore } from '../store/useTreeStore'
import { DEMO_TREE_ID } from '../lib/demoTree'
import { db } from '../db/ChatDatabase'
import { isPersisted, requestPersistence } from '../lib/storageHealth'
import type { AppSettings, ConversationTree, TurnNode } from '../types'

vi.mock('../lib/storageHealth', () => ({
  requestPersistence: vi.fn(),
  isPersisted: vi.fn(),
}))

const persistMock = vi.mocked(requestPersistence)
const persistedMock = vi.mocked(isPersisted)

function node(id: string, treeId: string): TurnNode {
  return {
    id, treeId, parentId: null, childrenIds: [], userPrompt: 'q', assistantResponse: 'a',
    positionX: 0, positionY: 0, isCollapsed: false, status: 'idle', modelUsed: 'm', timestamp: 0,
  }
}

function tree(id: string): ConversationTree {
  return { id, title: 'T', rootNodeId: 'n0', defaultSystemPrompt: '', createdAt: 0, updatedAt: 0 }
}

function loadTreeWithTurns(n: number, treeId = 'mine') {
  const nodes = new Map(Array.from({ length: n }, (_, i) => [`n${i}`, node(`n${i}`, treeId)]))
  useTreeStore.setState({ trees: [tree(treeId)], activeTreeId: treeId, nodes })
}

function setSettings(patch: Partial<AppSettings>) {
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, ...patch }, hydrated: true })
}

// Let pending promise chains in the hook settle before a negative check.
const flush = () => act(() => new Promise<void>((r) => setTimeout(r, 0)))

let recordSpy: ReturnType<typeof vi.spyOn>

beforeEach(async () => {
  await db.delete()
  await db.open()
  setSettings({})
  persistMock.mockReset().mockResolvedValue('denied')
  persistedMock.mockReset().mockResolvedValue(false)
  recordSpy = vi.spyOn(useSettingsStore.getState(), 'recordDurability')
})

afterEach(() => {
  recordSpy.mockRestore()
  useTreeStore.setState({ trees: [], activeTreeId: null, nodes: new Map() })
})

describe('useDurabilityWatcher', () => {
  it('asks once and writes once per session after real work', async () => {
    loadTreeWithTurns(3)
    renderHook(() => useDurabilityWatcher(true))

    await waitFor(() => expect(recordSpy).toHaveBeenCalledWith({ persistResult: 'denied' }))
    expect(persistMock).toHaveBeenCalledTimes(1)

    // More turns in the same session do not ask again.
    act(() => loadTreeWithTurns(5))
    await flush()
    expect(persistMock).toHaveBeenCalledTimes(1)
    expect(recordSpy).toHaveBeenCalledTimes(1)
    expect(useSettingsStore.getState().settings.persistResult).toBe('denied')
  })

  it('waits until the threshold is reached', async () => {
    loadTreeWithTurns(2)
    renderHook(() => useDurabilityWatcher(true))
    await flush()
    expect(persistMock).not.toHaveBeenCalled()

    act(() => loadTreeWithTurns(3))
    await waitFor(() => expect(persistMock).toHaveBeenCalledTimes(1))
  })

  it('does nothing before boot or on the demo tree', async () => {
    loadTreeWithTurns(10)
    renderHook(() => useDurabilityWatcher(false))
    loadTreeWithTurns(10, DEMO_TREE_ID)
    renderHook(() => useDurabilityWatcher(true))
    await flush()
    expect(persistMock).not.toHaveBeenCalled()
  })

  it('does not ask when the stored result is still granted', async () => {
    setSettings({ persistResult: 'granted' })
    persistedMock.mockResolvedValue(true)
    loadTreeWithTurns(3)
    renderHook(() => useDurabilityWatcher(true))

    await waitFor(() => expect(persistedMock).toHaveBeenCalled())
    await flush()
    expect(persistMock).not.toHaveBeenCalled()
    expect(recordSpy).not.toHaveBeenCalled()
  })

  it('asks again in a new session when the stored result is denied', async () => {
    setSettings({ persistResult: 'denied' })
    persistMock.mockResolvedValue('granted')
    loadTreeWithTurns(3)
    renderHook(() => useDurabilityWatcher(true))

    await waitFor(() => expect(recordSpy).toHaveBeenCalledWith({ persistResult: 'granted' }))
    expect(persistMock).toHaveBeenCalledTimes(1)
  })

  it('refreshes a stale granted to denied, then asks', async () => {
    setSettings({ persistResult: 'granted' })
    persistedMock.mockResolvedValue(false)
    loadTreeWithTurns(3)
    renderHook(() => useDurabilityWatcher(true))

    await waitFor(() => expect(persistMock).toHaveBeenCalledTimes(1))
    expect(recordSpy).toHaveBeenNthCalledWith(1, { persistResult: 'denied' })
  })
})
