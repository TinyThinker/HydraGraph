# Changelog

> **Where this fits.** What shipped, newest first. One line per change. Add an entry
> here whenever you tick a box in [`ROADMAP.md`](ROADMAP.md). `package.json` is still at
> `0.0.0`; the `vX.Y.Z` headings below are a documentation convention, reconstructed
> from git history up to the reorg. Full historical detail is under
> [`archive/`](archive/).

---

## Unreleased

- **Canvas pill labels are readable, and fan-out siblings are finally
  distinguishable.** Four fixes from
  [`notes/node-labels-research.md`](notes/node-labels-research.md) §2–3, none of which
  touches the store, the layout engine or the schema:
  - **The double truncation is gone.** `stationSummary` budgeted 48 chars while the
    pill rendered one `truncate`d line of 19–29, so the browser silently re-cut 40–60%
    of every label and the user never learned a longer one existed. The summary now
    renders `line-clamp-2` with a 64-char budget (12 words), and the clamp — the only
    thing that knows the real width — does the trimming.
  - **Fan-out siblings show their model.** Siblings are dispatched with a
    byte-identical prompt by construction, so no summarizer can ever tell them apart;
    the model is the only fact that differs, and it is what the comparison is about.
    New `pillModelRef` gives it its own row whenever a turn departs from the default.
    It reads the node's own fields plus one primitive from settings — a sibling scan
    would need the node map re-derived for every pill on every store commit, streaming
    frames included, which is what the render budget exists to prevent. Compact by
    design: an OpenRouter slug already names its vendor, so the prefix is kept only
    for `ollama`, where "this ran locally" is the point.
  - **Quote-seeded branches label the question, not the quote.** Branch-from-selection
    parks the caret below a `> `-quoted passage, so the prompt's first line is the
    *parent's* prose — five sibling branches all reading "Pillar N: …". A leading
    blockquote is now skipped when the prompt continues below it, and kept when it
    does not (the user has not typed past the seed yet).
  - **Off-path pills pass WCAG AA.** `opacity-40` composited the label against
    slate-950 at 3.09:1; `opacity-70` gives 7.46:1, with `saturate-50` still carrying
    the off-path signal. The role label moves `slate-500` → `slate-400` (3.75:1 →
    6.96:1), having failed AA even undimmed.
  - All three rows fit the existing 72px pill — role (12.5) + two summary lines (30) +
    model (12.5) = 55px, against the 27.5px it used to spend. `NODE_HEIGHT`, `H_GAP`
    and `V_GAP` are untouched, so nothing re-lays-out.
- **The cost receipt no longer presents an estimate as a measurement.** The first row
  is measured (provider-reported tokens, catalog prices); the second is modelled — the
  linear thread was never sent, so its size comes from `text.length / 4` and its price
  assumes no prompt caching. They rendered identically, which let "you saved $X" borrow
  the authority of "this tree cost $Y". The linear row is now marked `(est.)`, every
  figure descending from it is prefixed `~`, the assumptions are stated in the panel
  (not only on hover), and both estimate rows carry the full caveat as a tooltip.
  Strings live in `treeCost.ts` beside the math they qualify.
- **The receipt never claims a negative saving.** A shallow tree has almost no
  transcript to re-send, so the modelled linear thread can undercut real spend — which
  rendered as `~$-0.0000 saved · ~-12%` in emerald under "Context you didn't pay for".
  Below zero that row is replaced by a neutral "No saving to show yet — branching pays
  off once the transcript grows." Surfaced by a test fixture rather than in the wild;
  it would have hit first-time users hardest, whose trees are all shallow.
- **Struck a carried-debt item that was already fixed upstream.** "OpenRouter never
  reports token usage" has been on the blocker list since 2026-09-12, and was the top
  entry in STATUS's Next Actions. It is obsolete: OpenRouter deprecated the
  `usage: { include: true }` / `stream_options: { include_usage: true }` opt-ins and now
  always sends usage in the final SSE frame, which `streamingClient.ts` already parses
  (`:83`) and already flushes (`:106`). Confirmed against a live tree — a real
  `deepseek/deepseek-v4-flash-0731` turn reports `1,701 in · 1,996 out · $0.0002`, and
  the tree receipt reads `$0.0025 actual vs $0.0042 linear · 42% saved`. No code change
  was needed; the record was wrong, not the client. See
  [`notes/tooling-research.md`](notes/tooling-research.md) §3.4.
- **The cost receipt now names the real reason a turn was excluded.** Both causes —
  no recorded token counts, and no catalog price — were reported as "unknown model
  pricing", which sent people to the model picker to fix a turn that had simply
  errored or been cancelled. `treeCostSummary` reports `unmeasuredTurns` alongside
  `unpricedTurns` (classified in `turnCostUSD`'s own short-circuit order, so a turn
  that is both counts once), and `CostReceipt` renders a line per cause.

---

## v0.6.0 — 2026-09-20 — The no-key demo tree

Removes the cold-start tax: an empty browser now lands on a real 16-turn research
session instead of an empty canvas, with no API key, no network, and a cost receipt
already showing dollars. 337 tests across 49 files; `tsc` and `oxlint` clean.

- **Demo tree shipped with the app.** `src/lib/demoContent.ts` holds the canned
  transcript — a metrics-pipeline design session, 16 turns, 4 forks, trunk 8 deep —
  and `src/lib/demoTree.ts` (`buildDemoTree(now?)`, `DEMO_TREE_ID`, `isDemoTree`)
  turns it into ordinary `TurnNode` / `ConversationTree` rows: children derived from
  `parentId`, positions from the real `layoutTree`, viewport left unset so
  `CanvasViewport` fits the whole tree on open. No special-casing anywhere in the
  streaming, dispatch, pricing or export paths — the demo is just rows, which is what
  makes it fully explorable (read, branch, compare, export, delete).
- **The receipt is arithmetic, not decoration.** `inputTokens` is the same ~4
  chars/token estimate over the same resolved context the real dispatch path would
  have sent (`resolveContextPayload`, persona overrides included); `outputTokens` is
  the response text. Every model used is in `BUNDLED_CATALOG`, so prices resolve with
  no key and no network: **16 turns, $0.1794 actual vs $0.2545 as one linear thread —
  29% saved**, 0 turns excluded. Enforced by tests rather than by hand.
- **What the demo teaches, in the tree's shape.** A 3-way fan-out at turn 5 asks the
  identical question of Llama 3.3 70B, GPT-4o and Claude 3.7 Sonnet — the cheap model
  hedges, the frontier model catches the 40%-of-volume tenant the others miss — then
  the losing branches stay on the canvas. A second fan-out runs three personas
  (Skeptic / Security Auditor / Performance Engineer, the real `PERSONA_PRESETS`) on
  one DDL at the same model. Two late branches reach back to turn 2 and turn 3, which
  is where the branch-vs-linear gap comes from.
- **First run lands on it.** `App.tsx` boot seeds the demo when the database is empty
  (was: an empty "New Research" tree). `useTreeStore.seedDemoTree()` is idempotent —
  fixed ids, so re-seeding replaces the rows and never duplicates them — and
  "Reset demo tree" in the tree switcher is the way back after poking at it.
  A visitor's own trees are never touched.
- **No scary banner over canned data.** The provider strip moved to
  `src/components/ProviderBanner.tsx`: on the demo tree with no key it explains what
  you're looking at and offers "Add a key"; on your own tree the amber warning is
  unchanged; with a provider configured it renders nothing. Also trims `HeaderBar`
  back under the 150-line rule.
- **First-run smoke test.** `src/firstRun.test.tsx` boots the real `<App/>` against a
  fresh IndexedDB with no key and `fetch` stubbed to fail, then asserts the demo
  renders, the calm banner shows, and the receipt reports real dollars — the landing
  page path, end to end.
- **README and SETUP brought current.** Both still documented native Gemini as a
  provider (removed in v0.5.0) and a per-node model badge in the node footer (deleted
  in Phase 1 with `NodeFooter`) — the first two documents a stranger reads described a
  build from two releases ago. `SETUP.md` now covers the no-key demo tree and how to
  get it back, the real three-control Settings modal, dispatch precedence, the
  node-level model/persona controls in the reader panel, fan-out + compare, the
  OpenRouter `$0.0000` gap where someone will hit it, and the non-obvious rule that
  Ollama only counts as configured once its URL moves off the localhost default.
  `README.md`'s feature list gains the Phase 2 work it never mentioned (fan-out,
  compare, cost receipts, branch-from-a-passage) and leads with the demo.
- **Fixed: one pre-existing red test.** `selectionSurvivesFinalize.test.tsx` waited
  30 ms for mid-stream text that v0.5.1's `MARKDOWN_THROTTLE_MS` releases at 100 ms.
  Unrelated to the demo; the suite was red on `main` before this change.

## v0.5.1 — 2026-09-12 — Branch on a passage; streaming perf; the selection-wipe bug

Three changes: one feature, one performance pass, one defect. The defect is the
notable one — the chat pane blanked the instant any response finished, and the
only recovery was clicking to another node and back. 315 tests across 45 files;
`tsc` and `oxlint` clean.

- **Branch from a selected passage.** Highlight any text inside a turn and a floating
  "Branch on this" button (`SelectionBranchButton` + `useTextSelection`) makes that
  turn active and seeds the composer with the passage as a Markdown quote
  (`lib/quotePrompt.ts`). Works anywhere a container is tagged `data-node-id` — chat
  bubbles, the reader panel, and compare columns. The draft moved out of
  `ChatInputBar`'s local state into `useComposerStore` so anything on screen can seed
  it. Branching previously always started from an empty box, which put the burden of
  restating context back on the user. Partially closes ROADMAP Track B.
- **Streaming no longer re-parses the whole document per token.** `useThrottledText`
  settles in-flight text on a ~100 ms trailing throttle (final text publishes
  immediately when streaming stops), and `MarkdownContent` is memoized on its input.
  Measured on a 40-token response: **40 full parses → 6**, with the gap widening at
  higher token rates and multiplied by column count in compare view. Alongside it:
  `createTokenCoalescer` batches provider deltas into one store commit per animation
  frame at the network boundary (`appendTokenDelta` keeps its synchronous contract);
  `ChatStreamView` subscribes to the active node's live-text length instead of the
  whole `liveText` map, and passes a stable `onSelect` so `ChatMessage`'s `memo` can
  bail; `ReaderPanel` memoizes `estimateContextTokens`, which had been re-walking the
  full ancestor chain on every token; `resolvePrice` builds a WeakMap-cached index per
  catalog instead of up to three linear scans of ~300 models per turn, per render.
- **Fixed: the chat pane blanked when a generation finished.** `selected` was written
  into React Flow imperatively via `setNodes` by three separate components, while
  `useCanvasGraph` rebuilt every node wrapper whenever the store's node map changed
  identity. `finalizeNode` changes that map, so the rebuilt wrappers dropped the flag,
  React Flow fired `onSelectionChange` with `[]`, `CanvasSelectionSync` wrote
  `selectedNodeId = null`, and `useActiveNodeId` fell back to the empty root. Token
  deltas only touch `liveText`, never `nodes`, which is exactly why streaming looked
  fine right up to the moment it completed. `useSelectionStore` is now the sole owner
  of `selected` and `useCanvasGraph` derives it onto each wrapper; the imperative
  writes in `CanvasSelectionSync`, `CanvasSearchFocus` and `CanvasViewport` are gone.
  Keyboard navigation and search fly-to now go through `selectAndFocus`, so they move
  the chat pane too — previously they only moved React Flow's internal selection.
  Regression test in `selectionSurvivesFinalize.test.tsx` (all 3 cases fail on the
  pre-fix code).

## v0.5.0 — 2026-09-03 — Live model catalog & OpenRouter-only providers

Made the cost receipt honest. Providers collapse to **OpenRouter + Ollama** (native
Gemini removed), and prices are no longer a hand-maintained table — they come from
OpenRouter's live `GET /api/v1/models` catalog, IndexedDB-cached with a 1 h TTL and a
committed bundled snapshot for offline / first-run / the no-key demo. The hand-typed
model-id inputs are replaced by searchable priced pickers everywhere. Dexie **v5**
migrates existing `gemini` data to `google/*` OpenRouter slugs. Lands ahead of the
Phase 3 demo tree, whose receipt depends on real prices. 292 tests across 41 files;
`tsc` and `oxlint` clean.

- **Gemini removed; Dexie v5.** `LLMProvider` is now `'openrouter' | 'ollama'`. `streamGemini` and the `x-goog-api-key` path are gone; `geminiApiKey` dropped from `AppSettings`; `DEFAULT_SETTINGS.provider` is `'openrouter'`. `ChatDatabase` v5 adds a `catalog` object store and remaps old rows best-effort (pre-launch, lossy by design): settings + nodes `provider: 'gemini' → 'openrouter'`, `defaultModels.gemini` dropped, `defaultModel` / `modelUsed` gemini ids → `google/*`.
- **Live price catalog.** `src/lib/openRouterCatalog.ts` (`fetchOpenRouterModels` + `normalizeCatalog`; tier derived from output-price percentiles) and `src/store/catalogStore.ts` (`useCatalogStore`, `loadCatalog(force?)`, `TTL_MS` = 1 h): refetch on load when online, an IndexedDB cache that never hard-expires, then `BUNDLED_CATALOG` (`src/lib/bundledCatalog.ts`, regen via `scripts/refresh-catalog.mjs`) as the last fallback. `source` / `fetchedAt` / `status` surfaced in Settings.
- **Pricing off the catalog.** The static `MODEL_PRICING` literal is deleted. `resolvePrice(model, provider?, catalog = useCatalogStore.getState().models)`, `turnCostUSD(node, catalog?)`, and `treeCostSummary(nodes, catalog?)` read the live catalog — still pure and synchronous (the catalog is an optional arg defaulting to the store). Ollama turns priced `{0,0}`. `CostReceipt` / `CompareColumn` / `ReaderPanel` / `ChatMessage` subscribe to `useCatalogStore`.
- **Searchable model pickers.** New `src/components/ModelSelect.tsx` — a priced combobox (`<datalist>` over the catalog for OpenRouter, plain input for Ollama, free-typed ids still accepted). Replaces the hand-typed model-id `<input>`s in `NodeDispatchControls`, `FanOutRow`, and the Settings default-model field. `src/lib/providerOptions.ts` `providerOptions()` replaces the duplicated provider arrays.
- **Two-provider Settings.** One credential control that follows the selected provider (`src/components/SettingsCredentialField.tsx`); an `Advanced` `<details>` for the base URL; a "Refresh prices" button that calls `loadCatalog(true)` and shows `source` + a relative `fetchedAt`.
- **Fan-out price-tier spread.** One-click "Fill: spread across price tiers" (`src/lib/tierSpread.ts` + `configuredProviders` in `settingsStore.ts`) seeds 2–4 variants walking cheap → frontier of the live catalog; disabled until a provider is configured. Per-row `provider/model` helper text via `src/lib/formatModelRef.ts`.

## v0.4.0 — 2026-09-02 — Phase 2: deep-context model arbitration

Built the demo the positioning depends on: compare several models or personas at
turn N of a real problem, on identical inherited context, with the cost. Per-node
provider/model/persona overrides, parallel fan-out off one parent, a column-by-column
compare overlay, and a per-turn / per-tree / counterfactual dollar receipt. No new
infrastructure and no DB migration — `providerOverride` is an optional field.
258 tests across 35 files; `tsc` and `oxlint` clean.

- **Per-node dispatch override plumbing.** `TurnNode.providerOverride` added; `resolveDispatchForNode` now forwards both provider and model overrides; `submitPrompt` stamps the resolved `modelUsed` onto the turn (mirrors the existing `provider` stamp). No DB migration — optional field.
- **Per-node model + persona controls.** New `NodeDispatchControls` in the reader panel: provider override (with "Inherit"), model field, and a system-prompt / persona editor with presets (`personaPresets.ts`). Edits persist via `updateNode`; apply on the next Regenerate.
- **Cost model.** `pricing.ts` (editable per-1M-token table + `resolvePrice`/`turnCostUSD`/`formatUSD`) and `treeCost.ts` (`treeCostSummary`: actual vs. linear-thread counterfactual = "context you didn't pay for"). Pure, unit-tested.
- **Per-turn cost shown.** The chat-stream telemetry line and the reader panel's "last generation" line now append the turn's dollar cost (`turnCostUSD` + `formatUSD`) whenever token counts and a known price are available.
- **The receipt.** New `CostReceipt` (toggle from a `$` button in the header): this tree's actual spend vs. the one-linear-thread counterfactual, and "context you didn't pay for" in dollars + percent. ROADMAP item 4 complete.
- **Fan-out action.** `useTreeStore.fanOutAndSubmit(parentId, prompt, variants[])` forks N children off one parent — each with its own provider/model/persona override — then dispatches the shared prompt into all of them in parallel from identical ancestry. `FanOutVariant` type in `services/llm.ts`.
- **Fan-out composer.** `Split` button in the chat input opens `FanOutModal`: one shared prompt + 2–4 `FanOutRow`s (provider / model / persona preset), dispatched via `fanOutAndSubmit` into parallel sibling branches off the active node. ROADMAP item 2 complete.
- **Compare view (shell).** New `useCompareStore` + `CompareView` full-screen overlay: sibling answers column by column with a checkbox strip, and the shared-context guarantee on screen (N inherited turns, ~X identical tokens). Entry point lands next.
- **Compare view (complete).** `CompareColumn` extracted; a divergence line makes the shared-context guarantee explicit (identical prompt shown once when all columns match); "Compare" button in the header opens it, enabled when the active node has ≥2 siblings. ROADMAP item 3 complete — Phase 2 done.

## v0.3.1 — 2026-09-02 — Phase 1: stop the bleeding

Reconnected the capabilities the subway-pill refactor stranded and removed the
first-run friction. No new infrastructure — this is repair.

- **Settings consolidated.** `useTreeStore` no longer keeps its own copy of the
  settings row; `useSettingsStore` is the single source of truth. Last-open-tree
  persistence moved there as `setActiveTreeId`. `HeaderBar`'s "no provider
  configured" banner reads that store, so saving a key clears it immediately —
  no reload. Boot also recovers gracefully when the remembered tree is gone.
- **Recovery controls back.** New `MessageActions` component: Stop while
  streaming, Retry on an errored turn (always shown — an error is never a dead
  end), Regenerate an idle turn. Mounted in the chat stream and the reader
  panel; routes through the existing `submitPrompt` / `cancelGeneration` store
  actions.
- **`openRouterBaseUrl` wired.** The OpenRouter streaming client now reads it
  (trailing slash tolerated, default preserved) and the Settings modal exposes
  the field. Previously stored but ignored.
- **`@dagrejs/dagre` removed** from dependencies and the lockfile — layout has
  run on `d3-hierarchy` since v0.3.0.
- **Dead code deleted:** `PromptSection`, `SystemPromptEditor`, `ModelPicker`,
  `NodeFooter`, `ResponseArea`, `ContextMeter` and their tests. Per-node model /
  persona are rebuilt into the reader panel in Phase 2, not revived from these.
- Tests: 225 across 29 files (was 253/32 — dead-component suites removed, new
  coverage for `MessageActions`, the `setActiveTreeId` action, and the reactive
  banner). `tsc` and `oxlint` clean.

## v0.3.0 — 2026-09-01 — Dual-pane workspace & subway canvas

The `poc_enhancements_1` track. Reshaped the UI from a single-pane full-card canvas
into a dual-pane layout: canvas for wayfinding, chat pane for reading and composing.

- Dedicated `useSettingsStore` with layered dispatch resolution (node → tree → global).
- `SplitLayout` — draggable 40/60 graph/chat split, ratio clamped 20–80%.
- `ChatStreamView` + `ChatMessage` — the active node's ancestry rendered as chat
  bubbles with Markdown, live streaming text, and token telemetry.
- `ChatInputBar` + `forkAndSubmit` — submitting forks a fresh child off the active
  node; siblings are never overwritten.
- Two-way selection sync (`useSelectionStore`) — canvas ↔ chat, with viewport centering.
- Deterministic auto-layout on `d3-hierarchy` (replaces dagre), recomputed on every
  create / branch / delete; cycle- and broken-pointer-safe.
- Compact 240×72 "station pill" canvas nodes (`stationSummary()`), replacing the full
  prompt/response card. Manual dragging and resizing removed.
- Active-path highlighting: cyan animated accent edges `root → selected`, off-path
  nodes and edges dimmed.
- Documentation reorg: three-tier model (permanent / living pointers / archive); this
  changelog, `ROADMAP.md`, `STATUS.md`, and `docs/README.md` introduced; the
  architecture doc reconciled against the real source as `ARCHITECTURE.md` v2.0.0.

**Known regression (see [`ROADMAP.md`](ROADMAP.md)):** the pill refactor re-implemented
only *delete*; retry / cancel / edit / per-node model / per-node persona have no live
UI. Settings split-brain between the two stores keeps the first-run banner stale.

## v0.2.0 — 2026-08-31 — Five-phase re-engineering

Branch `re-engineer`, 59 task commits. Turned a clean-building demo into a working
product. Full detail: [`archive/2026-08_re-engineering/`](archive/2026-08_re-engineering/).

- **Ground truth & safety net:** Vitest + jsdom + fake-indexeddb runner; `npm run check`
  gate; stack docs corrected to React 19 / Vite 8 / TS 6 / Zustand 5.
- **Core loop:** masked-key Settings modal + header bar; durable throttled streaming
  writes; zombie-node recovery on load; cancel; surfaced stream errors; explicit
  provider routing; stream-parser correctness (cross-read buffering, multi-byte safe);
  Gemini key moved to `x-goog-api-key` header. DB schema → v2.
- **Render path:** whole-canvas re-render on every token eliminated — non-streaming
  nodes take **0** renders during a stream (`renderBudget.test.tsx` regression lock);
  narrow store selectors; in-flight text moved to a `liveText` map off node identity.
- **Research surface:** sanitized Markdown + syntax-highlighted code; resizable cards;
  full-text reader panel; edit prompt / regenerate; delete node + subtree; stale-
  descendant marking; system-prompt override editor; collapse / expand; per-node model
  picker. DB schema → v3.
- **Workspace & scale:** dagre auto-layout + manual re-layout; multi-tree switcher
  (create / switch / rename / delete); honest `updatedAt`; active-tree search with
  fly-to; secret-free JSON export + validated all-or-nothing import; per-node context
  estimate + real token counts; per-tree viewport persistence; keyboard navigation.
  DB schema → v4.
- **Post-plan:** OpenRouter provider (OpenAI-compatible SSE) + Settings provider selector.

## v0.1.0 — 2026-07 — Initial proof of concept

- Dexie `HydraGraphDB` schema: `nodes` / `trees` / `settings`.
- Zustand `useTreeStore` with IndexedDB persistence.
- `@xyflow/react` canvas with a custom `TurnNode` card; drag / branch / edges.
- `resolveContextPayload()` ancestry traversal + cascading system-prompt resolution.
- Native `fetch` + SSE streaming clients for Gemini and Ollama.
