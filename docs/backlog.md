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

## Phase 3 render baseline

**Date:** 2026-08-31

**Harness:** `src/lib/renderTally.ts` — a dev-only per-node render counter (`useRenderTally(id)` called from `TurnNodeComponent`), gated by `import.meta.env.DEV` + `window.__hydraRenderTally`. A 50-node bushy-tree seeder (`window.__hydraSeedFiftyNodes`) is provided for manual FPS testing. Headless measurement: `src/lib/renderTally.measure.test.tsx`.

**Scenario:** Mount the real `Canvas` in jsdom with 4 nodes (1 root + 3 leaf children, each card wrapped in `React.memo()`). After the initial mount settles, reset the tally, then append 20 token deltas to ONE leaf via `useTreeStore.getState().appendTokenDelta(...)`, **each in its own `act()`** so React commits once per token — the way a real network stream arrives.

**Pre-fix baseline (before T3.2–T3.7):**

| Node | Renders during 20-token stream |
|---|---|
| Streaming leaf | **40** (~2 per token) |
| Root (not streaming) | **20** (1 per token) |
| Leaf 2 (not streaming) | **20** (1 per token) |
| Leaf 3 (not streaming) | **20** (1 per token) |

**Reading:** Every card repaints on every token. `Canvas` subscribes to the whole store with no selector, so each `appendTokenDelta` rebuilds the React Flow node array — a new `data` object per node — defeating `React.memo()` on every card, plus `TurnNode` itself subscribes to the whole store. Phase 3 target: non-streaming nodes drop to **0** renders during a stream; the streaming node stays bounded and low.

*(T3.8 appends the post-fix numbers beside this table.)*
