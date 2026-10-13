import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { TurnNodeComponent } from './TurnNode'
import { useTreeStore } from '../store/useTreeStore'
import { useReportStore } from '../store/useReportStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { enableRenderTally, disableRenderTally, resetRenderTally, getRenderTally } from '../lib/renderTally'
import type { TurnNode } from '../types'

vi.mock('../lib/streamingClient', () => ({ streamLLMResponse: vi.fn() }))

function turn(id: string, parentId: string | null, childrenIds: string[] = []): TurnNode {
  return {
    id, treeId: 't', parentId, childrenIds, userPrompt: `prompt ${id}`, assistantResponse: '',
    positionX: 0, positionY: 0, isCollapsed: false, status: 'idle', modelUsed: 'm', timestamp: 0,
  }
}

// r → (a, b)
const all = [turn('r', null, ['a', 'b']), turn('a', 'r'), turn('b', 'r')]

function renderPills() {
  useTreeStore.setState({ nodes: new Map(all.map((n) => [n.id, n])), activeTreeId: 't' })
  return render(
    <ReactFlowProvider>
      {all.map((n) => (
        <div key={n.id} data-testid={`pill-${n.id}`}>
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <TurnNodeComponent {...({ data: n, selected: false } as any)} />
        </div>
      ))}
    </ReactFlowProvider>,
  )
}

const pill = (container: HTMLElement, id: string) =>
  container.querySelector(`[data-testid="pill-${id}"] > div`) as HTMLElement

describe('ticking branches on the canvas', () => {
  beforeEach(() => {
    useReportStore.setState({ selecting: false, leafIds: [], includedIds: new Set() })
    useSelectionStore.setState({ selectedNodeId: null })
  })
  afterEach(() => {
    disableRenderTally()
    resetRenderTally()
  })

  it('a click in report mode ticks the turn and shows the badge on that pill only', () => {
    const { container, getAllByLabelText } = renderPills()
    act(() => useReportStore.getState().startSelecting())
    fireEvent.click(pill(container, 'a'))
    expect(useReportStore.getState().leafIds).toEqual(['a'])
    expect(getAllByLabelText('In report')).toHaveLength(1)
    expect(pill(container, 'a').dataset.reportTicked).toBe('true')
    expect(pill(container, 'r').dataset.reportTicked).toBeUndefined()
  })

  it('outside report mode a click does not tick', () => {
    const { container, queryByLabelText } = renderPills()
    fireEvent.click(pill(container, 'a'))
    expect(useReportStore.getState().leafIds).toEqual([])
    expect(queryByLabelText('In report')).toBeNull()
  })

  it('ticking one branch does not re-render an unrelated pill', () => {
    renderPills()
    act(() => useReportStore.getState().startSelecting())
    enableRenderTally()
    resetRenderTally()
    act(() => useReportStore.getState().toggle('a'))
    const tally = getRenderTally()
    expect(tally.a ?? 0).toBeGreaterThan(0)
    expect(tally.r ?? 0).toBeGreaterThan(0)
    expect(tally.b ?? 0).toBe(0)
  })
})
