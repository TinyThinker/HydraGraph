# Phase Progress

## Phase 1 — POC baseline
Status: complete (pre-existing on `poc_enhancements_1`). Spatial conversation tree,
Dexie persistence, streaming client, settings store, layered dispatch resolution.

## Phase 2 — Dual-Pane Split Layout & Ancestry Stream
Status: **complete** — 2026-08-31
Branch: `poc_enhancements_1`

| Task | Status | Files | Notes |
|------|--------|-------|-------|
| 2.1 Lineage selector `getAncestryChain(nodes, selectedNodeId)` | ✅ | `src/lib/ancestry.ts`, `src/lib/ancestry.test.ts` | Pure upward walk + reverse; guards null id, missing id, broken parent pointer, and cycles. Returns `[root, …, selected]`. |
| 2.2 Split layout container (40% graph / 60% chat) | ✅ | `src/components/SplitLayout.tsx`, `src/components/SplitLayout.test.tsx` | Draggable vertical divider, ratio clamped to 20–80%. Mounted in `App.tsx` alongside `ReaderPanel`. |
| 2.3 `ChatStreamView` ancestry stream | ✅ | `src/components/ChatStreamView.tsx`, `src/components/ChatMessage.tsx`, `src/components/ChatStreamView.test.tsx` | Renders the ordered ancestry array as chat bubbles: right-aligned user bubble + left-aligned assistant bubble with full `MarkdownContent`. Telemetry line shows `modelUsed` and `N in · M out tokens` (or a `streaming…` pulse while live). Auto-scrolls to bottom as text streams. Empty turns (bare root) are filtered out. |
| 2.4 Fixed bottom input bar → dispatch + fork | ✅ | `src/components/ChatInputBar.tsx`, `src/components/ChatInputBar.test.tsx`, `forkAndSubmit` action in `src/store/useTreeStore.ts` | Submitting forks a fresh child off the active node (`addNode` appends to `parent.childrenIds`, so sibling branches are never overwritten), dispatches the prompt via `submitPrompt`, then shifts active selection to the new child. Enter submits; Shift+Enter newlines. |
| 2.5 Two-way selection sync | ✅ | `src/store/useSelectionStore.ts`, `src/components/CanvasSelectionSync.tsx`, `src/components/useActiveNodeId.ts` | `useSelectionStore` holds `selectedNodeId` + a `focusNonce`. Canvas click → store via `useOnSelectionChange`. Chat click → `selectAndFocus` bumps `focusNonce`; `CanvasSelectionSync` reacts by centering the viewport (`setCenter`, zoom 1.2) and marking the node selected in React Flow. `useActiveNodeId` falls back to the tree root when nothing is selected. |

### Passing criteria
- ✅ Selecting node *N* renders only `[root → … → N]` in the chat pane (sibling branches excluded — covered by `ChatStreamView.test.tsx` and `ancestry.test.ts`).
- ✅ Submitting a prompt on an ancestor node creates a new fork without overwriting existing siblings (`forkAndSubmit` → `addNode` append semantics).
- ✅ Response streaming renders in the chat pane via the existing throttled `liveText` map (per-node subscription, same pattern as `TurnNode`) — canvas rendering is untouched.
- ✅ `npm run typecheck` passes.
- ✅ `npm test` — 27 files, 224 tests passing (7 new: 4 `ChatStreamView`, 3 `ChatInputBar`; `SplitLayout` test updated for the mounted stream/input).
- ✅ `npm run lint` (oxlint) clean.

### Not committed
All changes are staged in the working tree only — no commits made per instructions.

## Phase 3 — Subway-Style Auto-Layout & Compact Nodes
Status: **complete** — 2026-08-31
Branch: `poc_enhancements_1`

New dependencies: `d3-hierarchy@^3.1.2`, `@types/d3-hierarchy@^3.1.7` (installed via `npm install`).
`@dagrejs/dagre` left in `package.json` but no longer imported (auto-layout moved to d3-hierarchy).

| Task | Status | Files | Notes |
|------|--------|-------|-------|
| 3.1 Disable manual node dragging + smooth pan/zoom | ✅ | `src/components/Canvas.tsx`, `src/components/useCanvasGraph.ts` | `nodesDraggable={false}`; viewport props `panOnDrag`, `panOnScroll` + `panOnScrollSpeed={0.5}`, `zoomOnScroll`, `zoomOnPinch`, `zoomOnDoubleClick`, `minZoom={0.2}`, `maxZoom={2}`. Removed the now-dead drag path: `onNodeDragStart/Stop` handlers, `mergeDragPosition`, `draggingIdRef`, the `position` branch of `onNodesChange` and its debounce timers. No test changes. |
| 3.2 Deterministic auto-layout (d3-hierarchy) recomputed on create/branch/delete | ✅ | `src/lib/autoLayout.ts`, `src/lib/autoLayout.test.ts`, `src/store/useTreeStore.ts` | `layoutTree(nodes)` rewritten on `d3.hierarchy` + `d3.tree().nodeSize([W+64, H+90])`, built manually (not `stratify`) with a `seen` Set for cycle/missing-pointer safety; root = `parentId===null` with earliest `timestamp`; converts to top-left coords and normalizes min-x/min-y to exactly 40; returns `new Map()` when no root. `computeChildPosition` re-implemented via a synthetic `__new__` child through `layoutTree`. Store: new pure `relayoutNodes(nodes)` + internal `persistLayout`/`recomputeLayout` (single Dexie `rw` transaction, only writes changed positions). `addNode` (covers `forkAndSubmit`) and `deleteNodeSubtree` now recompute + persist the full deterministic layout; `relayoutActiveTree` reuses the helpers and still bumps `fitViewNonce`; `addNode`/`deleteNodeSubtree` do NOT bump it. Tests rewritten to structure-based assertions (per-node positions, zero 320-box overlap, child-below-parent, determinism, normalization, no-throw on cycle/broken pointer). |
| 3.3 Compact "station pill" canvas nodes | ✅ | `src/lib/nodeDimensions.ts` (new), `src/lib/stationSummary.ts` + `.test.ts` (new), `src/components/TurnNode.tsx` (rewritten), `src/components/PillActions.tsx` (new), `src/components/useCanvasGraph.ts`, `src/lib/autoLayout.ts`, `src/components/CanvasViewport.tsx`, `src/components/CanvasSelectionSync.tsx`, `src/components/CanvasSearchFocus.tsx` | Shared `NODE_WIDTH=240`/`NODE_HEIGHT=72` consts replace the hard-coded 320/240 everywhere; RF wrappers use fixed dims unconditionally (resize removed). Pill = role icon (`Shield`/`TriangleAlert`/`Loader`/`Bot`/`MessageCircle`) + one-line 5–7 word `stationSummary()` + branch badge (`GitBranch` + count when `childrenIds.length > 1`) + minimal collapse chevron (`title="Collapse subtree"` / `title="Show N hidden"`) + `sr-only` stale sentence + selection/status ring + `PillActions` (delete + inline "Remove N node(s)?" confirmation, preserved `title` strings). No `NodeResizer`, prompt textarea, response body, model picker, system-prompt editor, regenerate, or ContextMeter on the canvas. `useRenderTally` + per-node `liveText` subscription retained. Double-click still opens the ReaderPanel. Test changes: `resizableCard.test.tsx` repurposed to assert fixed pill dims even with `width:500` on the store node; `renderBudget.test.tsx` "Test B" (2000-char truncation) deleted; `collapse.test.tsx` test 3 locates the control by `title`; `ContextMeter.test.tsx` "TurnNode integration" block removed (asserted removed UI; ContextMeter's own tests kept); `autoLayout.test.ts` overlap boxes import the constants. |
| 3.4 Active-path highlighting + dim inactive subtrees | ✅ | `src/lib/pathHighlight.ts` + `.test.ts` (new), `src/components/pathHighlight.canvas.test.tsx` (new), `src/components/useCanvasGraph.ts` | `pathHighlight.ts`: `activePathIds(nodes, selectedNodeId)` → `Set` of `root→selected` ids via `getAncestryChain`, or `null` when nothing selected (= dim nothing); `edgeAppearance(src, tgt, active)` → `ACTIVE_EDGE_STYLE` `{stroke:'#22d3ee',strokeWidth:3}` + `animated:true` on-path, `INACTIVE_EDGE_STYLE` `{stroke:'#1e293b',strokeWidth:1.5,opacity:0.35}` off-path, `BASE_EDGE_STYLE` when `active===null`; `pillDimClassName(id, active)` → `'opacity-40 saturate-50 transition-opacity'` for off-path nodes. `useCanvasGraph` subscribes to `useSelectionStore.selectedNodeId`, memoizes `activeIds`, applies the dim `className` to each RF node wrapper (cache key now `data === n && className` match), and spreads `edgeAppearance(...)` onto every edge. Also removed the now-dead `dimensions`/`resizeTimers` resize-persistence code from `useCanvasGraph`. Integration test asserts off-path node DOM gets `opacity-40`, on-path does not; edge accent asserted against the derived `useCanvasGraph` edge objects (RF renders no `.react-flow__edge` DOM under this repo's jsdom setup). |
| 3.5 Viewport auto-centering on spawn / selection | ✅ | `src/lib/viewportCenter.ts` + `.test.ts` (new), `src/store/useTreeStore.ts`, `src/store/useTreeStore.test.ts`, `src/components/CanvasSelectionSync.tsx`, `src/components/CanvasSelectionSync.test.tsx` (new) | `viewportCenter.ts`: `centerTarget(node, currentZoom)` → box-centre `{x,y}` + `zoom = max(currentZoom, MIN_FOCUS_ZOOM=0.9)` (never zooms an already zoomed-in user back out); `FOCUS_DURATION=450`. Store gains `lastSpawnedNodeId: string | null`, set by `addNode` only in the real-existing-parent branch (`isChildSpawn`) after layout settles. `CanvasSelectionSync` rewritten to a single unified auto-center: Effect A (deps `selectedNodeId` + `focusNonce`) pans via `setCenter(..., {duration: FOCUS_DURATION})` and marks the node `selected` — canvas click, chat-pane click, keyboard `b` branch and `selectAndFocus` all converge here; Effect B routes `lastSpawnedNodeId` through `selectAndFocus`. `CanvasViewport` `b`-key branch needed no change. |

### Passing criteria (from `specs/phase-3.md`)
- ✅ Spawning sibling/child nodes auto-positions them with zero collisions or overlapping edges — deterministic d3-hierarchy layout recomputed on every `addNode`/`deleteNodeSubtree`; `autoLayout.test.ts` asserts zero bounding-box overlap + child-below-parent + determinism.
- ✅ Canvas cards no longer render full multi-paragraph scrollable text or heavy toolbar buttons — `TurnNode` is a fixed 240×72 pill; prompt composition lives in `ChatInputBar`, full text in `ReaderPanel` (double-click).
- ✅ The active path `root → selectedNode` is visually distinct from inactive branches — cyan animated accent edges on-path, dimmed edges + `opacity-40 saturate-50` nodes off-path (`pathHighlight.ts` + integration test).
- ✅ Clicking any station pill immediately centers it and updates the linear chat pane — `useOnSelectionChange` → `selectedNodeId` → `CanvasSelectionSync` Effect A pans (`setCenter`) at current zoom; the chat pane keys off `selectedNodeId` (Phase 2).
- ✅ `npm run typecheck` (`tsc -b`) passes; `npm test` passes.

### Full-suite results (after 3.5)
- ✅ `npm run typecheck` — `tsc -b` clean.
- ✅ `npm run lint` — oxlint clean (exit 0, no findings).
- ✅ `npm test` — 32 files / 253 tests passing (Phase 2 baseline 27/224).

### Deviations from spec
- Auto-layout uses `d3-hierarchy` (the spec's preferred engine); the pre-existing `@dagrejs/dagre` implementation was replaced. `@dagrejs/dagre` remains an unused entry in `package.json`.
- Node resizing (and its debounced persistence) was removed entirely as a consequence of fixed-size pills.
- Removed two `ContextMeter.test.tsx` "TurnNode integration" cases and one `renderBudget.test.tsx` case that asserted canvas-node UI the spec explicitly removes; the `ContextMeter` component and its own unit tests are untouched.
- `pathHighlight` edge-accent assertions run against the derived `useCanvasGraph` edge objects rather than DOM, because React Flow v12 renders no `.react-flow__edge` elements under this repo's jsdom test setup.

### Not committed
All Phase 3 changes are in the working tree only — no commits made per instructions.

---
