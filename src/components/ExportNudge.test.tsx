import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ExportNudge } from './ExportNudge'
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/settingsStore'
import { useTreeStore } from '../store/useTreeStore'
import { db } from '../db/ChatDatabase'
import type { AppSettings, ConversationTree, TurnNode } from '../types'

vi.mock('../lib/treeExport', () => ({ downloadTreeExport: vi.fn() }))

const NOW = Date.now()

function tree(id: string): ConversationTree {
  return { id, title: id, rootNodeId: 'n0', defaultSystemPrompt: '', createdAt: 0, updatedAt: NOW - 1000 }
}

function turns(n: number, treeId: string): Map<string, TurnNode> {
  return new Map(
    Array.from({ length: n }, (_, i) => [
      `n${i}`,
      {
        id: `n${i}`, treeId, parentId: null, childrenIds: [], userPrompt: 'q', assistantResponse: 'a',
        positionX: 0, positionY: 0, isCollapsed: false, status: 'idle', modelUsed: 'm', timestamp: 0,
      } satisfies TurnNode,
    ]),
  )
}

function setSettings(patch: Partial<AppSettings>) {
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, ...patch }, hydrated: true })
}

beforeEach(async () => {
  await db.delete()
  await db.open()
  setSettings({})
  useTreeStore.setState({
    trees: [tree('tree-a'), tree('tree-b')],
    activeTreeId: 'tree-a',
    nodes: turns(6, 'tree-a'),
  })
})

afterEach(() => {
  useTreeStore.setState({ trees: [], activeTreeId: null, nodes: new Map() })
})

describe('ExportNudge', () => {
  it('renders nothing below the nudge threshold', () => {
    useTreeStore.setState({ nodes: turns(5, 'tree-a') })
    const { container } = render(<ExportNudge />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the firm copy when persistence was not granted', () => {
    setSettings({ persistResult: 'denied' })
    render(<ExportNudge />)

    expect(screen.getByTestId('export-nudge')).toHaveAttribute('data-variant', 'firm')
    expect(screen.getByText(/live only in this browser/)).toBeInTheDocument()
    expect(screen.getByText(/may clear them/)).toBeInTheDocument()
  })

  it('shows the soft copy when persistence was granted', () => {
    setSettings({ persistResult: 'granted' })
    render(<ExportNudge />)

    expect(screen.getByTestId('export-nudge')).toHaveAttribute('data-variant', 'soft')
    expect(screen.getByText(/live only in this browser/)).toBeInTheDocument()
    expect(screen.queryByText(/may clear them/)).not.toBeInTheDocument()
  })

  it('exporting this tree hides it', async () => {
    render(<ExportNudge />)
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    await waitFor(() => expect(screen.queryByTestId('export-nudge')).not.toBeInTheDocument())
  })

  it('an export of a different tree does not hide it', () => {
    setSettings({ exportedAt: { 'tree-b': NOW } })
    render(<ExportNudge />)
    expect(screen.getByTestId('export-nudge')).toBeInTheDocument()
  })

  it('dismiss snoozes it', async () => {
    render(<ExportNudge />)
    fireEvent.click(screen.getByRole('button', { name: /dismiss export reminder/i }))
    await waitFor(() => expect(screen.queryByTestId('export-nudge')).not.toBeInTheDocument())
    expect(useSettingsStore.getState().settings.exportNudgeDismissedAt).toEqual(expect.any(Number))
  })
})
