import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { ReaderPanel } from './ReaderPanel'
import { useReaderPanel } from './useReaderPanel'
import { useTreeStore } from '../store/useTreeStore'
import { db } from '../db/ChatDatabase'
import type { TurnNode } from '../types'

// Helper: create a node with sensible defaults
function createNode(overrides: Partial<TurnNode>): TurnNode {
  const id = overrides.id ?? crypto.randomUUID()
  return {
    id,
    treeId: overrides.treeId ?? 'tree-test',
    parentId: overrides.parentId ?? null,
    childrenIds: overrides.childrenIds ?? [],
    userPrompt: overrides.userPrompt ?? 'What is the meaning of life?',
    assistantResponse: overrides.assistantResponse ?? '',
    positionX: overrides.positionX ?? 400,
    positionY: overrides.positionY ?? 100,
    isCollapsed: overrides.isCollapsed ?? false,
    status: overrides.status ?? 'idle',
    modelUsed: overrides.modelUsed ?? 'gemini-2.5-flash',
    timestamp: overrides.timestamp ?? Date.now(),
    provider: overrides.provider ?? 'gemini',
    inputTokens: overrides.inputTokens,
    outputTokens: overrides.outputTokens,
  }
}

describe('ReaderPanel', () => {
  beforeEach(async () => {
    // Reset database
    await db.delete()
    await db.open()

    // Reset stores
    useTreeStore.setState({
      nodes: new Map(),
      trees: [],
      activeTreeId: 'tree-test',
      liveText: new Map(),
    })
    useReaderPanel.setState({ nodeId: null })
  })

  describe('Test A: Full text display with markdown rendering', () => {
    it('shows the complete untruncated response with markdown headings', async () => {
      // Create a long response that extends past 2000 characters
      const longResponse = `# Reader Heading\n\nThis is a test response.\n\n${Array(300).fill('Lorem ipsum dolor sit amet. ').join('')}ZZZ_TAIL_MARKER\n\nEnd of response.`

      const node = createNode({
        id: 'node-1',
        userPrompt: 'Test user prompt',
        assistantResponse: longResponse,
      })

      // Add node to store and open panel
      useTreeStore.setState({
        nodes: new Map([['node-1', node]]),
      })

      await act(async () => {
        useReaderPanel.getState().open('node-1')
      })

      render(<ReaderPanel />)

      // Assert the full untruncated text is shown (tail marker is visible)
      expect(screen.getByText(/ZZZ_TAIL_MARKER/, { exact: false })).toBeInTheDocument()

      // Assert markdown heading is rendered as h1
      const heading = screen.getByText('Reader Heading')
      expect(heading.tagName).toBe('H1')
    })
  })

  describe('Test B: Close button functionality', () => {
    it('closes the panel when close button is clicked', async () => {
      const node = createNode({
        id: 'node-2',
        userPrompt: 'Test prompt',
        assistantResponse: `# Test Heading\n\nSome content with ZZZ_TAIL_MARKER at the end.`,
      })

      useTreeStore.setState({
        nodes: new Map([['node-2', node]]),
      })

      await act(async () => {
        useReaderPanel.getState().open('node-2')
      })

      render(<ReaderPanel />)

      // Assert panel content is present
      expect(screen.getByText(/ZZZ_TAIL_MARKER/, { exact: false })).toBeInTheDocument()

      // Find and click the close button
      const closeButton = screen.getByLabelText('Close')
      fireEvent.click(closeButton)

      // Assert panel content is gone and nodeId is cleared
      expect(screen.queryByText(/ZZZ_TAIL_MARKER/)).not.toBeInTheDocument()
      expect(useReaderPanel.getState().nodeId).toBe(null)
    })
  })

  describe('Test C: Null nodeId handling', () => {
    it('renders nothing when nodeId is null', () => {
      render(<ReaderPanel />)

      // Assert nothing is rendered
      expect(screen.queryByText('Full text')).not.toBeInTheDocument()
    })
  })

  describe('Test D: Deleted node auto-dismiss', () => {
    it('renders nothing when nodeId points to a non-existent node', async () => {
      await act(async () => {
        useReaderPanel.getState().open('nonexistent-node-id')
      })

      render(<ReaderPanel />)

      // Assert panel is not rendered
      expect(screen.queryByText('Full text')).not.toBeInTheDocument()
    })
  })

  describe('Test E: Empty response state', () => {
    it('shows "No response yet." when response is empty', async () => {
      const node = createNode({
        id: 'node-3',
        userPrompt: 'Test prompt',
        assistantResponse: '',
      })

      useTreeStore.setState({
        nodes: new Map([['node-3', node]]),
      })

      await act(async () => {
        useReaderPanel.getState().open('node-3')
      })

      render(<ReaderPanel />)

      // Assert the empty state message is shown
      expect(screen.getByText('No response yet.')).toBeInTheDocument()
    })
  })

  describe('Test G: Per-turn dollar cost on the last-generation line', () => {
    it('appends the formatted turn cost when token counts and a known price exist', async () => {
      const node = createNode({
        id: 'node-cost',
        modelUsed: 'gemini-2.5-flash',
        provider: 'gemini',
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      })

      useTreeStore.setState({ nodes: new Map([['node-cost', node]]) })

      await act(async () => {
        useReaderPanel.getState().open('node-cost')
      })

      render(<ReaderPanel />)

      expect(screen.getByText(/Last generation:.*\$2\.80/)).toBeInTheDocument()
    })
  })

  describe('Test F: Streaming text via liveText', () => {
    it('shows liveText when available, even if assistantResponse exists', async () => {
      const node = createNode({
        id: 'node-4',
        userPrompt: 'Test prompt',
        assistantResponse: 'Old response',
      })

      const liveText = 'Live streaming text with STREAMING_MARKER'

      useTreeStore.setState({
        nodes: new Map([['node-4', node]]),
        liveText: new Map([['node-4', liveText]]),
      })

      await act(async () => {
        useReaderPanel.getState().open('node-4')
      })

      render(<ReaderPanel />)

      // Assert the live text is shown, not the stored response
      expect(screen.getByText(/STREAMING_MARKER/, { exact: false })).toBeInTheDocument()
      expect(screen.queryByText('Old response')).not.toBeInTheDocument()
    })
  })
})
