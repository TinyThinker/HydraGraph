import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'
import { db } from './db/ChatDatabase'
import { useTreeStore } from './store/useTreeStore'
import { useSettingsStore, DEFAULT_SETTINGS } from './store/settingsStore'
import { useCatalogStore } from './store/catalogStore'
import { DEMO_TREE_ID } from './lib/demoTree'
import { DEMO_TURNS } from './lib/demoContent'

/**
 * The landing-page path, end to end: empty browser, no API key, no network.
 * Boots the real <App/> (same boot sequence as main.tsx) and asserts a stranger
 * sees the demo tree with a priced receipt rather than an empty canvas.
 */

beforeEach(async () => {
  await db.delete()
  await db.open()
  // No key, Ollama at its default URL — i.e. nothing configured.
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS }, hydrated: false })
  useTreeStore.setState({
    nodes: new Map(),
    trees: [],
    activeTreeId: null,
    liveText: new Map(),
    lastSpawnedNodeId: null,
  })
  // Offline: the catalog refresh must fail over to the bundled snapshot.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('offline'))),
  )
})

afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete()
})

describe('first run with an empty database and no API key', () => {
  it('lands on the demo tree, fully explorable, with a priced receipt', async () => {
    render(<App />)

    await waitFor(() => expect(useTreeStore.getState().activeTreeId).toBe(DEMO_TREE_ID))
    expect(useTreeStore.getState().nodes.size).toBe(DEMO_TURNS.length)

    // The demo title is in the header, and the first turn's answer is readable
    // in the chat pane without a single click.
    expect(await screen.findByText(/Metrics pipeline at 40k events\/sec/)).toBeInTheDocument()
    expect(await screen.findByText(/load-bearing/)).toBeInTheDocument()

    // No scary warning — the calm demo explainer instead.
    expect(screen.getByTestId('demo-banner')).toBeInTheDocument()
    expect(screen.queryByText(/No LLM provider configured/i)).not.toBeInTheDocument()

    // Prices resolve offline, from the bundled catalog.
    expect(useCatalogStore.getState().models.length).toBeGreaterThan(0)
    await act(async () => {
      fireEvent.click(screen.getByTitle('Cost receipt for this tree'))
    })
    expect(await screen.findByText(/Context you didn't pay for/)).toBeInTheDocument()
    expect(screen.queryByText(/No priced turns yet/)).not.toBeInTheDocument()
    // Every canned turn is priced, so nothing is excluded from the receipt.
    expect(screen.queryByText(/unknown model pricing/)).not.toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(`${DEMO_TURNS.length} turns`)).length).toBe(2)
    // Real dollars, not $0.0000 — at least one non-zero digit after the point.
    // The `~` marks the figures descending from the modelled linear thread.
    expect(screen.getByText(/saved · ~\d+%/)).toBeInTheDocument()
    expect(screen.getAllByText(/\$0\.\d*[1-9]/).length).toBeGreaterThanOrEqual(3)
    // A stranger is told which half of this receipt is measured.
    expect(screen.getByText(/no prompt caching/)).toBeInTheDocument()
  })

  it('reopens the demo on reload rather than reseeding a second copy', async () => {
    const first = render(<App />)
    await waitFor(() => expect(useTreeStore.getState().activeTreeId).toBe(DEMO_TREE_ID))
    first.unmount()

    // Simulate a reload: fresh stores, same IndexedDB.
    useTreeStore.setState({ nodes: new Map(), trees: [], activeTreeId: null })
    render(<App />)

    await waitFor(() => expect(useTreeStore.getState().activeTreeId).toBe(DEMO_TREE_ID))
    expect(await db.trees.count()).toBe(1)
    expect(await db.nodes.where('treeId').equals(DEMO_TREE_ID).count()).toBe(DEMO_TURNS.length)
  })
})
