import { NODE_WIDTH, NODE_HEIGHT } from './nodeDimensions'

/** Never pan a node into view at a zoom tighter than this. */
export const MIN_FOCUS_ZOOM = 0.9
/** Duration (ms) of the smooth pan when auto-centering on a node. */
export const FOCUS_DURATION = 450

/**
 * Compute the `setCenter` target that puts a node's box centre in the middle of
 * the viewport. Zoom is preserved when the user is already at/above
 * MIN_FOCUS_ZOOM and only clamped *up* when they are zoomed further out — a user
 * who is zoomed in (e.g. 1.8) is never yanked back out.
 */
export function centerTarget(
  node: { positionX: number; positionY: number },
  currentZoom: number,
): { x: number; y: number; zoom: number } {
  return {
    x: node.positionX + NODE_WIDTH / 2,
    y: node.positionY + NODE_HEIGHT / 2,
    zoom: Math.max(currentZoom, MIN_FOCUS_ZOOM),
  }
}
