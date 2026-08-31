# Re-Engineering — Phase 3 Summary: The Render Path

**Phase:** 3 — The Render Path
**Date:** 2026-08-31
**Branch:** `re-engineer`
**Plan:** `docs/plans/re-engineer.md` (Phase 3, tasks T3.1–T3.8)

## Final `npm run check` result

`npm run check` chains `tsc -b && npm run lint && npm run test` and exits **0**:

```
> hydra-graph@0.0.0 test
> vitest run

 RUN  v4.1.11 /Users/osiris/dev/hydra-graph

 Test Files  6 passed (6)
      Tests  34 passed (34)
```

Lint clean (no warnings). 34 tests across 6 files (30 at end of Phase 2, +4 in Phase 3:
1 render-baseline measurement, 1 drag-proxy measurement, 2 render-budget regression locks).

Each task landed as its own commit, in order, `type(phase-3): …`, no trailers:

```
74002b3 feat(phase-3): add dev-only render-cost harness, seeder, and baseline
f96ef1a refactor(phase-3): replace whole-store subscriptions with narrow selectors
6c8b290 perf(phase-3): hold live streaming text in a separate map, off node identity
a3b7c3b perf(phase-3): cache RF node wrappers and derive edges from a structure key
31df220 fix(phase-3): merge store updates during drag instead of dropping them
1069acf fix(phase-3): flush and clear pending position timers on canvas unmount
42fe599 perf(phase-3): cap rendered response text in cards, keep stored text whole
1dff557 test(phase-3): lock the render budget and text cap against regressions
```

Every task was implemented by a builder sub-agent (haiku) from prose-only instructions,
then reviewed here: every changed file read, `npm run check` run, guardrails checked,
Verify performed as far as possible headlessly. Where a builder's output missed the mark,
the correction is recorded in that task's section and reflected in the grade.

---

## T3.1 — Build a render-cost harness

- **Done:** New `src/lib/renderTally.ts` — a dev-only per-node render counter:
  `enableRenderTally()` / `disableRenderTally()` / `resetRenderTally()` / `getRenderTally()`,
  a `bumpRenderTally(id)` and a `useRenderTally(id)` (plain function, no internal hooks) that
  `TurnNodeComponent` calls on every render, plus `seedFiftyNodes()` and
  `installRenderHarness()` which attaches `window.__hydraRenderTally` (enable/disable/reset/get)
  and `window.__hydraSeedFiftyNodes` — all gated by `import.meta.env.DEV`, so a production
  `vite build` tree-shakes the seeder and its text out (verified: the seed strings are absent
  from `dist/`). `src/App.tsx` calls `installRenderHarness()` from a `DEV`-guarded effect.
  `src/components/TurnNode.tsx` gains the one `useRenderTally(data.id)` call. `src/test/setup.ts`
  gains minimal jsdom polyfills (`ResizeObserver`, `matchMedia`, `requestAnimationFrame`,
  `cancelAnimationFrame`) so `@xyflow/react` mounts headlessly. New
  `src/lib/renderTally.measure.test.tsx` mounts the real `Canvas` with 4 nodes and streams 20
  token deltas into one, printing per-node render counts.
- **Files changed:** `src/lib/renderTally.ts` (new), `src/lib/renderTally.measure.test.tsx` (new),
  `src/components/TurnNode.tsx`, `src/App.tsx`, `src/test/setup.ts`, `docs/backlog.md`.
- **`npm run check`:** clean, 31 tests.
- **Verify (headless):** baseline recorded in `docs/backlog.md` → `## Phase 3 render baseline`.
  With one `act()` per token (a realistic stream): **streaming node 40 renders / 20 tokens;
  each of the other 3 nodes 20 renders** — every card repaints on every token, as the plan's
  Part 1.A predicts. FPS / smoothness at 50 nodes: **PENDING HUMAN**.
- **Grade: C+.** The harness API, the DEV gating, the `TurnNode` hook, the `App` wiring and the
  jsdom polyfills were all sound. But the two things that make the task useful were wrong on
  delivery and had to be fixed in review: (1) the builder's measurement wrapped all 20 token
  deltas in a single `act()`, so React batched them into one render and the recorded baseline
  was a meaningless "2 renders / 1 render" — corrected to one `act()` per token, giving the real
  40 / 20 baseline every later task is graded against; (2) `seedFiftyNodes()` read child counts
  off a stale local object that `addNode` never mutates, so all 50 nodes landed under the root
  at one identical coordinate — rewritten as a breadth-first bushy tree (~3 children per parent)
  with grid-spread positions.
- **Deviations:** `TurnNode.tsx` and `src/test/setup.ts` are outside the task's literal Files
  list ("one new utility file under `src/lib/`, `src/App.tsx`"). Both were pre-authorised in the
  builder brief and are unavoidable: per-node render measurement is impossible unless the card
  cooperates, and `@xyflow/react` will not mount under jsdom without the polyfills. The
  measurement test file is likewise required by the task's own Verify step.

## T3.2 — Replace whole-store subscriptions with selectors

- **Done:** `src/components/Canvas.tsx` — `const { nodes, updateNode } = useTreeStore()` became
  two narrow selectors (`s.nodes`, `s.updateNode`). `src/components/TurnNode.tsx` —
  `const { addNode, submitPrompt, cancelGeneration, settings } = useTreeStore()` became four
  per-value selectors (`s.addNode`, `s.submitPrompt`, `s.cancelGeneration`, `s.settings.defaultModel`),
  and the one `settings.defaultModel` read was repointed. One `useTreeStore((s) => …)` call per
  value; no object-literal selectors, no `useShallow`.
- **Files changed:** `src/components/Canvas.tsx`, `src/components/TurnNode.tsx`.
- **`npm run check`:** clean, 31 tests. `grep -rn "useTreeStore()" src/` → **no matches**; no
  component subscribes to the whole store without a selector.
- **Verify (headless):** measure test — the streaming node dropped 40 → **20**; the other three
  nodes dropped 20 each → **0** (they no longer appear in the tally at all).
- **Grade: A.** Exactly the specified change, nothing else touched, no state moved into
  component `useState`, the whole-store-subscription vector eliminated.
- **Deviations:** none.

## T3.3 — Decouple streaming text from node object identity

- **Done:** `src/store/useTreeStore.ts` — new `liveText: Map<string, string>` in `TreeStoreState`
  (init `new Map()`). `appendTokenDelta` no longer touches the `nodes` Map at all: for an existing
  id it returns `{ liveText: <new Map with id's entry = prev + chunk> }`; a ghost id is a no-op.
  `scheduleThrottledFlush`'s timer now reads `getState().liveText.get(id)` (skips the DB write if
  there is no in-flight text). The three terminal paths — `finalizeNode`, the `persistError`
  helper in `submitPrompt`, and `cancelGeneration` — each compute
  `text = liveText.get(id) ?? existing.assistantResponse`, write it into the node object and the
  DB **once**, and delete the id from a new `liveText` Map in the same `set(...)`. `submitPrompt`
  also drops any stale `liveText` entry at stream (re)start.
  `src/components/TurnNode.tsx` — new selector `s.liveText.get(data.id)`; the assistant block
  renders `responseText = liveText !== undefined ? liveText : data.assistantResponse`.
  `src/components/Canvas.tsx` — **no change needed** (it selects only `s.nodes` / `s.updateNode`,
  and `nodes` is now untouched during a stream). `src/store/useTreeStore.test.ts` — the new-contract
  assertions: test 3 rewritten ("appendTokenDelta writes live text without touching the node
  object" — node object reference and `assistantResponse` unchanged, `liveText.get(id)` holds the
  concatenation), test 4 also asserts `liveText.size === 0`, and the throttled-write / cancel tests
  read `liveText` during the streaming phase; `liveText: new Map()` added to every `beforeEach`.
- **Files changed:** `src/store/useTreeStore.ts`, `src/components/TurnNode.tsx`,
  `src/store/useTreeStore.test.ts`.
- **`npm run check`:** clean, 31 tests. Production build clean.
- **Verify (headless):** measure test — with one node streaming, every other node's render count
  is **0 for the whole stream**; appending a token returns only `{ liveText }`, so the `nodes`
  Map reference (and everything the canvas node array derives from) is unchanged.
- **Grade: A.** The crux task. Correct immutability throughout, the single-owner invariant holds
  (text lives in `liveText` while streaming with the node's `assistantResponse` at `''`; after any
  terminal path the node owns it and `liveText` has no entry — never both), incremental DB
  durability from T2.7 preserved by repointing the throttled writer, and the store tests were
  migrated rather than weakened.
- **Deviations:** `src/store/useTreeStore.test.ts` is outside the task's Files list; the new
  contract forces the assertion changes, this was pre-authorised in the brief and the changes are
  itemised above.

## T3.4 — Stabilise the derived node and edge arrays

- **Done:** `src/components/Canvas.tsx` — a `useRef<Map<string, Node<TurnNodeData>>>` wrapper
  cache: for each store node `n`, if the cached wrapper's `.data` is the same object reference as
  `n`, the exact cached wrapper is reused; otherwise a fresh wrapper is built and cached. Cache
  entries for ids no longer in `nodes` are pruned. A `structureKey` memo builds a sorted
  `id>parentId` string from the node collection; the `edges` memo is keyed on that string (not on
  `nodes`), so a position change never rebuilds edges, while add / remove / re-parent does.
  `src/lib/renderTally.measure.test.tsx` gains a second case — a headless drag proxy that mounts
  the canvas, resets the tally, then `updateNode(rootId, { positionX: 999 })` inside `act`.
- **Files changed:** `src/components/Canvas.tsx`, `src/lib/renderTally.measure.test.tsx`.
- **`npm run check`:** clean, 32 tests.
- **Verify (headless):** drag-proxy case — repositioning one node re-renders **only that node**
  (count 1); the other three stay at **0**. Real mouse-drag confirmation: **PENDING HUMAN**.
- **Grade: B+.** The architecture is right and the behaviour is proven headlessly. The builder's
  first pass shipped a lint **warning**: it used `useTreeStore.getState().nodes` inside the `edges`
  memo with a wrong-id `oxlint-disable` comment, so oxlint flagged `structureKey` as an unused
  dependency (Phases 1–2 held lint completely clean). Fixed in review by deriving the edges
  directly from the `structureKey` string (it already contains every `id>parentId` pair), which
  makes the dependency legitimate and the lint clean.
- **Deviations:** the measure-test file is outside the task's single-file Files list; adding the
  drag-proxy case there is the only headless way to run this task's Verify step and was authorised
  in the brief.

## T3.5 — Fix the drag-versus-store sync

- **Done:** `src/components/Canvas.tsx` — the non-reactive `isDragging` boolean ref became
  `draggingIdRef: useRef<string | null>`. A module-scope pure helper `mergeDragPosition(incoming,
  prev, dragId)` returns `incoming` unchanged when no drag is in progress, otherwise returns the
  incoming array with only the dragged node's `position` overridden from the previous local array
  (every other node keeps its incoming object reference, so the T3.4 cache stays effective). The
  store→local sync effect now **always** runs `setLocalNodes` through that helper instead of being
  skipped during a drag. `onNodeDragStart` records `node.id`; `onNodeDragStop` clears that node's
  debounce timer, writes the final position to the store immediately (no debounce on the last
  write), then clears `draggingIdRef` — so by the time the sync effect next runs the store already
  holds the final position and there is no snap. The 300 ms mid-drag debounce is unchanged.
- **Files changed:** `src/components/Canvas.tsx`.
- **`npm run check`:** clean, 32 tests. Both measure cases unchanged.
- **Verify (headless):** the always-sync merge means no store update can be dropped during a drag
  by construction; a streamed token lands in `liveText` (T3.3) which the card reads via its own
  selector, independent of `localNodes` / position, and the merge preserves the dragged node's
  fresh `data`. Drag-while-streaming with no snap on release: **PENDING HUMAN** (a real
  `@xyflow/react` pointer drag cannot be simulated in jsdom).
- **Grade: A-.** Correct approach, clean pure helper, updates preserved by design. The builder's
  first pass reached exactly 150 lines by deleting blank lines throughout the file; in review the
  T3.4 wrapper memo was compacted and readability whitespace restored.
- **Deviations:** none.

## T3.6 — Clean up canvas timers

- **Done:** `src/components/Canvas.tsx` — `debounceTimers` entries changed from a bare timeout
  handle to `{ timer, x, y }` (a new `TimerEntry` type), so the last target position for each
  pending write is known. `onNodesChange` records `{ timer, x, y }`; `onNodeDragStop` reads
  `existing.timer`. A new `useEffect` with an empty dependency array returns a cleanup that, on
  unmount, iterates the timers map, flushes each pending position via
  `useTreeStore.getState().updateNode(id, { positionX: x, positionY: y })`, `clearTimeout`s the
  handle, and clears the map. The 300 ms debounce is not lengthened.
- **Files changed:** `src/components/Canvas.tsx`.
- **`npm run check`:** clean, 32 tests.
- **Verify (headless):** by construction — after unmount no timer remains armed and the last
  dragged position is already persisted, so nothing can call into an unmounted component from this
  path. Drag-then-switch-tree within the 300 ms window: **PENDING HUMAN**.
- **Grade: A-.** Correct flush-then-clear. Same whitespace-squeeze-to-150 as T3.5, tidied in
  review; `Canvas.tsx` now sits at the 150-line ceiling and would benefit from having its
  graph-derivation logic pulled into a hook in a later pass (not a Phase 3 task).
- **Deviations:** none.

## T3.7 — Cap and virtualise long response text in cards

- **Done:** `src/components/TurnNode.tsx` — module constant `RENDERED_TEXT_CAP = 2000`. After
  `responseText` is computed: `isTruncated = responseText.length > RENDERED_TEXT_CAP` and
  `visibleText = isTruncated ? responseText.slice(-RENDERED_TEXT_CAP) : responseText` (the **tail**
  — the newest text, which is what the user watches while it streams). The assistant block renders
  `visibleText` (keeping the existing `max-h-48 overflow-y-auto` scroll box) and, when truncated, a
  muted `text-xs text-slate-500` notice ("Showing the last 2,000 characters of a longer response.")
  with a **disabled** `Open full text` button (`title="Full-text view arrives in a later update"`,
  `disabled:opacity-50 disabled:cursor-not-allowed`, `nodrag`). Phase 4 supplies the panel.
- **Files changed:** `src/components/TurnNode.tsx` (148 lines).
- **`npm run check`:** clean, 32 tests.
- **Verify (headless):** `renderBudget.test.tsx` Test B — a 40,000-character stored response
  renders a `<p>` whose `textContent.length` is **≤ 2000**, the store still holds all 40,000, and
  the truncation notice is in the document. Frame-rate under a 10k-token stream: **PENDING HUMAN**.
- **Grade: A.** Minimal, correct, only the rendered view is capped; stored text and everything
  written to the DB are untouched.
- **Deviations:** none.

## T3.8 — Lock in the render budget with a test

- **Done:** New `src/components/renderBudget.test.tsx`. **Test A** mounts the real `Canvas` with 3
  nodes (root + two children), enables and resets the tally after mount, streams 20 token deltas
  into one child, and asserts the root and the other child are at exactly their post-mount count
  (0 additional renders) — strict count equality — while the streaming child is `> 0` and within a
  sanity bound. **Test B** locks T3.7 (see above). `docs/backlog.md` → `## Phase 3 render baseline`
  gains a **Post-fix** table beside the pre-fix numbers.
- **Files changed:** `src/components/renderBudget.test.tsx` (new), `docs/backlog.md`.
- **`npm run check`:** clean, **34 tests**.
- **Verify (headless):** `npm test` passes. The regression proof was run twice — once by the
  builder, once independently here: reverting `TurnNode.tsx` to an unselected
  `const { … } = useTreeStore()` makes Test A fail with
  `AssertionError: expected 20 to be +0` and `Post-stream counts: { root: 20, childA: 20, childB: 20 }`;
  restoring the selectors makes it pass again.
- **Grade: A-.** A working, independently-verified regression lock plus a text-cap lock and a
  clean backlog table. Minor: Test B guards a `querySelectorAll` result with `toBeDefined()` (which
  passes for `null`); the truncation-notice `getByText` is a hard assertion so the test still
  fails correctly if the cap breaks, but the paragraph-length check could be skipped silently if
  the `<p>` were not found.
- **Deviations:** `docs/backlog.md` is outside the "one new test file" Files list; updating it with
  the post-fix numbers is required by the task's own step 2.

---

## Phase 3 Exit Criteria

**Plan exit criterion:** *with fifty nodes on the canvas and one node streaming, the other
forty-nine do not re-render, and the canvas holds a smooth frame rate.*

**Do the other nodes re-render? — No (headless evidence).**

| Scenario (headless) | Pre-fix | Post-fix |
|---|---|---|
| 20-token stream into one node — each *non-streaming* card | 20 renders | **0** additional renders |
| 20-token stream into one node — the *streaming* card | 40 renders | **20** (1 per token — required to show new text) |
| Reposition one node — every *other* card | 20 renders | **0** renders |

Sources: `docs/backlog.md` → *Phase 3 render baseline* (pre-fix vs post-fix table);
`src/lib/renderTally.measure.test.tsx` (4-node canvas, streaming + drag proxy);
`src/components/renderBudget.test.tsx` (3-node canvas, strict count equality, proven to fail if a
whole-store subscription returns).

**Why this generalises from 3–4 nodes to 50:** the fixes are all N-independent. Streamed tokens
land in `liveText`, which the canvas node array does not derive from (T3.3); the canvas and cards
subscribe only to the specific store slices they read (T3.2); each card's React Flow wrapper keeps
a stable reference while its own store object is unchanged (T3.4); edges are keyed on a
structure-only string (T3.4). Nothing in that chain scales with node count, so 49 of 50 idle cards
not re-rendering during a stream follows from the same mechanism the 2–3 idle cards demonstrate.

**What remains PENDING HUMAN:**

1. **50-node frame rate / smoothness.** The N-independence argument is not a frame-rate
   measurement. Needs a human with the dev build.
2. **Drag while streaming — no snap, text keeps flowing.** A real `@xyflow/react` pointer drag
   cannot be simulated in jsdom.
3. **Unmount race — drag then switch tree within the 300 ms debounce window.** The cleanup is
   correct by construction but the "no setState-on-unmounted warning" is a runtime observation.

`docs/current_state_and_next_steps.md` has been updated with a Phase 3 section describing what is
now genuinely working.

---

## Outstanding / handed to human

Every item needs a browser; several also need a configured provider (see the Phase 2 summary's
Outstanding list for provider setup). Exact steps:

1. **T3.1 / Exit criterion — 50-node frame rate.** `npm run dev`, load the app. In DevTools
   console: `window.__hydraSeedFiftyNodes()` (wait for `[seedFiftyNodes] Created 50 nodes`), then
   `window.__hydraRenderTally.enable()`, `window.__hydraRenderTally.reset()`. Send a prompt on one
   node so it streams. While it streams, `window.__hydraRenderTally.get()` — every id other than
   the streaming node must stay at 0. Pan/zoom and watch for jank; the canvas should hold a smooth
   frame rate throughout the stream.
2. **T3.4 — drag re-renders only the dragged card.** With the tally enabled and reset, drag one
   node across the canvas. `window.__hydraRenderTally.get()` afterwards — only the dragged node's
   count moved.
3. **T3.5 — drag a node while it streams.** Start a generation on a node. While tokens are
   arriving, drag that node around the canvas. The response text must keep growing throughout the
   drag, and on release the card must not jump to a different position.
4. **T3.6 — unmount race.** Drag a node and, within ~300 ms of releasing, do something that
   unmounts the canvas (once a tree switcher exists — Phase 5 — switch trees; until then, trigger
   an HMR reload of `Canvas.tsx`). Confirm the node's new position persisted (reload → it is where
   you left it) and the console shows no "setState on an unmounted component" warning.
5. **T3.7 — long-response cap.** Send a prompt that produces a very long answer (or let one run to
   ~10k tokens). The card shows a scroll box with a bounded amount of text and a
   "Showing the last 2,000 characters…" notice with a disabled "Open full text" button; the canvas
   stays smooth as the answer grows.
