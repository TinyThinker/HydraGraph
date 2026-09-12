# Changelog

> **Where this fits.** What shipped, newest first. One line per change. Add an entry
> here whenever you tick a box in [`ROADMAP.md`](ROADMAP.md). `package.json` is still at
> `0.0.0`; the `vX.Y.Z` headings below are a documentation convention, reconstructed
> from git history up to the reorg. Full historical detail is under
> [`archive/`](archive/).

---

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
