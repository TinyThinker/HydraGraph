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
