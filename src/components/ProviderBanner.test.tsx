import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ProviderBanner } from './ProviderBanner'
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/settingsStore'
import { useTreeStore } from '../store/useTreeStore'
import { DEMO_TREE_ID } from '../lib/demoTree'
import { buildExportDoc, serializeExportDoc } from '../lib/treeExport'
import { db } from '../db/ChatDatabase'
import type { ConversationTree, TurnNode } from '../types'

const noop = () => {}

beforeEach(() => {
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS }, hydrated: true })
  useTreeStore.setState({ activeTreeId: null })
})

describe('ProviderBanner', () => {
  it('warns on the visitor’s own tree when no provider is configured', () => {
    useTreeStore.setState({ activeTreeId: 'my-tree' })
    render(<ProviderBanner onOpenSettings={noop} />)

    expect(screen.getByText(/No LLM provider configured/i)).toBeInTheDocument()
    expect(screen.queryByTestId('demo-banner')).not.toBeInTheDocument()
  })

  it('explains instead of warning while the demo tree is open', () => {
    useTreeStore.setState({ activeTreeId: DEMO_TREE_ID })
    render(<ProviderBanner onOpenSettings={noop} />)

    expect(screen.getByTestId('demo-banner')).toBeInTheDocument()
    expect(screen.getByText(/no API key needed/i)).toBeInTheDocument()
    expect(screen.queryByText(/No LLM provider configured/i)).not.toBeInTheDocument()
  })

  it('renders nothing once a provider is configured, demo or not', () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, openRouterApiKey: 'or-key' },
      hydrated: true,
    })

    useTreeStore.setState({ activeTreeId: DEMO_TREE_ID })
    const { container, unmount } = render(<ProviderBanner onOpenSettings={noop} />)
    expect(container).toBeEmptyDOMElement()
    unmount()

    useTreeStore.setState({ activeTreeId: 'my-tree' })
    const own = render(<ProviderBanner onOpenSettings={noop} />)
    expect(own.container).toBeEmptyDOMElement()
  })

  it('the warning variant has no import link', () => {
    useTreeStore.setState({ activeTreeId: 'my-tree' })
    render(<ProviderBanner onOpenSettings={noop} />)
    expect(screen.queryByText(/Import a backup/)).not.toBeInTheDocument()
  })
})

describe('ProviderBanner — import a backup from the demo', () => {
  const tree: ConversationTree = {
    id: 'old', title: 'Saved work', rootNodeId: 'r', defaultSystemPrompt: '', createdAt: 1, updatedAt: 2,
  }
  const root: TurnNode = {
    id: 'r', treeId: 'old', parentId: null, childrenIds: [], userPrompt: 'q', assistantResponse: 'a',
    positionX: 0, positionY: 0, isCollapsed: false, status: 'idle', modelUsed: 'm', timestamp: 1,
  }

  beforeEach(async () => {
    await db.delete()
    await db.open()
    useTreeStore.setState({ activeTreeId: DEMO_TREE_ID, trees: [], nodes: new Map() })
  })

  it('the link opens the file picker', () => {
    render(<ProviderBanner onOpenSettings={noop} />)
    const input = screen.getByTestId('demo-import-input')
    const click = vi.spyOn(input, 'click')

    fireEvent.click(screen.getByRole('button', { name: /Returning\? Import a backup/ }))
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('a valid file imports a tree and opens it', async () => {
    render(<ProviderBanner onOpenSettings={noop} />)
    const text = serializeExportDoc(buildExportDoc(tree, [root]))
    const file = new File([text], 'backup.json', { type: 'application/json' })

    fireEvent.change(screen.getByTestId('demo-import-input'), { target: { files: [file] } })

    await waitFor(() => expect(useTreeStore.getState().trees).toHaveLength(1))
    const imported = useTreeStore.getState().trees[0]
    expect(imported.title).toBe('Saved work')
    expect(useTreeStore.getState().activeTreeId).toBe(imported.id)
  })

  it('a bad file shows the error inline', async () => {
    render(<ProviderBanner onOpenSettings={noop} />)
    const file = new File(['not json'], 'x.json', { type: 'application/json' })

    fireEvent.change(screen.getByTestId('demo-import-input'), { target: { files: [file] } })

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(useTreeStore.getState().trees).toHaveLength(0)
  })
})
