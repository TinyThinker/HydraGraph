# Current State & Next Steps

> **Post-Phase-5 status — 2026-08-31 (branch `re-engineer`).**
> All five re-engineering phases are complete. `npm run check` passes with **180
> tests** (types + `oxlint` clean + vitest); `npm run build` is clean (~280 kB gzip
> JS). **DB schema is version 4.** Every structural defect in the Part 1 diagnosis
> below has an implemented fix with headless test coverage — see the per-phase
> update sections at the end of this file and the full rollup in
> `docs/re-engineer-final-report.md`.
>
> **What is genuinely working (headless-verified):** durable incremental streaming
> with zombie recovery, cancel, and surfaced errors; a render path that keeps
> streaming isolated to one card on a large graph (`renderBudget.test.tsx` lock);
> sanitized markdown/code rendering; resizable cards; the full-text reader panel;
> edit / regenerate / delete-subtree / collapse-expand; per-node system-prompt
> overrides and model selection; dagre auto-layout on branch + a manual "tidy"
> command; a multi-tree switcher (create / switch / rename / delete) with an honest
> `updatedAt`; active-tree search that pans/zooms and auto-expands; tree JSON
> export (no secrets) and validated all-or-nothing import; per-node context-size
> estimate + real token counts; per-tree canvas viewport persistence and keyboard
> navigation.
>
> **Still not done:** no end-to-end human run against a live Gemini/Ollama endpoint
> has occurred — every browser check (and all four schema migrations) is still on
> the PENDING HUMAN list in `docs/re-engineer-final-report.md` §6. The one real
> product gap (not a bug) is the **provider selector**: the Settings modal cannot
> choose a provider (it self-derives `gemini` if a key exists, else `ollama`) and
> OpenRouter has no client — the #1 recommended follow-up. Second follow-up: a
> tree-level `defaultSystemPrompt` editor. Third: split the JS bundle.
>
> The sections below are the **original Part 1 diagnosis**, kept as the historical
> record of why the re-engineering happened. Read them as "the starting point",
> not the current state.

This document describes the repository honestly, sorting every capability into one of three buckets derived from the diagnosis in `docs/plans/re-engineer.md`.

## A. Verified Working End to End

What a human has actually run start to finish and seen work:

- **Dexie/IndexedDB schema and data model** — the shape is correct and persists reliably
- **Ancestry-traversal logic** (`src/lib/contextEngine.ts`, `resolveContextPayload`) — correct root-to-leaf ordering, sibling isolation, cascading system-prompt override resolution
- **Production build** — `npm run build` compiles clean
- **Test runner and framework** — Vitest with jsdom and fake-indexeddb is now in place; pure-logic tests are being added for the context engine and store
- **Stack documentation** — corrected to the installed versions: React 19, Zustand 5, TypeScript 6, Vite 8

## B. Implemented But Never Exercised

Code exists and compiles, but no human has run the full path end to end. All of these are unreachable because there is no settings UI to enter an API key:

- **Gemini SSE streaming client** (`src/lib/streamingClient.ts`) — native fetch-based reader for Google Generative AI streaming protocol
- **Ollama SSE streaming client** (`src/lib/streamingClient.ts`) — native fetch-based reader for Ollama streaming
- **Token-delta streaming into node cards with optimistic store updates** — tokens accumulate in memory and render as they arrive
- **Branch creation and per-branch context isolation** — child sees only its ancestor chain, not siblings; the ancestry resolver is correct but was never exercised in a real session
- **Session restore on reload** — loads the previous active tree and its nodes from IndexedDB; currently works only by accident of load ordering, not by design
- **Node drag with local React Flow state and debounced position persistence** — drag feels local, but positions are debounced to the database
- **`memo()` on TurnNode** — present but completely ineffective (see Known Defects)

## C. Absent

Specified in `docs/architecture_design.md` but not implemented:

- **Settings UI and API-key entry** (backlog U1) — the blocker for end-to-end testing
- **Header bar** (backlog U2) — tree title, new-tree button, settings gear
- **Node edit, retry, regenerate, delete** (backlog U3)
- **Markdown and code-block rendering** — responses render as a single plain paragraph in a 320px card
- **Collapse/expand of subtrees** — `isCollapsed` field is written and read by nothing
- **System-prompt override editing UI** — amber badge renders; no UI can set the field
- **Auto-layout (dagre)** — children use a fixed offset and collide on any tree wider or deeper than a demo
- **Tree switcher, tree title, search, export, import**
- **Cancel/abort control for running generation** — abort function is discarded
- **Durable streaming state and zombie-node recovery** — see Known Defects
- **Stream-error surfacing** — errors go to console.error only
- **Per-node model selection actually influencing the request** — `modelUsed` displayed but never read
- **Explicit provider routing** — currently a coin flip (Gemini if a key exists, else Ollama)
- **OpenRouter client** — field exists in types/schema/defaults, no implementation

---

## Known Defects

**Whole-canvas re-render on every streamed token.** Canvas subscribes to the entire store with no selector. Every token delta re-renders the canvas, which recomputes the React Flow node array from the store map, allocating a new object for every node including the `data` prop. `memo()` compares by reference, so the new `data` reference defeats memoization. TurnNode also subscribes to the whole store, so it re-renders on every token regardless of props. Streaming one response repaints the entire graph at token frequency.

**Streaming state is not durable.** Tokens accumulate only in memory. The database is written once at `finalizeNode`, after the stream completes. Consequences: reload mid-stream and the partial response is gone while the node's stored row still says `status: 'streaming'` — rendering as a pulsing cyan card forever with no recovery. On stream error, the status is set in memory only; the row keeps `streaming` and the error text goes to `console.error` and is never shown.

**Stream parsing silently drops data at chunk boundaries.** Both Gemini and Ollama readers decode each network chunk in isolation and split on newlines with no buffer between reads. Any protocol frame that straddles two reads is malformed when parsed, and both parsers swallow parse failures in empty catch blocks. Tokens go missing mid-response with no error. Multi-byte characters split across a read boundary are corrupted — emoji, accented characters, and CJK text will mangle. Gemini extraction also reads only the first part of each chunk, so multi-part chunks lose content.

**API key is sent in URL query string.** The key lands in browser history and referrer logs. It should be in a request header.

**Ollama browser calls undocumented.** Browser requests fail until `OLLAMA_ORIGINS` is configured. This is not documented, so local-model support appears broken on first contact.

**Canvas position-debounce timers never cleared on unmount.** Timers continue firing after the component is gone.

**Store-to-canvas sync gated on non-reactive ref.** The effect uses a ref flag to drop store updates during a drag, rather than deferring them. Responses streaming into a node being dragged stop visibly updating.

**First-run boot race under React 19 StrictMode.** The bootstrap effect has an empty dependency array and no guard against re-entry. Both invocations can observe no active tree before either commits one, creating two trees and two root nodes on a fresh install.

**Node is a one-shot dead end.** TurnNode renders its input textarea only while `userPrompt` is empty. Once a prompt is submitted the input is gone. There is no edit, retry, regenerate, or delete — making a single bad API key permanently brick every node the user touched.

**Settings row fragile on first load.** `loadSettings` falls back to defaults in memory only and never writes them. `loadTree` persists the active tree with an update call, which silently does nothing if the row does not exist. The row only materializes as an incidental side effect of the first `createTree`. Session restore works today by accident of ordering.

---

## Next

See `docs/plans/re-engineer.md` for the active engineering plan, organized into five phases with concrete implementation tasks and verification steps.

---

## Phase 2 Update (2026-08-31) — "Make The Core Loop Actually Work"

Branch `re-engineer`, commits `bf4a37e`..`234afda`. Full detail and grades in
`docs/re-engineer-phase-2.md`. `npm run check` passes with 30 tests.

**Now implemented and unit-tested (store/parser level); end-to-end browser runs are
listed as PENDING HUMAN in the Phase 2 summary:**

- **Settings UI + header** — masked-key settings modal (Gemini / OpenRouter keys, Ollama
  URL, default model) and a header bar with the tree title and a settings gear; canvas
  fills the remaining height. Keys stay in the IndexedDB row and the request header only.
- **First-run banner** — persistent, dismiss-by-configuring, shown when no provider is set.
- **Durable streaming** — throttled (~2–3/s) incremental writes of in-progress response
  text; final synchronous flush on completion; partial text + terminal status written on
  error.
- **Stream errors surfaced** — `TurnNode.errorMessage` persisted and shown in a bounded
  red panel as plain text; cleared when a node regenerates.
- **Zombie recovery** — `loadTree` rewrites every stale `status: 'streaming'` row to
  `error` (partial text kept) in one transaction; no card can pulse forever after a load.
- **Cancel** — transient abort registry + `cancelGeneration` action + card Cancel button;
  node returns to `idle` with partial text kept.
- **Explicit provider routing** — `LLMProvider = 'gemini' | 'openrouter' | 'ollama'`;
  `streamLLMResponse` routes strictly on the chosen provider; per-node `modelUsed` is
  sent in the request. OpenRouter is an explicit unimplemented branch that errors
  clearly. (No provider-picker UI yet — set via DevTools until a later task.)
- **Stream parser correctness** — cross-read line buffering, streaming `TextDecoder`
  (multi-byte safe), all Gemini parts extracted, `thought` parts skipped, malformed
  frames reported instead of swallowed.
- **Secret hygiene** — Gemini key moved from the URL query string to `x-goog-api-key`.
- **DB schema** — now version 2; upgrade backfills `settings.provider`, `nodes.provider`,
  `nodes.errorMessage`.
- **README** — documents `OLLAMA_ORIGINS` setup for local models.

**Still absent (Phase 3+):** the render-path fix (whole-canvas re-render on every token),
markdown/code rendering, collapse/expand, system-prompt override editing, per-node model
picker UI, provider-picker UI, auto-layout, tree switcher / search / export / import,
node edit / retry / regenerate / delete, resizable cards.

---

## Phase 3 Update (2026-08-31) — "The Render Path"

Branch `re-engineer`, commits `74002b3`..`1dff557`. Full detail and grades in
`docs/re-engineer-phase-3.md`. `npm run check` passes with 34 tests.

**The "Whole-canvas re-render on every streamed token" defect above is fixed.** Headless
measurement (`src/lib/renderTally.measure.test.tsx`, `src/components/renderBudget.test.tsx`):
streaming 20 tokens into one node used to re-render every card 20 times and the streaming
card 40 times; it now re-renders **zero** other cards and the streaming card once per token.
Repositioning one node re-renders only that card.

- **Render-cost harness (dev-only)** — `src/lib/renderTally.ts`: per-node render counter on
  `window.__hydraRenderTally`, plus a 50-node bushy-tree seeder on
  `window.__hydraSeedFiftyNodes`. Both gated by `import.meta.env.DEV` (tree-shaken from prod).
- **Narrow store selectors** — no component subscribes to the whole store any more; `Canvas`
  and `TurnNode` select only the slices/actions they use.
- **Live streaming text off node identity** — a separate `liveText: Map<string,string>` in the
  store holds in-flight response text; `appendTokenDelta` writes only there, leaving the `nodes`
  map and every node object untouched during a stream. Terminal paths (finalize / cancel /
  error) write the final text into the node once and delete the `liveText` entry. The throttled
  incremental DB writer now reads from `liveText`, so T2.7 durability is preserved.
- **Stable derived arrays** — `Canvas` caches each React Flow node wrapper by id and reuses it
  while the node's store object is unchanged; edges are derived from a structure-only key, so a
  position change never rebuilds them.
- **Drag-vs-store sync** — the drag no longer drops store updates: every store change is
  accepted, only the dragged node keeps its local position, and the final position is written
  immediately on drag stop so there is no snap. A response streaming into a node keeps updating
  while that node is dragged.
- **Canvas timer cleanup** — pending position-write timers are flushed and cleared on unmount.
- **Bounded card text** — a card renders at most 2,000 characters (the tail) of a response,
  with a truncation notice and a disabled "Open full text" control; stored text is never
  truncated.
- **Regression lock** — `src/components/renderBudget.test.tsx` fails if an unselected
  whole-store subscription is reintroduced or if the text cap breaks.

**PENDING HUMAN (need a browser):** 50-node frame-rate/smoothness under a live stream;
drag-while-streaming with no snap on release; the drag-then-unmount race. Steps in
`docs/re-engineer-phase-3.md` → Outstanding.

**Still absent (Phase 4+):** markdown/code rendering, resizable cards, full-text reader panel,
node edit / retry / regenerate / delete, mark-descendants-stale, system-prompt override
editing, collapse/expand, per-node model picker UI, provider-picker UI, auto-layout, tree
switcher / search / export / import.

## Phase 4 Update (2026-08-31) — "The Research Surface"

All nine tasks (T4.1–T4.9) landed as individual commits; `npm run check` passes
(102 tests, lint clean); `npm run build` is clean. Full detail, grades and the
human-verification list are in `docs/re-engineer-phase-4.md`.

**Now working from the UI (implemented; end-to-end confirmation is PENDING HUMAN
per the phase-4 doc):**

- **Markdown + code rendering** — assistant responses render as sanitized Markdown
  (GFM tables, lists, headings, blockquotes, links opening in a new tab) with
  syntax-highlighted fenced code blocks and a per-block copy button. No raw HTML
  pass-through. `MarkdownContent.tsx` / `CodeBlock.tsx`.
- **Resizable cards** — `NodeResizer` on selected cards, min 280×200; width/height
  persist through a debounced path; the response region fills the card and scrolls
  internally. Schema `version(3)` backfills `width`/`height`.
- **Full-text reader panel** — a side panel outside the React Flow viewport
  (`App.tsx` layout, unaffected by zoom) showing the complete untruncated prompt +
  response via the markdown renderer; opened by double-clicking a card or the
  now-enabled "Open full text" control; copy + Escape/close; follows live text.
  Dedicated `useReaderPanel` store.
- **Edit prompt / regenerate** — idle or errored nodes expose an inline Edit
  textarea and a Regenerate button; both re-run through `submitPrompt` (which
  clears the old response + error and re-enters streaming); descendants are left
  in place. `submitPrompt` no-ops while already streaming.
- **Delete node + subtree** — `collectSubtreeIds` + `deleteNodeSubtree`: one
  transaction removes the whole subtree and fixes the parent's `childrenIds`; the
  card's Trash control shows a confirmation naming the node count; the tree root's
  control is disabled.
- **Stale descendants** — `stale?: boolean` on the node type (backfilled `false`
  in the same `version(3)` upgrade). Editing/regenerating a node — or changing its
  system-prompt override — flags every descendant `stale: true` via
  `markDescendantsStale`; stale cards render muted with an amber badge. No
  auto-regeneration.
- **System-prompt override editor** — per-node overlay showing the inherited
  prompt (resolved at the parent / tree default) read-only above the input;
  Save/Clear; the amber Shield badge reflects the state; descendants marked stale
  on change; existing answers are not re-run.
- **Collapse / expand subtrees** — `toggleCollapse` + `computeHiddenIds`
  (`src/lib/collapse.ts`); the canvas excludes hidden nodes and their edges;
  collapsed cards show "Show N hidden" (all depths); inner collapsed state
  survives an outer expand; a hidden node still streams to completion.
- **Per-node model picker** — the footer model badge opens a picker (curated
  per-provider list + global default + current value + free-text); the choice
  persists to `node.modelUsed` and is what the next request actually calls
  (per-node routing from T2.6); disabled while streaming.

**Still forces DevTools / absent (Phase 5):** the **provider selector** — the
Settings modal still has no provider dropdown, so choosing Ollama while a Gemini
key is set, or choosing OpenRouter (which also has no client), requires editing
the `settings` row in IndexedDB. Tree-level `defaultSystemPrompt` has no editor.
Auto-layout, tree switcher / rename / delete, search, and export/import are
Phase 5.

**Final DB schema:** `version(3)` — its upgrade backfills `width` (320),
`height` (240) and `stale` (false) on existing node rows.


---

## Phase 5 Update (2026-08-31) — "Workspace & Scale"

Branch `re-engineer`, commits `d8d0a4a`..`9fd610d` (9 task commits + the summary).
Full detail, grades and the human-verification list are in
`docs/re-engineer-phase-5.md`; the whole-effort rollup is in
`docs/re-engineer-final-report.md`. `npm run check` passes with **180 tests**;
`npm run build` clean (~280 kB gzip JS, +21 kB over the phase, ~16 kB of it dagre).

**Now implemented (end-to-end browser confirmation is PENDING HUMAN per the phase-5 doc):**

- **Auto-layout on branch (T5.1)** — `@dagrejs/dagre` + `src/lib/autoLayout.ts`
  (`layoutTree`, `computeChildPosition`). New children are positioned top-down with
  card-size-aware spacing, anchored to the parent's real on-canvas position; existing
  nodes are never moved; layout runs only on node creation.
- **Manual re-layout (T5.2)** — header `LayoutGrid` button → inline confirmation →
  `relayoutActiveTree` rebuilds every position in one transaction and re-fits the
  viewport via the new `CanvasFitter`. Never on load; never bumps `updatedAt`.
- **Tree switcher (T5.3)** — `TreeSwitcher` / `TreeSwitcherRow` dropdown in the header:
  list most-recent-first, select (`loadTree`), "New tree" (prompt), per-row rename and
  delete. New store actions `renameTree` and `deleteTree` (cascade-deletes the tree's
  nodes in one transaction; activates the next tree when the active one is deleted;
  re-creates a fresh tree when the last one is deleted).
- **Honest `updatedAt` (T5.4)** — an internal `touchActiveTree` bumps the active tree's
  timestamp (DB **and** in-memory `trees`) on add-node / edit-prompt / finish-generation
  / delete-node / override change, and on nothing else (not position, size, model,
  token deltas, re-layout, rename or collapse).
- **Search (T5.5)** — `SearchBar` in the header filters the active tree's prompts +
  responses; selecting a result auto-expands collapsed ancestors and the new
  `CanvasSearchFocus` pans/zooms to the node and flashes it. Only the loaded tree is
  searched.
- **Export (T5.6)** — `src/lib/treeExport.ts`: one tree + all nodes → versioned JSON,
  **no secrets** (recursive key-scan + planted-secret tests). Header `Download` button.
- **Import (T5.7)** — `parseImportDoc` validates schema + full structural integrity
  before any write; `remapImportedTree` assigns fresh ids throughout; the `importTree`
  store action writes all-or-nothing in one transaction then loads the tree. Header
  `ImportButton` with an inline error panel. Same file imported twice → two independent
  trees.
- **Context size awareness (T5.8)** — `src/lib/contextEstimate.ts` +
  `ContextMeter`: a ~4-chars/token estimate of the resolved payload shown above the
  send control and in the reader panel, replaced by the real input/output token counts
  once a generation finishes, with a non-blocking amber warning past ~6000 tokens.
- **Viewport persistence + keyboard nav (T5.9)** — schema **version(4)** adds
  `viewportX/Y/Zoom` to `trees` (backfilled 0/0/1). `CanvasViewport` restores the saved
  per-tree pan/zoom on load (fitView only when there is none) and debounce-persists it;
  `↑`/`↓`/`←`/`→` move the selection through parent/child/siblings with the viewport
  following, `b` branches, `r` opens the reader — all ignored while a text field is
  focused. Shortcuts documented in the README.

**Still absent / carried forward:** the **provider-selector control** in Settings
(provider self-derives; OpenRouter has no client) — #1 follow-up; a tree-level
`defaultSystemPrompt` editor; JS bundle-splitting; a CI gate; live-browser
verification of everything (see `docs/re-engineer-final-report.md` §6).

**Final DB schema:** `version(4)` — its upgrade backfills `viewportX` (0),
`viewportY` (0) and `viewportZoom` (1) on existing tree rows. History: v2 backfilled
`nodes.provider` / `nodes.errorMessage` / `settings.provider`; v3 backfilled
`nodes.width` (320) / `nodes.height` (240) / `nodes.stale` (false).

