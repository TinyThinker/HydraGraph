# Backlog

## Performance

| # | Date | Status | Issue | Impact | Location |
|---|---|---|---|---|---|
| P1 | 2026-07-26 | ✅ Fixed 2026-07-26 | `applyNodeChanges` return value was discarded — nodes snapped back to stored position on every drag frame. Fixed with local `useState` for RF nodes synced via `useEffect`. | Drag was visually broken / clunky | `src/components/Canvas.tsx` |
| P2 | 2026-07-26 | ✅ Fixed 2026-07-26 | React Flow node positions driven directly from Zustand store — drag latency gated on 300ms debounce. Fixed as part of P1: local state updates immediately, store writes are debounced side effects. | Drag felt laggy | `src/components/Canvas.tsx` |
| P3 | 2026-07-26 | ✅ Fixed 2026-07-26 | `TurnNode` had no `React.memo` — every `appendTokenDelta` triggered full canvas re-render. Wrapped in `memo()`. | Streaming would cause severe frame drops | `src/components/TurnNode.tsx` |

## UX / Features

| # | Date | Status | Issue | Notes |
|---|---|---|---|---|
| U1 | 2026-07-26 | 🔲 Open | No settings panel — API key and default model cannot be configured from the UI | Blocking for first-time users |
| U2 | 2026-07-26 | 🔲 Open | No header toolbar — no tree title display, New Tree button, or settings gear | Canvas feels unanchored |
| U3 | 2026-07-26 | 🔲 Open | No way to delete a node | Accidental branches can't be cleaned up |
| U4 | 2026-07-26 | 🔲 Open | Node width is fixed at `w-80` — long responses cause vertical overflow with no resize handle | Poor readability for long answers |
