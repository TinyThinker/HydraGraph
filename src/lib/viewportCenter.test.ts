import { describe, it, expect } from 'vitest'
import { centerTarget, MIN_FOCUS_ZOOM } from './viewportCenter'
import { NODE_WIDTH, NODE_HEIGHT } from './nodeDimensions'

describe('centerTarget', () => {
  it('centers on the node box center', () => {
    const t = centerTarget({ positionX: 100, positionY: 200 }, 1)
    expect(t.x).toBe(100 + NODE_WIDTH / 2)
    expect(t.y).toBe(200 + NODE_HEIGHT / 2)
  })

  it('keeps currentZoom when it is >= MIN_FOCUS_ZOOM', () => {
    expect(centerTarget({ positionX: 0, positionY: 0 }, 1).zoom).toBe(1)
    expect(centerTarget({ positionX: 0, positionY: 0 }, MIN_FOCUS_ZOOM).zoom).toBe(MIN_FOCUS_ZOOM)
  })

  it('clamps up to MIN_FOCUS_ZOOM when the user is zoomed out', () => {
    expect(centerTarget({ positionX: 0, positionY: 0 }, 0.3).zoom).toBe(MIN_FOCUS_ZOOM)
  })

  it('never zooms out a user who is zoomed in', () => {
    expect(centerTarget({ positionX: 0, positionY: 0 }, 1.8).zoom).toBe(1.8)
  })
})
