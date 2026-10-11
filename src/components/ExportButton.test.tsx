import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExportButton } from './ExportButton'
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/settingsStore'
import { useTreeStore } from '../store/useTreeStore'
import { downloadTreeExport } from '../lib/treeExport'
import { db } from '../db/ChatDatabase'
import type { ConversationTree, TurnNode } from '../types'

vi.mock('../lib/treeExport', () => ({ downloadTreeExport: vi.fn() }))

const tree: ConversationTree = {
  id: 'tree-a', title: 'A', rootNodeId: 'r', defaultSystemPrompt: '', createdAt: 0, updatedAt: 0,
}

const root: TurnNode = {
  id: 'r', treeId: 'tree-a', parentId: null, childrenIds: [], userPrompt: 'q',
  assistantResponse: 'a', positionX: 0, positionY: 0, isCollapsed: false,
  status: 'idle', modelUsed: 'm', timestamp: 0,
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS }, hydrated: true })
  useTreeStore.setState({ trees: [tree], activeTreeId: 'tree-a', nodes: new Map([['r', root]]) })
})

afterEach(() => {
  vi.mocked(downloadTreeExport).mockReset()
  useTreeStore.setState({ trees: [], activeTreeId: null, nodes: new Map() })
})

describe('ExportButton', () => {
  it('downloads the active tree once and stamps its export time', async () => {
    render(<ExportButton />)
    fireEvent.click(screen.getByTitle('Export this tree as JSON'))

    expect(downloadTreeExport).toHaveBeenCalledTimes(1)
    expect(downloadTreeExport).toHaveBeenCalledWith(tree, [root])
    await waitFor(() =>
      expect(useSettingsStore.getState().settings.exportedAt?.['tree-a']).toEqual(expect.any(Number)),
    )
  })

  it('does nothing without an active tree', () => {
    useTreeStore.setState({ activeTreeId: null })
    render(<ExportButton />)
    fireEvent.click(screen.getByTitle('Export this tree as JSON'))

    expect(downloadTreeExport).not.toHaveBeenCalled()
    expect(useSettingsStore.getState().settings.exportedAt).toBeUndefined()
  })
})
