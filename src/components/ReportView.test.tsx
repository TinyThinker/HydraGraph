import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ReportView } from './ReportView'
import { useReportStore } from '../store/useReportStore'
import { useTreeStore } from '../store/useTreeStore'
import { collectReportTurns, reportSourceDigest } from '../lib/reportContext'
import { reportFilename } from '../lib/reportDownload'
import type { ConversationTree, TreeReport, TurnNode } from '../types'

vi.mock('../lib/streamingClient', () => ({ streamLLMResponse: vi.fn() }))

function turn(id: string, parentId: string | null, childrenIds: string[] = []): TurnNode {
  return {
    id, treeId: 't', parentId, childrenIds, userPrompt: `prompt ${id}`, assistantResponse: `answer ${id}`,
    positionX: 0, positionY: 0, isCollapsed: false, status: 'idle', modelUsed: 'm', timestamp: 0,
  }
}

const nodes = new Map([turn('r', null, ['a']), turn('a', 'r')].map((n) => [n.id, n]))

function report(over: Partial<TreeReport> = {}): TreeReport {
  return {
    id: 'rep-1', createdAt: 0, updatedAt: 0, title: 'First', leafIds: ['a'], brief: 'b',
    provider: 'openrouter', model: 'a/big', text: '# First\n\nBody text', status: 'idle',
    inputTokens: 100, outputTokens: 20, sourceDigest: reportSourceDigest(collectReportTurns(['a'], nodes)), ...over,
  }
}

function tree(reports: TreeReport[]): ConversationTree {
  return { id: 't', title: 'Pipeline Design!', rootNodeId: 'r', defaultSystemPrompt: '', createdAt: 0, updatedAt: 0, reports }
}

describe('ReportView', () => {
  beforeEach(() => {
    useTreeStore.setState({ nodes, activeTreeId: 't' })
    useReportStore.setState({ generating: false, liveText: null, activeReportId: 'rep-1' })
  })

  it('renders the report with its meta line and no stale badge', () => {
    render(<ReportView tree={tree([report()])} report={report()} />)
    expect(screen.getByText('Body text')).toBeTruthy()
    expect(screen.getByText(/^a\/big · 100 in · 20 out/)).toBeTruthy()
    expect(screen.queryByText('Sources changed since this was written')).toBeNull()
  })

  it('shows the stale badge after a source turn changes', () => {
    render(<ReportView tree={tree([report()])} report={report()} />)
    act(() => {
      const next = new Map(nodes)
      next.set('a', { ...nodes.get('a')!, assistantResponse: 'a regenerated, longer answer' })
      useTreeStore.setState({ nodes: next })
    })
    expect(screen.getByText('Sources changed since this was written')).toBeTruthy()
  })

  it('shows the stale badge when a ticked turn is gone', () => {
    render(<ReportView tree={tree([report({ leafIds: ['gone'] })])} report={report({ leafIds: ['gone'] })} />)
    expect(screen.getByText('Sources changed since this was written')).toBeTruthy()
  })

  it('lists reports when there is more than one and switches on click', () => {
    const second = report({ id: 'rep-2', title: 'Second' })
    render(<ReportView tree={tree([report(), second])} report={report()} />)
    fireEvent.click(screen.getByText(/^Second ·/))
    expect(useReportStore.getState().activeReportId).toBe('rep-2')
  })

  it('shows live text while generating', () => {
    useReportStore.setState({ generating: true, liveText: 'streaming words' })
    render(<ReportView tree={tree([])} report={undefined} />)
    expect(screen.getByText('streaming words')).toBeTruthy()
  })
})

describe('reportFilename', () => {
  it('uses the tree slug, a report marker and the date', () => {
    expect(reportFilename(tree([]), new Date(2026, 9, 13))).toBe('pipeline-design-report-2026-10-13.md')
  })
})
