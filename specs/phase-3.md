# Phase 3: Subway-Style Auto-Layout & Compact Nodes

## Scope
Disable manual canvas dragging, integrate a deterministic auto-layout engine (`d3-hierarchy` or `dagre`), and replace heavy canvas cards with compact subway-station pills.

## Sequential Tasks
- Task 3.1: Disable manual canvas node dragging (`nodesDraggable = false`) and configure smooth pan-and-zoom viewport controls.
- Task 3.2: Implement an auto-layout calculation module (e.g., using `d3-hierarchy`'s tree layout) that recalculates deterministic `(x, y)` coordinates whenever nodes are created, branched, or deleted.
- Task 3.3: Redesign canvas node components into compact "station pills" (fixed compact dimensions, displaying role icon, truncated 5–7 word summary, and branch badge).
- Task 3.4: Implement visual path highlighting: render active ancestry edges with a high-contrast accent track and dim inactive sibling subtrees.
- Task 3.5: Add viewport auto-centering to smoothly pan the minimap when a new node is spawned or selected.

## Passing Criteria
- Spawning multiple sibling or child nodes automatically positions them with zero collisions or overlapping edges.
- Canvas cards no longer render full multi-paragraph scrollable text or heavy toolbar buttons.
- The active path (`root -> selectedNode`) is visually distinct from inactive branches on the canvas.
- Clicking any station pill immediately centers it in the minimap and updates the linear chat pane.
- `npm run typecheck` and test suites pass.