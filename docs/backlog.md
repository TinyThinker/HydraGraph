# Backlog

## Performance

| # | Date | Issue | Impact | Location |
|---|---|---|---|---|
| P1 | 2026-07-26 | `applyNodeChanges` return value is discarded in `onNodesChange` — React Flow position changes are never applied back to local state, causing nodes to snap back to stored position on every drag frame | Drag is visually broken / clunky | `src/components/Canvas.tsx:61` |
| P2 | 2026-07-26 | React Flow node positions driven directly from Zustand store — drag latency is gated on the 300ms debounce write instead of being instant. Fix: maintain local `useState` for RF node positions, write to store only on drag stop | Drag feels laggy even after P1 fix | `src/components/Canvas.tsx` |
| P3 | 2026-07-26 | `TurnNode` subscribes to the full Zustand store via `useTreeStore()` with no `React.memo` — every `appendTokenDelta` call during streaming creates a new Map, triggering a full canvas re-render across all nodes | Streaming will cause severe frame drops | `src/components/TurnNode.tsx` |

## UX / Features

| # | Date | Issue | Notes |
|---|---|---|---|
| U1 | 2026-07-26 | No settings panel — API key and default model cannot be configured from the UI | Blocking for first-time users before Phase 3 goes live |
| U2 | 2026-07-26 | No header toolbar — no tree title display, New Tree button, or settings gear | Canvas feels unanchored |
| U3 | 2026-07-26 | No way to delete a node | Accidental branches can't be cleaned up |
| U4 | 2026-07-26 | Node width is fixed at `w-80` — long responses cause vertical overflow with no resize handle | Poor readability for long answers |
