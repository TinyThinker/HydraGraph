import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SplitLayout } from './SplitLayout'

vi.mock('./Canvas', () => ({ Canvas: () => <div data-testid="canvas-mock" /> }))

describe('SplitLayout', () => {
  let rectSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // jsdom returns a zero-sized rect; provide a deterministic 1000px width
    // so divider drag math produces a measurable ratio change.
    rectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({
        left: 0,
        top: 0,
        right: 1000,
        bottom: 600,
        width: 1000,
        height: 600,
        x: 0,
        y: 0,
        toJSON: () => {},
      } as DOMRect)
  })

  afterEach(() => {
    rectSpy.mockRestore()
  })

  it('renders both panes with the chat stream and input bar mounted', () => {
    render(<SplitLayout />)
    expect(screen.getByTestId('graph-pane')).toBeInTheDocument()
    expect(screen.getByTestId('chat-pane')).toBeInTheDocument()
    expect(screen.getByTestId('chat-stream')).toBeInTheDocument()
    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    expect(screen.getByTestId('canvas-mock')).toBeInTheDocument()
  })

  it('defaults the graph pane to a 40% width', () => {
    render(<SplitLayout />)
    expect(screen.getByTestId('graph-pane').style.width).toBe('40%')
  })

  it('resizes the graph pane when the divider is dragged', () => {
    render(<SplitLayout />)
    const divider = screen.getByTestId('split-divider')
    const graphPane = screen.getByTestId('graph-pane')

    expect(graphPane.style.width).toBe('40%')

    fireEvent.pointerDown(divider)
    fireEvent.pointerMove(window, { clientX: 650 })
    fireEvent.pointerUp(window)

    expect(graphPane.style.width).toBe('65%')
  })

  it('clamps the ratio to a maximum of 80%', () => {
    render(<SplitLayout />)
    const divider = screen.getByTestId('split-divider')
    const graphPane = screen.getByTestId('graph-pane')

    fireEvent.pointerDown(divider)
    fireEvent.pointerMove(window, { clientX: 990 })
    fireEvent.pointerUp(window)

    expect(graphPane.style.width).toBe('80%')
  })
})
