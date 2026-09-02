import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { HeaderBar } from './HeaderBar'
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/settingsStore'
import { useTreeStore } from '../store/useTreeStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { db } from '../db/ChatDatabase'
import type { TurnNode } from '../types'

const BANNER = /No LLM provider configured/i

beforeEach(async () => {
  await db.delete()
  await db.open()
  // Default settings: Ollama at its default URL, no API keys → "needs provider".
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, hydrated: true })
})

afterEach(async () => {
  await db.delete()
})

describe('HeaderBar first-run banner', () => {
  it('shows the banner when no provider is configured', () => {
    render(<HeaderBar />)
    expect(screen.getByText(BANNER)).toBeInTheDocument()
  })

  it('clears the banner as soon as a key lands in the settings store — no reload', async () => {
    render(<HeaderBar />)
    expect(screen.getByText(BANNER)).toBeInTheDocument()

    // The Settings modal writes through useSettingsStore; HeaderBar must react to
    // that same store rather than a stale private copy.
    await act(async () => {
      await useSettingsStore.getState().updateSettings({ geminiApiKey: 'g-key' })
    })

    expect(screen.queryByText(BANNER)).not.toBeInTheDocument()
  })
})

function node(overrides: Partial<TurnNode>): TurnNode {
  return {
    id: 'x', treeId: 't', parentId: null, childrenIds: [], userPrompt: 'q',
    assistantResponse: 'a', positionX: 0, positionY: 0, isCollapsed: false,
    status: 'idle', modelUsed: 'm', timestamp: 0, ...overrides,
  }
}

describe('HeaderBar Compare button', () => {
  afterEach(() => {
    useTreeStore.setState({ nodes: new Map() })
    useSelectionStore.setState({ selectedNodeId: null })
  })

  it('is disabled with no siblings and enabled with >=2', () => {
    useTreeStore.setState({ nodes: new Map([['root', node({ id: 'root' })]]) })
    useSelectionStore.setState({ selectedNodeId: 'root' })
    const solo = render(<HeaderBar />)
    expect(screen.getByTitle('Compare sibling branches')).toBeDisabled()
    solo.unmount()

    useTreeStore.setState({
      nodes: new Map([
        ['root', node({ id: 'root' })],
        ['a', node({ id: 'a', parentId: 'root' })],
        ['b', node({ id: 'b', parentId: 'root' })],
      ]),
    })
    useSelectionStore.setState({ selectedNodeId: 'a' })
    render(<HeaderBar />)
    expect(screen.getByTitle('Compare sibling branches')).toBeEnabled()
  })
})
