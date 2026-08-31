# Re-Engineering — Phase 5 Summary: Workspace & Scale

**Phase:** 5 — Workspace & Scale
**Date:** 2026-08-31
**Branch:** `re-engineer`
**Plan:** `docs/plans/re-engineer.md` (Phase 5, tasks T5.1–T5.9)

## Final `npm run check` result

`npm run check` chains `tsc -b && npm run lint && npm run test` and exits **0**:

```
> hydra-graph@0.0.0 lint
> oxlint
  (zero warnings)

> hydra-graph@0.0.0 test
> vitest run

 Test Files  21 passed (21)
      Tests  180 passed (180)
```

Test count entering Phase 5: 102. Leaving Phase 5: **180** (+78).

## `npm run build` sizes

```
dist/assets/index-*.css   39.93 kB │ gzip:   8.04 kB
dist/assets/index-*.js   895.68 kB │ gzip: 279.73 kB
```

Pre-Phase-5 baseline (measured at the start of T5.1): JS 829.22 kB / gzip **258.72 kB**.
Net Phase 5 delta: **+21.0 kB gzip** — of which `@dagrejs/dagre` (T5.1) is ~+16 kB;
T5.2–T5.9 together add ~+5 kB. Still one chunk over Vite's 500 kB raw warning; no
code-splitting was introduced (out of scope).

## Final DB schema version

**Version 4.** The `version(4)` `.upgrade` step backfills, on every existing `trees`
row that lacks them:

| Field | Backfill value | Added by |
|---|---|---|
| `viewportX` | `0` | T5.9 |
| `viewportY` | `0` | T5.9 |
| `viewportZoom` | `1` | T5.9 |

Indexes are unchanged from version(3) (`nodes: 'id, treeId, parentId, timestamp'`,
`trees: 'id, createdAt, updatedAt'`, `settings: 'id'`). The three new
`ConversationTree` fields are declared **optional** so `createTree`, the importer and
the exporter type-check without change; the upgrade backfills old rows and
`CanvasViewport` writes them going forward. No other Phase 5 task touched the schema.

---

## T5.1 — Auto-layout on branch creation

- **Commit:** `d8d0a4a` `feat(phase-5): auto-layout new branches with dagre`
- **What was done:** Added `@dagrejs/dagre` (maintained scoped fork, ships its own
  types). New `src/lib/autoLayout.ts` with two pure functions:
  - `layoutTree(nodes)` → `Map<id, {x, y}>` — a full top-down (`rankdir: 'TB'`) dagre
    layout for every node, `nodesep: 64`, `ranksep: 90`, per-node width/height taken
    from `node.width ?? 320` / `node.height ?? 240`, dagre centre coordinates converted
    to React-Flow top-left.
  - `computeChildPosition(parentId, nodes)` — runs the same layout with one synthetic
    `'__new__'` child added under `parentId`, then **anchors** the result to the
    parent's real on-canvas position: `child.real = parent.real + (child.dagre −
    parent.dagre)`. Guards a missing parent → `{x: 0, y: 0}`.
  - Store `addNode` now positions every child through `computeChildPosition` before
    persisting; existing nodes are never moved; layout runs only on node creation.
- **Files changed:** `package.json` (+`package-lock.json`), `src/lib/autoLayout.ts`
  (new), `src/lib/autoLayout.test.ts` (new, 5 tests), `src/store/useTreeStore.ts`.
- **Gate results:** `npm run check` clean, 107 tests. `npm run build` clean —
  JS gzip 258.72 → **274.74 kB** (+16.0, dagre).
- **Verify:** Headless — `autoLayout.test.ts` asserts a 4-node tree lays out with
  zero pairwise box overlaps, children strictly below parents, `computeChildPosition`
  places a third child below the parent, and a missing parent returns `{0,0}` without
  throwing. **PENDING HUMAN:** build a tree 3 levels deep with 3 children at each of
  two parents and confirm visually that no cards overlap (plan Verify).
- **Grade: A−.** Correct, pure, immutable, layout-on-creation only, tests solid.
  The builder originally returned dagre-space absolute coordinates, which would drop a
  new child far from a parent the user had dragged; the dispatcher anchored the result
  to the parent's real position during review (noted in the commit body).
- **Deviations:** `NodeFooter.handleBranch` still computes its old fixed offset and
  passes it in — `addNode` now overrides it, so the value is dead but harmless.
  Not cleaned up (NodeFooter is outside the task's Files list).

## T5.2 — Manual re-layout command

- **Commit:** `69182bb` `feat(phase-5): manual re-layout command in the header`
- **What was done:** New store action `relayoutActiveTree` — runs `layoutTree` over the
  whole active tree, persists every position in ONE `db.transaction('rw', [db.nodes])`,
  updates the node map immutably, and bumps a new `fitViewNonce` state field. It never
  writes `db.trees` / `updatedAt` (positions are not content). HeaderBar gains a
  `LayoutGrid` button that opens an inline confirmation ("Re-running auto-layout will
  discard your manual node positions." + Re-layout / Cancel). New `CanvasFitter`
  component, rendered as a child of `<ReactFlow>`, watches `fitViewNonce` and calls
  `fitView({ duration: 400 })` so the viewport re-fits after a re-layout. Not automatic
  on load.
- **Files changed:** `src/store/useTreeStore.ts`, `src/store/useTreeStore.test.ts`
  (+4 tests), `src/components/HeaderBar.tsx`. **Beyond the plan's Files list:**
  `src/components/Canvas.tsx` gains one `<CanvasFitter/>` child and
  `src/components/CanvasFitter.tsx` is new — required for the "fit the viewport" step
  and pre-authorised by global rule 4.
- **Gate results:** `npm run check` clean, 111 tests.
- **Verify:** Headless — store tests assert all node positions after the action equal
  `layoutTree`'s output in both memory and DB, `fitViewNonce` increments by 1,
  `updatedAt` is unchanged, and `activeTreeId === null` / empty map are no-ops.
  **PENDING HUMAN:** drag several nodes into a mess → click the header LayoutGrid
  button → confirm → the tree is tidy, the viewport re-fits, and positions survive a
  reload (plan Verify).
- **Grade: A−.** Correct, single-transaction, immutable, does not touch `updatedAt`,
  and the fit-viewport wiring reuses the established `CanvasFitter` pattern.

## T5.3 — Tree switcher

- **Commit:** `7dbfd47` `feat(phase-5): multi-tree switcher with create/rename/delete`
- **What was done:** New `TreeSwitcher` dropdown (split into `TreeSwitcher.tsx` +
  `TreeSwitcherRow.tsx`, both < 150 lines) replaces the static title in the header.
  Lists every tree most-recent-first (`updatedAt` desc) with a short relative
  "last updated" label; selecting one calls the existing `loadTree` (activate +
  persist `settings.activeTreeId`). "New tree" prompts for a title and calls
  `createTree`. Per-row **rename** (`window.prompt`) and **delete** (inline red
  confirmation). New store actions:
  - `renameTree(id, title)` — trims, writes `db.trees.update` + immutable in-memory
    update, no `updatedAt` bump.
  - `deleteTree(id)` — queries the tree's node ids from the DB, deletes all nodes +
    the tree row in ONE `db.transaction('rw', [db.nodes, db.trees])`, removes the tree
    from memory. If it was the last tree it immediately `createTree('New Research')`;
    if it was the active tree and others remain it activates the most-recent remaining
    one via `loadTree`.
- **Files changed:** `src/components/HeaderBar.tsx`, `src/components/TreeSwitcher.tsx`
  (new), `src/components/TreeSwitcherRow.tsx` (new). **Beyond the plan's Files list:**
  `src/store/useTreeStore.ts` + `src/store/useTreeStore.test.ts` (+5 tests) — the
  cascade delete must live in the store; the plan's Files field named only the
  component + header.
- **Gate results:** `npm run check` clean, 116 tests. HeaderBar 82 lines.
- **Verify:** Headless — store tests cover rename (memory+DB, no `updatedAt`),
  whitespace-only rename no-op, delete of a non-active tree (row + all its nodes gone,
  active unchanged), delete of the active tree (switches to the other tree, its root
  loads), and delete of the last tree (a fresh replacement tree + root is created and
  activated). **PENDING HUMAN:** create three trees with distinct content, switch
  among them, reload, and confirm the last active one is restored with correct content
  (plan Verify); confirm the dropdown's outside-click close.
- **Grade: A−.** Immutable, single-transaction cascade, the last-tree guard is
  handled inside `deleteTree`, components split under 150 lines.

## T5.4 — Keep the tree's updated timestamp honest

- **Commit:** `6355426` `feat(phase-5): advance tree updatedAt only on real content changes`
- **What was done:** A single internal `touchActiveTree` helper (private to the store
  factory) bumps the active tree's `updatedAt` in BOTH the DB row and the in-memory
  `trees` array, so the header switcher reorders live. Wired into `addNode`,
  `submitPrompt` (covers "editing a prompt" + generation start), `finalizeNode` and
  `deleteNodeSubtree` (the last two previously bumped only the DB row), and into
  `updateNode` **only when the patch carries `systemPromptOverride`**. Position, size,
  per-node model, token deltas, `relayoutActiveTree`, `renameTree` and `toggleCollapse`
  no longer move the timestamp.
- **Files changed:** `src/store/useTreeStore.ts` (factory reshaped from
  `(set, get) => ({...})` to `(set, get) => { const touchActiveTree = ...; return {...} }`),
  `src/store/useTreeStore.test.ts` (+7 tests).
- **Gate results:** `npm run check` clean, 123 tests. One stray-indented line left by
  the builder's re-indent was fixed by the dispatcher during review.
- **Verify:** Headless — tests assert `addNode` advances `updatedAt` in DB+memory;
  `updateNode` with `{positionX/Y}`, `{width/height}`, `{modelUsed}` does NOT;
  `updateNode` with `{systemPromptOverride}` does; `appendTokenDelta` does not; and a
  content change on a re-activated older tree lifts it above a newer one in memory.
  **PENDING HUMAN:** edit an older tree in the real UI and confirm it jumps to the top
  of the switcher list (plan Verify).
- **Grade: A−.** Correct, DRY, targeted; both DB and memory updated so ordering is
  live.

## T5.5 — Search across the active tree

- **Commit:** `8ed5878` `feat(phase-5): search the active tree from the header`
- **What was done:** New `SearchBar` in the header centre. Filters the active tree's
  in-memory nodes by case-insensitive substring over `userPrompt` + `assistantResponse`
  (min 2 chars), showing each hit's prompt label (60-char cap) and an in-context
  snippet (±40 chars, whitespace collapsed, ellipses), capped at 50 results, with a
  "No matches in this tree." empty state. Selecting a result:
  1. walks the ancestor chain and `toggleCollapse`s every collapsed ancestor (auto-expand);
  2. bumps a `useSearchNav` nonce (a tiny standalone store, mirrors `useReaderPanel`).
  New `CanvasSearchFocus` (child of `<ReactFlow>`, next to `CanvasFitter`) reacts to
  the nonce: `setCenter` to the node at zoom 1.2 over 500 ms, and flashes it via React
  Flow selection for ~1.6 s. Only the active (loaded) tree is searched.
- **Files changed:** `src/components/SearchBar.tsx` (new, 126 lines),
  `src/components/CanvasSearchFocus.tsx` (new), `src/components/useSearchNav.ts` (new),
  `src/components/SearchBar.test.tsx` (new, 5 tests), `src/components/HeaderBar.tsx`
  (+`<SearchBar/>`), `src/components/Canvas.tsx` (+`<CanvasSearchFocus/>`).
- **Gate results:** `npm run check` clean, 128 tests. `renderBudget.test.tsx` still
  green. HeaderBar 89 lines.
- **Verify:** Headless — tests: a term in one node's response yields one result with
  prompt label + snippet; a term in no node shows the empty state; a node with a
  different `treeId` is never matched; a <2-char query yields nothing; selecting a
  result under a collapsed ancestor auto-expands the ancestor
  (`isCollapsed === false`) and sets `useSearchNav.targetId` + increments the nonce.
  **PENDING HUMAN:** seed a 200-node tree (dev seeder), search a term present in one
  deep node, and confirm the canvas pans/zooms to it and it visibly highlights; confirm
  the highlight reads clearly (it is currently a React-Flow selection outline, not a
  bespoke ring).
- **Grade: A−.** Meets every requirement; the "brief highlight" is a selection
  outline rather than a custom ring because `TurnNode` was outside the Files list —
  a reasonable trade, flagged for visual sign-off.

## T5.6 — Export a tree

- **Commit:** `d2e8568` `feat(phase-5): export a tree to JSON`
- **What was done:** New `src/lib/treeExport.ts`:
  - `TREE_EXPORT_SCHEMA_VERSION = 1` (document schema, distinct from the Dexie DB
    version).
  - `buildExportDoc(tree, nodes)` → `{ schemaVersion, exportedAt, tree, nodes }` and
    nothing else — no settings, no API keys, no `liveText` / abort state. Tree and
    nodes are shallow-cloned (`childrenIds` copied).
  - `serializeExportDoc` (pretty JSON), `exportFilename` (title slug + `YYYY-MM-DD`,
    falls back to `tree` for an empty title), `downloadTreeExport` (blob + anchor).
  HeaderBar gains a `Download` button that exports the active tree from the in-memory
  node map.
- **Files changed:** `src/lib/treeExport.ts` (new), `src/lib/treeExport.test.ts`
  (new, 6 tests), `src/components/HeaderBar.tsx` (100 lines).
- **Gate results:** `npm run check` clean, 146 tests.
- **Verify:** Headless — tests assert the doc has exactly the four expected keys;
  mutating the returned doc does not affect the source (including `childrenIds`);
  a recursive key-scan of the serialized JSON finds none of `settings`,
  `geminiApiKey`, `openRouterApiKey`, `ollamaBaseUrl`, `apiKey`, `liveText`, and a
  planted `AIzaSy-…` secret string never appears; `exportFilename` slug/date cases;
  JSON round-trips. **PENDING HUMAN:** export a real tree, open the file, confirm the
  node count matches and search the file for your real API key to confirm it is absent
  (plan Verify).
- **Grade: A.** Clean, pure, thoroughly tested; the secret-exclusion requirement is
  verified two independent ways.

## T5.7 — Import a tree

- **Commit:** `d98228b` `feat(phase-5): import a tree from JSON`
- **What was done:** `src/lib/treeExport.ts` gains:
  - `parseImportDoc(text)` — rejects, BEFORE any write, with a clear message: invalid
    JSON, an unrecognised `schemaVersion`, a missing/invalid tree record, zero nodes,
    duplicate node ids, a wrong root count (`!== 1`), a root id that disagrees with
    `tree.rootNodeId`, a dangling `parentId`, a `childrenIds` entry pointing at a
    missing node, a child whose `parentId` doesn't point back, and a non-root node not
    listed in its parent's `childrenIds`.
  - `remapImportedTree(doc, makeId?)` — assigns a fresh UUID to the tree and every
    node, remaps all `parentId` / `childrenIds` references consistently, and normalises
    a serialized `status: 'streaming'` to `'idle'`.
  New store action `importTree(text)` — validates, remaps, writes the tree + all nodes
  in ONE `db.transaction('rw', [db.trees, db.nodes])` (a throw rolls everything back),
  pushes the tree into memory, then `loadTree`s it. Returns
  `{ ok, error?, treeId? }`. New `ImportButton` component (hidden file input + inline
  red error panel with a dismiss X) sits between Export and Settings in the header.
- **Files changed:** `src/lib/treeExport.ts`, `src/lib/treeExport.test.ts`
  (+10 tests), `src/components/ImportButton.tsx` (new, 67 lines),
  `src/components/HeaderBar.tsx` (102 lines). **Beyond the plan's Files list:**
  `src/store/useTreeStore.ts` + `src/store/useTreeStore.test.ts` (+3 tests) — the
  one-transaction write must live in the store.
- **Gate results:** `npm run check` clean, 159 tests.
- **Verify:** Headless — lib tests cover the happy path plus every rejection branch
  above; `remapImportedTree` produces disjoint id sets across two runs and preserves
  structure; store tests confirm a valid import adds the tree + all node rows and
  activates it, an invalid import writes nothing (DB row counts unchanged) and returns
  an error, and importing the same text twice yields two trees with disjoint node id
  sets. **PENDING HUMAN:** export a 3-level tree, clear all site data, import the file,
  and confirm structure/text/positions/overrides match; then import the same file
  twice into one profile and confirm two independent trees (plan Verify).
- **Grade: A−.** All-or-nothing, fresh ids, two-way structural validation, streaming
  normalisation. Minor: `parseImportDoc` uses `Array.find` inside loops (O(n²)) —
  irrelevant at realistic tree sizes; `errorMessage` is forced to `''` on every
  imported node.

## T5.8 — Context size awareness

- **Commit:** `52113ca` `feat(phase-5): context size awareness on cards and in the reader`
- **What was done:** New `src/lib/contextEstimate.ts`:
  - `estimateContextTokens(nodeId, nodes)` — runs `resolveContextPayload` (system
    prompt + every ancestor message, the target's own response already excluded) and
    returns `round(totalChars / 4)`.
  - `CONTEXT_WARN_TOKENS = 6000` — the tunable warning threshold.
  New `ContextMeter` component, rendered in `TurnNode` immediately above
  `PromptSection`: while a node has real `inputTokens` / `outputTokens` it shows
  "context sent: N in · M out tokens"; otherwise it shows "~N tokens of context";
  when the estimate exceeds the threshold it adds a non-blocking amber warning
  ("Deep context — this chain is approaching typical model limits."). Hidden while any
  stream is running. `ReaderPanel` shows the same estimate, the last-generation
  counts and the warning near the top. Generation is never blocked.
- **Files changed:** `src/lib/contextEstimate.ts` (new), `src/components/ContextMeter.tsx`
  (new), `src/components/ContextMeter.test.tsx` (new, 9 tests),
  `src/components/TurnNode.tsx` (101 lines), `src/components/ReaderPanel.tsx`.
  **Beyond the plan's Files list:** the shared helper lives in a new lib module rather
  than the component, so oxlint's `only-export-components` rule stays warning-free
  (the dispatcher moved it there during review).
- **Gate results:** `npm run check` clean, **zero lint warnings**, 168 tests.
  `renderBudget.test.tsx` still green. `npm run build` clean.
- **Verify:** Headless — tests: the estimate is small for a lone node, grows with
  depth, and excludes the target's own response; `ContextMeter` shows the estimate,
  shows the warning past the threshold, prefers real counts when present, and renders
  nothing for `tokens={null}`; a `TurnNode` whose ancestry exceeds the threshold
  renders the warning AND still shows its send/regenerate control; a node with stored
  `inputTokens`/`outputTokens` renders them. **PENDING HUMAN:** build a ~10-deep chain
  with long responses and confirm the estimate grows with depth and the warning
  appears past the threshold (plan Verify).
- **Grade: B+.** All required behaviour present and tested. Deductions: the builder
  co-located the shared helper with a component (lint warning; fixed on review) and
  left a misplaced eslint-disable comment (removed); the `TurnNode` estimate selector
  runs an ancestry walk per store-change per card unguarded — a guard was tried and
  reverted because it re-renders siblings when a stream starts, tripping the
  render-budget lock. The walk is cheap (pointer walk + length sums, no allocation)
  so it was accepted.

## T5.9 — Canvas viewport persistence and keyboard navigation

- **Commit:** `9fd610d` `feat(phase-5): persist canvas viewport per tree, add keyboard navigation`
- **What was done:**
  - **Schema `version(4)`** — indexes unchanged; `.upgrade` backfills `viewportX: 0`,
    `viewportY: 0`, `viewportZoom: 1` on existing `trees` rows (only the missing
    fields). `ConversationTree` gains `viewportX?/viewportY?/viewportZoom?` — optional
    so `createTree`, the importer and exporter type-check unchanged.
  - New `CanvasViewport` component (child of `<ReactFlow>`, alongside `CanvasFitter` /
    `CanvasSearchFocus`, 141 lines): (A) on `activeTreeId` change reads the tree row
    and `setViewport` to the saved pan/zoom, falling back to `fitView` only when there
    is none; (B) subscribes to React Flow's `transform` and writes pan/zoom back to
    the tree row on a 400 ms debounce; (C) a `window` keydown listener — `↑` parent,
    `↓` first child, `←`/`→` previous/next sibling (viewport re-centres on the target
    at the current zoom), `b` branch from the selection, `r` open the reader panel;
    every branch bails via `isTypingTarget` when focus is in an input/textarea/select/
    contentEditable, and bails on any meta/ctrl/alt modifier. Selection is tracked
    with `useOnSelectionChange` into a ref.
  - `Canvas.tsx` drops the hardcoded `fitView` prop (CanvasViewport decides) and adds
    `disableKeyboardA11y` so React Flow's own arrow handling doesn't fight ours.
  - New pure `src/lib/treeNav.ts` — `resolveNavTarget(currentId, dir, nodes)` and
    `isTypingTarget(target)`.
  - `README.md` documents every shortcut and the per-tree viewport behaviour.
- **Files changed:** `src/types/index.ts`, `src/db/ChatDatabase.ts`,
  `src/components/Canvas.tsx`. **Beyond the plan's 3-file list (pre-authorised):**
  `src/components/CanvasViewport.tsx` (new), `src/lib/treeNav.ts` (new),
  `src/lib/treeNav.test.ts` (new, 7 tests), `README.md`.
- **Gate results:** `npm run check` clean, zero lint warnings, **180 tests**.
  `renderBudget.test.tsx` still green. `npm run build` clean —
  CSS gzip 8.04 kB, JS gzip **279.73 kB**.
- **Verify:** Headless — `treeNav.test.ts` covers parent/child/prev/next resolution,
  clamping at sibling-list ends, root-has-no-siblings, missing/null ids, and
  `isTypingTarget` for textarea/input/div/null. **PENDING HUMAN:** (1) pan to a deep
  corner, reload, confirm the same view is restored (not a fit-to-graph); (2) switch
  trees and back, confirm each tree keeps its own last view; (3) navigate a 3-level
  tree using only `↑ ↓ ← →` with the viewport following; (4) press `b` on a selection
  and confirm a child appears (auto-laid-out); press `r` and confirm the reader panel
  opens; (5) confirm none of the shortcuts fire while typing in the prompt textarea or
  the search box; (6) **schema migration v3 → v4** — on a build from before commit
  `9fd610d` create a tree, then check out this HEAD and load: DevTools → IndexedDB →
  `HydraGraphDB` is at version **4** and every `trees` row has
  `viewportX: 0, viewportY: 0, viewportZoom: 1`; no data lost.
- **Grade: A−.** Clean schema bump matching the v3 style, the optional-field approach
  keeps the task inside its intended blast radius, keyboard nav is complete and the
  pure helper is well tested. Minor: a small race on the persist effect during a tree
  switch — if `db.trees.get` for the incoming tree resolves slowly while `transform`
  changes, the outgoing tree's viewport could be written onto the incoming row; the
  window is a few ms and self-corrects on the next pan. `contentEditable === 'true'`
  is a hair less robust than `isContentEditable`.

---

## Phase 5 Exit Criteria

Plan exit criteria: *"a two-hundred-node tree is navigable, and a full workspace can
be exported and restored on another machine."*

### Is a 200-node tree navigable? — headless: YES, with human confirmation pending

- **Auto-layout (T5.1)** places every new branch through dagre anchored to its parent,
  so a deep/wide tree no longer collapses into overlapping cards; **manual re-layout
  (T5.2)** rebuilds the whole tree in one transaction and re-fits the viewport.
- **Search (T5.5)** reaches any node by prompt/response substring and pans+zooms to it,
  auto-expanding collapsed ancestors — the plan's "any node reachable in under five
  seconds" mechanism. Headless tests confirm match, filter and navigation; the
  five-second claim on a live 200-node seed is **PENDING HUMAN**.
- **Keyboard navigation + viewport persistence (T5.9)** let the user walk the tree
  without the mouse and return to exactly where they left off per tree.
- **Render budget** — `renderBudget.test.tsx` stayed green through T5.5, T5.8 and T5.9;
  no Phase 5 task reintroduced a whole-store subscription or a per-token sibling
  re-render. Live FPS on a 200-node seed under a stream is **PENDING HUMAN** (carried
  from Phase 3).

### Can a full workspace be exported and restored on another machine? — headless: YES, with human confirmation pending

- **Export (T5.6)** serialises one tree + all its nodes to a versioned JSON document
  with **no secrets** (verified by a recursive key-scan and a planted-secret test).
- **Import (T5.7)** validates schema + structural integrity before any write, assigns
  fresh ids throughout, writes all-or-nothing in one transaction, and loads the result;
  importing the same file twice yields two independent trees (headless test).
- End-to-end "export here, `clear site data`, import there, everything matches" is
  **PENDING HUMAN** (plan Verify for T5.7).
- **Multi-tree workspace (T5.3)** — create / switch / rename / delete, last-tree guard,
  cascade delete in one transaction; **honest `updatedAt` (T5.4)** keeps the switcher
  ordered by real editing activity.

**Verdict:** every exit-criterion mechanism is implemented and covered by headless
tests. The criteria are stated in terms of live browser behaviour (navigability feel,
five-second search, cross-machine restore, migration of a real v3 database), so final
sign-off is **PENDING HUMAN** per the click-paths listed under each task and
consolidated below.

---

## Outstanding / handed to human (Phase 5)

Run these in a browser with a real provider configured.

1. **T5.1 auto-layout** — build a tree 3 levels deep, 3 children under each of two
   parents; confirm no cards overlap.
2. **T5.2 manual re-layout** — drag several nodes into a mess → header LayoutGrid
   button → confirm dialog → Re-layout; confirm tidy tree, viewport re-fits, positions
   survive a reload.
3. **T5.3 tree switcher** — create 3 trees with distinct content, switch among them,
   reload; confirm the last active one is restored with correct content. Confirm the
   dropdown closes on an outside click; confirm deleting the last tree leaves one fresh
   empty tree.
4. **T5.4 honest updatedAt** — edit an older tree's prompt; confirm it jumps to the
   top of the switcher list. Confirm dragging/resizing a node does NOT reorder it.
5. **T5.5 search** — seed a 200-node tree (`window.__hydraSeedFiftyNodes` ×N or the
   dev seeder), search a term in exactly one deep node, confirm the canvas pans/zooms
   to it and it highlights; confirm a match under a collapsed branch auto-expands.
   Confirm typing in the search box does not trigger keyboard nav.
6. **T5.6 export** — export a tree; open the `.json`; confirm the node count matches
   and a text search for your real API key finds nothing.
7. **T5.7 import** — export a 3-level tree → Application → Clear site data → Import the
   file; confirm structure, text, positions and overrides all match. Import the same
   file twice into one profile; confirm two independent trees. Try importing a file
   with a hand-edited `schemaVersion` and a file with a broken parent reference;
   confirm each is rejected with a clear message and nothing is written.
8. **T5.8 context size** — build a ~10-deep chain with long responses; confirm the
   "~N tokens of context" estimate grows with depth and the amber warning appears past
   ~6000 tokens; confirm the Send/Regenerate control is never disabled by it; after a
   real generation, confirm the card and the reader panel show the actual in/out token
   counts.
9. **T5.9 viewport + keyboard**
   - Pan/zoom to a deep corner, reload → same view restored (not fit-to-graph).
   - Switch to another tree and back → each tree keeps its own last view.
   - Select a node, navigate a 3-level tree using only `↑ ↓ ← →`; viewport follows.
   - `b` on a selection → a child appears, auto-laid-out. `r` → reader panel opens.
   - Confirm no shortcut fires while the prompt textarea or search input is focused.
   - **Migration:** load a database created by a pre-`9fd610d` build; confirm DB
     version is 4 and every `trees` row has `viewportX/Y: 0`, `viewportZoom: 1`, no
     data lost.

Plus the still-open Phase 1–4 `PENDING HUMAN` items (settings-key persistence,
first-run banner, key-not-in-URL, provider routing, incremental persistence, zombie
recovery, cancel aborts the request, 50/200-node frame rate, drag-while-streaming,
unmount timer race, markdown/link/copy behaviour, resizable-card persistence, reader
panel, edit/regenerate, delete-subtree DB check, stale cascade, per-branch personas,
collapse/expand persistence, per-node model in the Network panel, v2→v3 migration) —
consolidated in `docs/re-engineer-final-report.md`.

## Known plan gap carried forward (NOT fixed this phase)

There is still **no provider-selector control** in the Settings modal. Provider is
self-derived (`gemini` if a Gemini key exists, else `ollama`); choosing Ollama while a
Gemini key is set, or choosing OpenRouter (which has no client), still requires editing
the `settings` row in DevTools. No Phase 5 task addressed it. It is the #1 recommended
post-plan follow-up (see the final report).
