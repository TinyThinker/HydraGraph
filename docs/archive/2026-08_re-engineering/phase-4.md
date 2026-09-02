# Re-Engineering — Phase 4 Summary: The Research Surface

**Phase:** 4 — The Research Surface
**Date:** 2026-08-31
**Branch:** `re-engineer`
**Plan:** `docs/plans/re-engineer.md` (Phase 4, tasks T4.1–T4.9)

## Final `npm run check` result

`npm run check` chains `tsc -b && npm run lint && npm run test` and exits **0**:

```
> hydra-graph@0.0.0 test
> vitest run

 RUN  v4.1.11 /Users/osiris/dev/hydra-graph

 Test Files  16 passed (16)
      Tests  102 passed (102)
```

Lint (oxlint) is completely clean — zero warnings. 102 tests across 16 files
(34 at the end of Phase 3, +68 in Phase 4).

## `npm run build` bundle sizes

| Build point | JS raw | JS gzip | CSS raw | CSS gzip |
|---|---|---|---|---|
| Phase 3 end (pre-T4.1) | 487.37 kB | 155.38 kB | 33.57 kB | 6.80 kB |
| After T4.1 (markdown deps landed) | 812.64 kB | 255.22 kB | 35.89 kB | 7.42 kB |
| **Phase 4 end (after T4.9)** | **829.22 kB** | **258.72 kB** | **38.22 kB** | **7.79 kB** |

**T4.1 dependency delta** (react-markdown + remark-gfm + rehype-highlight, which
pulls lowlight/highlight.js, + a highlight.js dark theme stylesheet):
**+325.27 kB raw / +99.84 kB gzip JS**, +2.32 kB raw / +0.62 kB gzip CSS. This is
the overwhelming majority of the phase's growth; T4.2–T4.9 added no dependencies
and together contributed roughly +16 kB raw / +3.5 kB gzip of application code.
`npm run build` exits 0 (rolldown notes the JS chunk is over 500 kB — expected,
highlight.js is large; code-splitting is a Phase 5 concern, not a regression).

Each task landed as its own commit, in order, `feat(phase-4): …`, no trailers:

```
4e4a554 feat(phase-4): render assistant responses as sanitized markdown with code highlighting
1169b18 feat(phase-4): resizable node cards with persisted dimensions, schema v3
0ddb25b feat(phase-4): full-text reader panel outside the canvas viewport
078995f feat(phase-4): edit prompt and regenerate on idle or errored nodes
ec282de feat(phase-4): delete a node and its whole subtree with a counted confirmation
9706297 feat(phase-4): mark descendant nodes stale after a prompt edit or regenerate
5110e38 feat(phase-4): per-node system prompt override editor
bb285d0 feat(phase-4): collapse and expand subtrees
c1380b5 feat(phase-4): per-node model picker in the footer badge
```

Every task was implemented by a builder sub-agent (haiku) from prose-only
instructions, then reviewed here: every changed file read, `npm run check` (and
`npm run build` for T4.1) run, guardrails checked, Verify performed as far as
possible headlessly. Where a builder's output missed the mark, the correction is
recorded in that task's section and reflected in the grade.

**Component-size note:** `CLAUDE.md` caps component files at 150 lines. TurnNode
grew and shrank across the phase (148 → 151 → … → 90) as cohesive pieces were
split into new sibling files — this is sanctioned by global rule 4 of the plan.
New files created this phase: `MarkdownContent.tsx`, `CodeBlock.tsx`,
`useCanvasGraph.ts`, `ReaderPanel.tsx`, `useReaderPanel.ts`, `ResponseArea.tsx`,
`PromptSection.tsx`, `SystemPromptEditor.tsx`, `NodeFooter.tsx`, `ModelPicker.tsx`,
`src/lib/collapse.ts`. Every non-test component/module file ends the phase under
150 lines (largest: `useCanvasGraph.ts` at 149).

---

## T4.1 — Render markdown and code

- **Done:** Added deps `react-markdown@^10`, `remark-gfm@^4`, `rehype-highlight@^7`
  (highlight.js v11 comes transitively). New `src/components/MarkdownContent.tsx`
  (116 lines) — a `<ReactMarkdown>` with `remarkPlugins=[remarkGfm]`,
  `rehypePlugins=[rehypeHighlight]`, `import 'highlight.js/styles/github-dark.css'`,
  and a `components` map styling headings, paragraphs, lists, GFM tables, inline
  code, blockquotes, and links (`target="_blank" rel="noopener noreferrer"`) for the
  dark slate/indigo theme. Fenced code delegates to new
  `src/components/CodeBlock.tsx` (44 lines), which renders rehype-highlight's token
  spans as-is and a copy-to-clipboard control that reads the block's real text from
  the DOM (`ref.current.textContent`). Raw HTML in model output is **not** passed
  through — no `rehype-raw`, no `dangerouslySetInnerHTML`. `TurnNode.tsx` renders
  `visibleText` through `<MarkdownContent>` inside the existing T3.7 capped scroll
  box. New `src/components/MarkdownContent.test.tsx` (7 cases): heading→`<h1>`, GFM
  table cell in `<td>`, fenced code text **intact** (`const x: number = 1`), link
  attributes, `<script>`/`<img>` sanitised away, copy button present, inline vs
  fenced code distinct.
- **Files:** `package.json`, `package-lock.json`, `src/components/MarkdownContent.tsx` (new),
  `src/components/CodeBlock.tsx` (new), `src/components/MarkdownContent.test.tsx` (new),
  `src/components/TurnNode.tsx`.
- **`npm run check`:** clean, 41 tests. **`npm run build`:** clean; JS 487.37→812.64 kB
  (+325.27 raw / +99.84 gzip), CSS 33.57→35.89 kB.
- **Verify (headless):** all 7 assertions pass, including the code-text-integrity
  guard. Visual confirmation of rendered headings/tables/highlight colours and
  new-tab link behaviour in a real browser: **PENDING HUMAN**.
- **Grade: C+.** The scaffolding — deps, component structure, styling,
  sanitisation-by-default, tests — was sound, but the builder shipped a real bug:
  the fenced-code renderer did `String(children)` on rehype-highlight's React node
  tree, so every code block rendered `"[object Object],…"` garbage and the copy
  button would copy that garbage; its own test only checked for element existence,
  not content. It also left `TurnNode.tsx` at 151 lines. Both fixed in review:
  `CodeBlock` now renders the highlighted children directly and copies via DOM
  `textContent`, a `pre` passthrough was added to avoid nested `<pre>`, the tests
  were strengthened to assert code-text integrity, and `TurnNode` was compressed
  to 147 lines.
- **Deviations:** none beyond the pre-authorised split (`CodeBlock.tsx`).

## T4.2 — Resizable cards (SHARED schema bump → version 3)

- **Done:** `src/types/index.ts` gains optional `width?: number` / `height?: number`.
  `src/db/ChatDatabase.ts` gains `this.version(3)` (indexes unchanged) whose
  `.upgrade` backfills `width: 320` / `height: 240` on every existing node row —
  this is the single shared bump; T4.6 extended the **same** version(3) upgrade
  (see below), no version(4). `src/components/TurnNode.tsx` renders a
  `<NodeResizer minWidth={280} minHeight={200} isVisible={selected}>` and the card
  root became `w-full h-full flex flex-col overflow-hidden`, with the markdown
  response region `flex-1 min-h-0 overflow-y-auto` so it fills the card at any
  size. The store→React-Flow derivation (now in `useCanvasGraph.ts`) sets
  `width`/`height` on each wrapper (`n.width ?? 320`, `n.height ?? 240`) and
  `onNodesChange` persists `dimensions` changes through a **separate** 300 ms
  debounce map (`resizeTimers`), flushed on resize-end and on unmount. New
  `src/components/resizableCard.test.tsx` (2 cases): a node with `width:500
  height:400` renders `.react-flow__node` with those inline pixel sizes; a node
  with neither falls back to `320px`/`240px`.
- **Files:** `src/types/index.ts`, `src/db/ChatDatabase.ts`, `src/components/TurnNode.tsx`,
  `src/components/Canvas.tsx`, `src/components/useCanvasGraph.ts` (new, review), `src/components/resizableCard.test.tsx` (new).
- **`npm run check`:** clean, 43 tests. **`npm run build`:** clean, ~+2 kB.
- **Verify (headless):** both inline-dimension assertions pass. Real pointer-drag
  resize, persistence across reload, and the minimum-size constraint keeping
  controls reachable: **PENDING HUMAN**.
- **Grade: B-.** Schema bump (with the T4.6-extension comment), type additions,
  NodeResizer wiring, flex-fill layout and the dimension-debounce were all
  correct, but the builder pushed `Canvas.tsx` to 186 lines — a 36-line breach of
  the hard 150 ceiling the brief explicitly called out — and used `change as any`.
  Fixed in review: the graph derivation, wrapper cache, drag-merge and debounced
  persistence were extracted into a new `useCanvasGraph.ts` hook (Canvas.tsx is
  now a 37-line JSX shell), `as any` was replaced with proper `NodeChange`
  narrowing, and a weak `toBeDefined()` assertion was tightened.
- **Deviations:** `useCanvasGraph.ts` is a new module not on the task's file
  list — created during review purely to satisfy the size rule; `Canvas.tsx`
  itself is now a shell. All subsequent "Canvas" work in the phase targets
  `useCanvasGraph.ts`.

## T4.3 — Full-text reader panel

- **Done:** New `src/components/useReaderPanel.ts` (13 lines) — a tiny dedicated
  Zustand store `{ nodeId, open(id), close() }`, kept separate so the main store
  is untouched. New `src/components/ReaderPanel.tsx` (97 lines) — a flex **sibling
  of the canvas** in `App.tsx` (outside React Flow, unaffected by zoom), renders
  `null` when closed; when open it shows the node's complete, untruncated user
  prompt (plain) and assistant response via `<MarkdownContent>` (following live
  streaming text via `liveText`), with copy-entire-response, a close button, and
  Escape-to-close; it auto-dismisses if the node is deleted. Opened two ways:
  double-clicking a card, or the now-**enabled** "Open full text" control in the
  T3.7 truncation notice. The assistant-response block was extracted from
  `TurnNode.tsx` into new `src/components/ResponseArea.tsx` (41 lines) to stay
  under 150. `src/App.tsx` wraps the canvas in `flex-1 min-h-0 flex` with
  `<ReaderPanel/>` as the right-hand sibling. New `src/components/ReaderPanel.test.tsx`
  (6 cases): full untruncated text incl. a tail marker past the 2000-char card
  cap; markdown heading→`<h1>`; close clears `nodeId`; null `nodeId` renders
  nothing; unknown `nodeId` renders nothing; live text precedence.
- **Files:** `src/components/ReaderPanel.tsx` (new), `src/components/useReaderPanel.ts` (new),
  `src/components/ResponseArea.tsx` (new), `src/components/ReaderPanel.test.tsx` (new),
  `src/App.tsx`, `src/components/TurnNode.tsx`.
- **`npm run check`:** clean, 49 tests. **`npm run build`:** clean, +2.3 kB JS.
- **Verify (headless):** all 6 cases pass. "Card truncates a long stream, panel
  shows the whole thing" confirmed by the tail-marker test; the ≤2-interaction
  reachability (double-click or one control click) is structurally guaranteed.
  Real drag/zoom independence and Copy button: **PENDING HUMAN**.
- **Grade: A-.** Clean, panel is genuinely outside the viewport, both open paths
  wired, `ResponseArea` split is tidy. Minor: the `2000` cap constant is now
  duplicated (display-only) in `ResponseArea`; `onDoubleClick` on the whole card
  can also fire on a text-selection double-click.
- **Deviations (pre-authorised):** the task listed "one new component + App.tsx";
  a second Zustand store and edits to `TurnNode.tsx` (required by steps 3–4) and
  the `ResponseArea` split were flagged in the brief.

## T4.4 — Edit prompt and regenerate

- **Done:** New `src/components/PromptSection.tsx` (146 lines), extracted from
  TurnNode, with four states off `node.userPrompt` / `node.status` plus local
  `editing`: **fresh** (textarea + Send), **streaming** (prompt + Cancel),
  **idle/error with a prompt** (prompt + Edit + Regenerate), **editing** (textarea
  pre-filled with the current prompt + Save&run + Cancel). Edit and Regenerate
  both call the existing `submitPrompt` entry point, which already clears the prior
  response and stored error and re-enters streaming; a `useEffect` closes the
  editor if streaming starts elsewhere. `src/store/useTreeStore.ts`: `submitPrompt`
  now (a) no-ops if the node is already `streaming` (double-submit guard) and (b)
  resets `inputTokens`/`outputTokens` to `undefined` on each run. Descendant nodes
  are intentionally left in place (T4.6 owns the staleness signal). Store tests (4):
  regenerate clears response+error and re-enters streaming (memory + DB); edit
  changes the stored prompt; already-streaming submit is a no-op (mock not
  re-called); children preserved. Component tests (6) in `PromptSection.test.tsx`.
- **Files:** `src/components/PromptSection.tsx` (new), `src/components/PromptSection.test.tsx` (new),
  `src/store/useTreeStore.ts`, `src/store/useTreeStore.test.ts`, `src/components/TurnNode.tsx`.
- **`npm run check`:** clean, 59 tests. **`npm run build`:** clean, +2.7 kB JS.
- **Verify (headless):** all 10 cases pass; "a failed node can be retried without
  being deleted" is covered by the regenerate-from-error store test. End-to-end
  bad-key → fix-key → Regenerate → streams: **PENDING HUMAN**.
- **Grade: A-.** Correct four-state UI, both paths through the single entry point,
  minimal well-targeted store change, descendants untouched, thorough tests.
  Minor: repetitive per-branch wrapper markup; the requested belt-and-suspenders
  `disabled` attribute on Edit/Regenerate was omitted (moot — the streaming branch
  returns before those buttons render).
- **Deviations:** none beyond the pre-authorised `PromptSection` split.

## T4.5 — Delete a node and its subtree

- **Done:** `src/store/useTreeStore.ts` gains exported
  `collectSubtreeIds(rootId, nodes): Set<string>` (root + all descendants,
  cycle- and missing-guarded) and a `deleteNodeSubtree(id)` action: returns
  early if the node is missing or is the tree root; aborts any in-flight stream
  and throttled flush for every collected id; **one** `db.transaction` that
  `bulkDelete`s the subtree and filters the deleted id out of its parent's
  `childrenIds`; **one** immutable state write (`nodes` + `liveText`); then a
  tree-timestamp bump. `TurnNode.tsx` footer gains a Trash control — `disabled`
  with a tooltip on the root, otherwise a first click opens a confirmation
  **naming the node count** and only the explicit "Remove N" button deletes.
  Store tests (5): full-subtree deletion (memory + DB + parent list), root no-op,
  leaf-only deletion, `collectSubtreeIds` set contents, liveText cleanup.
  Component tests (4) in `deleteNode.test.tsx`: child delete opens a counted
  confirmation and removes the node; root button is `disabled` and inert; Cancel.
- **Files:** `src/store/useTreeStore.ts`, `src/components/TurnNode.tsx`,
  `src/store/useTreeStore.test.ts`, `src/components/deleteNode.test.tsx` (new).
- **`npm run check`:** clean, 68 tests. **`npm run build`:** clean, +2.2 kB JS.
- **Verify (headless):** "deleting a middle node removes exactly that subtree and
  fixes the parent's child list" proven in memory and via fake-indexeddb.
  IndexedDB inspection in a real browser: **PENDING HUMAN**.
- **Grade: A-.** Correct, immutable, single-transaction, within size limits,
  nothing deletes without the counted confirmation. Minor: the `liveText` Map is
  re-cloned per matching id in a loop (correct, mildly wasteful); the Trash
  control is icon-only (title, no visible label).
- **Deviations:** none — both files on the task list.

## T4.6 — Mark descendants stale after an edit (extends shared version 3)

- **Done:** `src/types/index.ts` gains optional `stale?: boolean`. The **existing**
  `this.version(3)` `.upgrade` in `src/db/ChatDatabase.ts` was **extended** (not a
  new version) so its per-row loop also sets `stale: false` where missing —
  version(3) now backfills width, height, and stale. `src/store/useTreeStore.ts`
  gains `markDescendantsStale(id)`: walks the node's descendants
  (`collectSubtreeIds` minus the id itself), and in one transaction + one
  immutable write flags each `stale: true`, touching nothing else (no status, no
  text — descendants are never auto-regenerated). `submitPrompt` clears the
  target's own `stale` flag (memory + DB) and calls `markDescendantsStale(nodeId)`,
  so both edit and regenerate cascade the signal from one place. `TurnNode.tsx`
  renders stale cards at `opacity-70` with an amber `History` badge: "An ancestor
  changed after this answer was generated — it may be out of date." Store tests (4)
  + component tests (3, `staleBadge.test.tsx`).
- **Files:** `src/types/index.ts`, `src/db/ChatDatabase.ts`, `src/store/useTreeStore.ts`,
  `src/components/TurnNode.tsx`, `src/store/useTreeStore.test.ts`,
  `src/components/staleBadge.test.tsx` (new).
- **`npm run check`:** clean, 75 tests. **`npm run build`:** clean, +1 kB JS.
- **Verify (headless):** "editing a root prompt marks every descendant stale;
  regenerating a middle node clears only its own badge" proven in memory + DB;
  descendants' `status`/`assistantResponse` asserted unchanged. Visual muting +
  badge in a real browser: **PENDING HUMAN**.
- **Grade: A-.** Single shared schema bump respected, reusable action that T4.7
  consumes, correct clear-on-self-regenerate, no auto-regeneration. Minor: the
  builder first typed the migration accumulator `Record<string, any>` — tidied to
  `Record<string, number | boolean>` in review.
- **Deviations:** none — all four files on the task list.

## T4.7 — System prompt override editing

- **Done:** New `src/components/SystemPromptEditor.tsx` (89 lines) — an
  absolutely-positioned overlay (the card root is now `relative`) opened from a
  new Shield toggle in the footer. It shows the prompt this node **inherits**,
  read-only, above the input: computed as `resolveContextPayload(node.parentId,
  nodes, treeDefault).systemPrompt` (resolving at the parent yields exactly what
  the node inherits absent its own override), or the tree's `defaultSystemPrompt`
  for the root. The textarea is seeded from `node.systemPromptOverride`. **Save**
  persists via `updateNode(id, { systemPromptOverride: value || undefined })` then
  reuses `markDescendantsStale(id)`; an empty draft or the **Clear override**
  button (shown only when an override exists) removes it and falls back to
  inheritance. Neither path regenerates — the existing answer is untouched, only
  future generations use the new persona. The amber Shield badge on the card is
  unchanged and still driven purely by `systemPromptOverride`. Footer +
  delete-confirmation + the new persona control were extracted into new
  `src/components/NodeFooter.tsx` (98 lines), collapsing `TurnNode.tsx` to a
  77-line shell. Tests: `SystemPromptEditor.test.tsx` (6) — inherited-from-ancestor,
  root-inherits-tree-default, Save writes + stales + does NOT regenerate (stream
  mock never called, `assistantResponse` preserved), Clear falls back, no Clear
  control without an override, whitespace draft clears. `NodeFooter.test.tsx` (6) —
  toggle colour, open/close editor, delete + branch still render, root delete
  disabled.
- **Files:** `src/components/SystemPromptEditor.tsx` (new), `src/components/NodeFooter.tsx` (new),
  `src/components/SystemPromptEditor.test.tsx` (new), `src/components/NodeFooter.test.tsx` (new),
  `src/components/TurnNode.tsx`.
- **`npm run check`:** clean, 87 tests. **`npm run build`:** clean, +2.6 kB JS.
- **Verify (headless):** the "two sibling branches, two personas, identical
  ancestry" goal is supported — each sibling's override resolves independently and
  is passed per-node through `resolveContextPayload` → `submitPrompt` →
  `streamLLMResponse`. Confirming the two responses actually differ in persona
  needs a live model: **PENDING HUMAN**.
- **Grade: A-.** Correct resolve-at-parent inherited computation, clear-to-inherit,
  no retroactive regeneration (asserted), stale cascade reused, badge behaviour
  preserved, TurnNode reduced to a clean shell. Minor: the overlay can visually
  overlap the top badge when an override is already set.
- **Deviations (pre-authorised):** the task listed one new component; two were
  created (`SystemPromptEditor.tsx`, `NodeFooter.tsx`) to keep files under 150 —
  flagged in the brief. `useTreeStore.ts` was not touched (only its existing
  `updateNode` / `markDescendantsStale` are used).

## T4.8 — Collapse and expand subtrees

- **Done:** `src/store/useTreeStore.ts` gains `toggleCollapse(id)` — flips **only**
  that node's `isCollapsed` (memory + DB), never a descendant's, so inner collapsed
  state is independent. New `src/lib/collapse.ts` (31 lines) `computeHiddenIds(nodes)`
  walks the full ancestor chain (cycle-guarded) and returns every id with a
  collapsed ancestor. `src/components/useCanvasGraph.ts`: a `hiddenIds` memo feeds
  a `.filter((n) => !hiddenIds.has(n.id))` on the node array and a
  `.filter((id, parentId) => !hiddenIds.has(id) && !hiddenIds.has(parentId))` on
  the edge array; `structureKey` now folds `isCollapsed` in (`${id}>${parentId}>${c|o}`)
  so edges recompute on toggle. `TurnNode.tsx` shows a control when
  `data.isCollapsed || data.childrenIds.length > 0`: "Show N hidden" (N = total
  descendants at every depth, via a **guarded primitive selector** so the render
  budget is untouched) when collapsed, "Collapse subtree" when expanded. Hidden
  nodes stay in the store and still stream to completion. Store tests (2):
  toggle is reversible in memory + DB; a hidden node still streams + persists.
  Component tests (3, `collapse.test.tsx`): collapsing a middle node renders only
  2 of 4 nodes and 1 edge; nested — expanding the outer node reveals the middle
  but the inner-collapsed leaf stays hidden; leaf shows no control.
- **Files:** `src/store/useTreeStore.ts`, `src/components/useCanvasGraph.ts`,
  `src/components/TurnNode.tsx`, `src/lib/collapse.ts` (new),
  `src/store/useTreeStore.test.ts`, `src/components/collapse.test.tsx` (new).
- **`npm run check`:** clean, 92 tests. **`npm run build`:** clean, +1.2 kB JS.
  `renderBudget.test.tsx` re-run and **still passes** (2/2) — the count selector
  returns a primitive and is not re-evaluated to a new value during a stream.
- **Verify (headless):** "collapse hides the whole subtree, count includes every
  depth, inner collapsed state survives an outer expand" all proven via a mounted
  `<Canvas>` counting `.react-flow__node` / `.react-flow__edge`; "a hidden
  streaming node still completes" proven at the store level. Real
  collapse/expand + reload persistence + smoothness: **PENDING HUMAN**.
- **Grade: A-.** Correct full-ancestor hidden-set, both arrays filtered, structure
  key updated, nested state preserved, streaming independent of rendering, nodes
  never unloaded, render budget intact. Minor: `useCanvasGraph.ts` now sits at 149
  lines (tight for future work); `computeHiddenIds` is O(N·depth) recomputed on
  every `nodes` change (fine at Phase 4 scale, worth watching at 200 nodes).
- **Deviations:** the plan's file list said `Canvas.tsx`; the derivation lives in
  `useCanvasGraph.ts` since T4.2, so that is where the work went. `src/lib/collapse.ts`
  is a new helper module extracted to keep `useCanvasGraph.ts` under 150.

## T4.9 — Per-node model selector

- **Done:** New `src/components/ModelPicker.tsx` (110 lines) — an overlay opened
  from the footer model badge. Options = a curated per-provider list
  (`MODELS_BY_PROVIDER`: gemini flash/pro/2.0-flash; openrouter gpt-4o-mini /
  claude-3.5-sonnet / llama-3.1-70b; ollama llama3.1/3.2 / mistral / qwen2.5)
  **unioned** with the global `defaultModel` and the node's current `modelUsed`
  (deduped, curated order preserved), plus a free-text input. Provider is
  `node.provider ?? settings.provider`. Selecting or setting a model persists it
  via `updateNode(id, { modelUsed })`, so the badge shows exactly what the next
  request will call (per-node routing from T2.6). `src/components/NodeFooter.tsx`:
  the model badge became a `<button>` that toggles the picker and is `disabled`
  (with `opacity-50`) while `node.status === 'streaming'`. Tests: `ModelPicker.test.tsx`
  (7) — lists the provider's models and persists a pick (memory + DB), free-text
  persists, Enter submits, `node.provider` overrides `settings.provider`, the
  current model always appears even if uncurated, Cancel, Set disabled when empty.
  `NodeFooter.test.tsx` +2 — badge opens the picker; badge disabled while
  streaming. `useTreeStore.test.ts` +1 — `submitPrompt` passes the node's own
  `modelUsed` as the request model (`streamLLMResponse` 3rd arg).
- **Files:** `src/components/ModelPicker.tsx` (new), `src/components/NodeFooter.tsx`,
  `src/components/ModelPicker.test.tsx` (new), `src/components/NodeFooter.test.tsx`,
  `src/store/useTreeStore.test.ts`.
- **`npm run check`:** clean, 102 tests. **`npm run build`:** clean, +2.5 kB JS.
  `renderBudget.test.tsx` still passes.
- **Verify (headless):** "two siblings, two models, and the request names the
  model on its badge" proven by the `submitPrompt` store test. Confirming in the
  browser Network panel that each sibling's request carries its own model, and
  that the badge is inert mid-stream: **PENDING HUMAN**.
- **Grade: A-.** Badge→picker, per-provider list + default + current + free-text,
  persisted to `modelUsed`, disabled while streaming, `node.provider` respected,
  crux behaviour asserted at the store. Minor: the model lists are hardcoded
  (there is no settings-driven model list — acceptable given the plan gap); the
  picker closes only on select/Set/Cancel, not on outside-click.
- **Deviations:** the plan named `TurnNode.tsx`; the model badge was relocated to
  `NodeFooter.tsx` in T4.7, so that is where the work went. `ModelPicker.tsx` is a
  pre-authorised new component.

---

## Phase 4 Exit Criteria

**Plan exit criterion:** *a real research session can be run end to end without
touching DevTools.*

**Assessment: substantially MET, with one known gap — the provider selector.**

A single-provider research session — Gemini with an API key, **or** Ollama with a
base URL — can now be run entirely from the UI:

| Capability | UI path | Task |
|---|---|---|
| Configure a provider key / Ollama URL / default model | Header gear → Settings modal; first-run amber banner prompts it | T2.1 / T2.2 |
| Send a prompt | Type in a card, Send (or Enter) | pre-existing / T4.4 |
| Watch it stream, cancel it | Live text in the card; red Cancel button while streaming | T2.7 / T2.10 |
| Survive a reload mid-stream; see errors; retry | Incremental persistence; error panel on the card; **Regenerate** / **Edit** on idle-or-errored nodes | T2.7–T2.9 / T4.4 |
| Read formatted output | Markdown + GFM tables + syntax-highlighted code with copy buttons; resize the card; **double-click** or "Open full text" → reader panel with the whole response | T4.1 / T4.2 / T4.3 |
| Edit a prompt / regenerate | Inline Edit textarea; Regenerate button; both re-run through `submitPrompt` | T4.4 |
| Delete a branch | Footer Trash → counted confirmation → subtree removed; root protected | T4.5 |
| Different personas per branch | Footer Shield → per-node system-prompt override editor showing the inherited prompt; Clear to inherit; descendants marked stale | T4.7 / T4.6 |
| Collapse / expand subtrees | "Collapse subtree" / "Show N hidden" control; nested state preserved | T4.8 |
| Per-node model | Footer model badge → picker (provider list + default + current + free-text), persisted; disabled while streaming | T4.9 |

**What still forces DevTools:**

1. **The provider selector (known plan gap, flagged since Phase 2).** The Settings
   modal has no provider dropdown. `provider` is only *self-derived* by
   `saveSettings` — `'gemini'` if a Gemini key is present, else `'ollama'` if an
   Ollama URL is present. Therefore: a Gemini-key user who wants to route to a
   local Ollama model, or **anyone wanting to select OpenRouter**, must hand-edit
   the `settings` row in IndexedDB (DevTools → Application → IndexedDB →
   `HydraGraphDB` → `settings` → `global_settings` → set `provider`). OpenRouter
   additionally has no request client (T2.6 left it a deliberate "not yet
   implemented" error). Recommended fix: add the provider `<select>` to the
   Settings modal (the natural home; it was deferred from Phase 2 and would also
   pair with the T4.9 per-node picker). This is the single blocker on a literal
   reading of the exit criterion.
2. **Tree-level `defaultSystemPrompt`.** Set once at `createTree` to a hardcoded
   string; there is no UI to change the tree-wide default (only per-node
   overrides, which do cover most needs since the editor shows and can replace the
   inherited value).
3. **Tree management** (new tree with a title, switch, rename, delete tree,
   search, export/import) is Phase 5. One session works with the one
   auto-created tree; multiple named trees need DevTools until then. Not a blocker
   for *a* research session.

**Render budget (Phase 3) held:** `renderBudget.test.tsx` still passes after T4.8
and T4.9 — the new count/collapse selectors return primitives and do not
re-render idle cards during a stream.

---

## Outstanding / handed to human

Every item needs a real browser; several also need a configured provider. Exact
steps:

1. **T4.1 — markdown & code rendering.** Send a prompt that returns headings, a
   table, and a fenced code block (or paste such markdown into a node's stored
   `assistantResponse` via DevTools). Confirm: headings/lists/tables render
   styled; code is syntax-highlighted with a working per-block copy button; a
   link in the response opens in a **new tab**; no raw HTML from the model is
   executed.
2. **T4.2 — resizable cards.** Select a card, drag a resize handle, reload →
   the card keeps its new size. Confirm you cannot shrink it small enough to lose
   the footer controls.
3. **T4.3 — reader panel.** Stream a long (>2000-char) response; the card shows
   the "Showing the last 2,000 characters…" notice. Click "Open full text" →
   right-hand panel opens with the whole response; also try double-clicking a
   card. Test Copy response and Escape-to-close. Pan/zoom the canvas and confirm
   the panel is unaffected.
4. **T4.4 — edit / regenerate.** Save a deliberately wrong Gemini key, send a
   prompt → the card shows an error. Fix the key in Settings. Click **Regenerate**
   on the errored node → it streams successfully (no delete needed). Then **Edit**
   a prompt, change the text, Save & run → the new prompt streams.
5. **T4.5 — delete subtree.** Build a 3-level tree. Click the footer Trash on a
   middle node → confirm the confirmation names the correct count → Remove.
   DevTools → IndexedDB → `HydraGraphDB` → `nodes`: only that node and its
   descendants are gone, and the parent's `childrenIds` no longer lists the
   deleted id. Confirm the root's Trash control is disabled with a tooltip.
6. **T4.6 — stale cascade.** Build a 3-level chain. Edit the root prompt → both
   descendant cards dim (`opacity-70`) and show the amber "An ancestor changed…"
   badge. Regenerate the middle node → only its own badge clears; its child stays
   stale.
7. **T4.7 — per-branch personas.** Under one parent, create two sibling nodes.
   Open the footer Shield editor on each; confirm the "Inherited" box shows the
   parent/tree prompt. Give each sibling a distinct persona override (confirm the
   amber Shield badge appears). Send the *same* prompt to both → the two responses
   reflect the different personas. Confirm setting an override does **not** re-run
   an already-generated answer, and that "Clear override" removes the badge and
   restores inheritance.
8. **T4.8 — collapse/expand.** Build a tree with a nested collapsed branch.
   Collapse the outer node → its whole subtree (all depths) disappears and the
   card reads "Show N hidden" with the correct N. Expand it → the previously-
   collapsed inner node is still collapsed. Start a generation on a node, then
   collapse its parent; when you expand again (or reload) the response is
   complete and persisted.
9. **T4.9 — per-node model.** Set two sibling nodes to two different models via
   the footer badge picker (try one curated model and one free-text). Generate
   both. DevTools → Network: each request names the model shown on its own badge
   (Gemini URL path segment / Ollama request body `model`). Confirm the badge is
   not clickable while a node is streaming.
10. **Schema migration v2 → v3.** On a build from before commit `4e4a554`, create
    a tree and a few nodes (writes v2 rows). Check out current `re-engineer` HEAD
    and load the app. DevTools → IndexedDB → `HydraGraphDB`: DB version is **3**;
    every `nodes` row now has `width: 320`, `height: 240`, `stale: false`; no data
    lost. (Rows written by an intermediate build that ran a T4.2-only version(3)
    would have width/height but not `stale` — not a real user scenario on this
    branch, and the runtime treats missing `stale` as not-stale regardless.)
11. **Provider selector gap.** Confirm from the UI alone that there is no way to
    choose Ollama while a Gemini key is set, or to choose OpenRouter — this still
    requires editing the `settings` row in DevTools. (Carry into Phase 5 / a
    settings-modal follow-up.)

Phase 1–3 `PENDING HUMAN` items (settings key persistence, first-run banner,
key-not-in-URL, provider routing to the selected host, incremental persistence,
zombie recovery, cancel aborts the network request, 50-node frame rate,
drag-while-streaming, unmount timer race) remain open — see the Phase 2 and
Phase 3 summaries' Outstanding lists.

---

## Final database schema version

**Version 3.** Its `.upgrade` step backfills, on every existing `nodes` row that
lacks them:

| Field | Backfill value | Added by |
|---|---|---|
| `width` | `320` (current card `w-80`) | T4.2 |
| `height` | `240` (current card default) | T4.2 |
| `stale` | `false` | T4.6 (extends the same version(3) upgrade — no version(4)) |

Prior versions: version(2) backfilled `provider` (inferred from key presence) and
`errorMessage: ''` on `nodes`, and `provider` on the `settings` row; version(1) is
the base schema. Indexes are unchanged across all three versions
(`nodes: 'id, treeId, parentId, timestamp'`, `trees: 'id, createdAt, updatedAt'`,
`settings: 'id'`) — `width`/`height`/`stale` are stored but not indexed.

`docs/current_state_and_next_steps.md` should be updated with a Phase 4 section
describing what is now genuinely working (per the plan's Definition of Done);
that update is outside this summary.
