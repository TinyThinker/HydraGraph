# Phase 1 — Core report

## Problem

- A tree has no output. The only way to get work out is `ExportButton` → JSON, or copying
  turns one by one.
- Canvas selection (`useSelectionStore`) holds one node. Compare (`useCompareStore`)
  holds siblings of one parent. Neither can express "these three branches".
- `streamLLMResponse` (`lib/streamingClient.ts`) never sends `options.num_ctx` to Ollama
  (body at `:132`), so Ollama silently cuts a long request from the front. Reports are
  OpenRouter-only in this spec for that reason (see "Shelved" at the end).

## Outcome

- Turn on report mode, tick turns on the canvas, write a report from their branches.
- Read it rendered, copy it, download it as `.md`. It survives reload, export and import.
- Its cost shows in the receipt. It says when its sources changed.
- A selection that does not fit the model is blocked with a plain message, before any
  tokens are spent.

## Data model

```ts
// types/index.ts
export interface TreeReport {
  id: string
  createdAt: number
  updatedAt: number
  title: string            // first heading of the output, else "Report"
  leafIds: string[]        // ticked turns; each includes its path to the root
  brief: string
  provider: LLMProvider
  model: string
  text: string             // final markdown
  status: 'idle' | 'error' // 'streaming' is never persisted
  errorMessage?: string
  inputTokens?: number
  outputTokens?: number
  sourceDigest: string     // see 1.1; compared to detect stale sources
}
// ConversationTree gains: reports?: TreeReport[]
```

## Tasks

### 1.1 Build the report transcript

- **Files:** `src/types/index.ts`, `src/lib/reportContext.ts` (new),
  `src/lib/reportContext.test.ts` (new)
- **Change:**
  - Add `TreeReport` and `ConversationTree.reports?` as above.
  - `collectReportTurns(leafIds, nodes): TurnNode[]` — union of every leaf's ancestry
    (`getAncestryChain`), deduped, in depth-first order from the root so each branch reads
    contiguously after the shared trunk. Missing ids are skipped.
  - `buildReportPayload(turns, brief, systemPrompt): ContextResolutionResult` — system =
    brief. One user message holding the transcript. Each turn is rendered as
    `[tN] (branch point | continues tM)` + prompt + response, so the model can see where
    branches split. Persona overrides are named on the turn they apply to.
  - `reportSourceDigest(turns): string` — `promptLen:responseLen` per turn, in order,
    joined and hashed (FNV-1a is enough). No node ids, so it survives import (1.10).
    Changes when a turn is regenerated, edited or deleted.
- **Tests:** two leaves sharing a trunk → trunk once; leaf that is an ancestor of another
  leaf → no duplicates; missing id skipped; digest changes when a response changes.
- **Done when:** pure module, no store or React imports.

### 1.2 Fit check

- **Files:** `src/lib/reportFit.ts` (new), `src/lib/reportFit.test.ts` (new)
- **Change:**
  - `estimateTokens(payload)` — chars/4 over system + messages (same ruler as
    `contextEstimate.ts`).
  - `checkFit({ inputTokens, contextWindow, outputReserve })` →
    `{ fits: boolean; needed: number; limit: number | null }`. Margin 15% on input.
    `outputReserve` default 8,000 tokens. Unknown window → `fits: true, limit: null`
    (the UI says "limit unknown").
  - `contextWindowFor(provider, model, catalog)` — OpenRouter: `CatalogModel.contextWindow`.
    Ollama is not supported (1.3).
- **Tests:** fits, does not fit, unknown window, margin edge.
- **Done when:** pure module.

### 1.3 Reports are OpenRouter-only

- **Files:** `src/lib/reportFit.ts`, `src/lib/reportFit.test.ts`
- **Change:** `reportWriterStatus(provider, settings)` →
  `{ ok: true } | { ok: false; reason: 'ollama' | 'no-key' }`. `'ollama'`: "Reports use
  OpenRouter for now. Pick an OpenRouter model." `'no-key'`: "Add an OpenRouter key in
  Settings to write reports." The store (1.6) and the composer (1.7) both check it.
  Chat turns on Ollama are unaffected.
- **Tests:** ollama → blocked; openrouter without key → blocked; openrouter with key → ok.
- **Done when:** no report request can reach Ollama.

### 1.4 Tick branches on the canvas

- **Files:** `src/store/useReportStore.ts` (new), `src/components/TurnNode.tsx`,
  `src/components/HeaderBar.tsx`, `src/store/useReportStore.test.ts` (new),
  `src/components/reportSelect.test.tsx` (new; pattern: `pillLabel.test.tsx`)
- **Change:**
  - Store: `selecting: boolean`, `leafIds: string[]`, `includedIds: Set<string>`
    (recomputed on toggle from the tree store's nodes), `startSelecting()`, `toggle(id)`,
    `clear()`, `stopSelecting()`. Immutable updates.
  - Header: a "Report" button (`FileText` icon) toggles selecting. Opens the report panel
    once 1.6 lands; until then it only toggles mode.
  - Pill: while selecting, a click toggles instead of selecting. Ticked pill shows a check
    badge; included ancestors get a faint indigo ring. Selectors are booleans:
    `s.leafIds.includes(id)` and `s.includedIds.has(id)`.
  - Escape leaves selecting mode.
- **Tests:** toggling two leaves with a shared trunk → `includedIds` is the union; pill
  renders the badge only when ticked; render tally stays flat when toggling an unrelated
  pill.
- **Done when:** you can tick three branches and see their paths light up.

### 1.5 Save reports on the tree row

- **Files:** `src/store/useTreeStore.ts`, `src/store/useTreeStore.test.ts`
- **Change:**
  - `saveReport(treeId, report)` — upsert by id into `tree.reports`, write
    `db.trees.update(treeId, { reports })`, then `set` with a new `trees` array (same shape
    as `renameTree`, `:686`). Memory first, then the write in try/catch, reporting to
    `storageStatusStore` on failure (same rule as spec phase 1 of the front-door spec).
  - `deleteReport(treeId, reportId)`.
- **Tests:** save, update, delete; quota failure leaves memory updated and sets
  `writeFailure`.
- **Done when:** reports survive `loadAllTrees()`.

### 1.6 Generate and stream

- **Files:** `src/store/useReportStore.ts`, `src/lib/reportBrief.ts` (new),
  `src/store/useReportStore.test.ts`
- **Change:**
  - `DEFAULT_BRIEF` in `reportBrief.ts`: write one cohesive document for a reader who did
    not see the conversation; build one line of argument, do not summarize branch by branch;
    where branches disagree, say so and give both positions; if one is clearly better
    supported, say which and why; do not invent facts not in the transcript; open with a
    `#` title.
  - `generate({ brief, provider, model })`: check `reportWriterStatus` (1.3), build
    payload (1.1), check fit (1.2). Blocked or not fitting → set `error` ("Too big for
    <model>: ~N tokens, limit M") and stop. Otherwise stream with `streamLLMResponse`. Live
    text in `liveText: string | null` (never on the record), coalesced with
    `createTokenCoalescer`. On done: `saveReport` with tokens, digest, title. On error:
    save with `status: 'error'`. `cancel()` aborts and keeps partial text as an error
    report "Stopped".
- **Tests:** mocked `streamLLMResponse` — done saves the record with tokens and digest;
  error saves an error record; too-big and Ollama never call the stream; cancel keeps
  partial text.
- **Done when:** state-level generation works end to end.

### 1.7 Report panel: compose

- **Files:** `src/components/ReportPanel.tsx` (new), `src/components/ReportComposer.tsx`
  (new), `src/App.tsx`, `src/components/ReportComposer.test.tsx` (new)
- **Change:**
  - `ReportPanel`: right-side panel, same frame as `ReaderPanel`, mounted next to it in
    `App.tsx`. Opens from the header button. Shows the composer when there is no report or
    "New report" is pressed; otherwise the view (1.8).
  - `ReportComposer`: "N branches · M turns selected", the brief in a textarea prefilled
    with `DEFAULT_BRIEF` (Reset link), `ModelSelect` for OpenRouter models (defaults to the
    tree's default model when it is an OpenRouter one, else the global OpenRouter default),
    fit line ("~42k tokens of 128k · est. $0.03" / "Too big for this model"), Generate / Stop.
    Generate disabled with nothing ticked, when it does not fit, or when
    `reportWriterStatus` blocks (its message shown in place of the fit line).
- **Tests:** disabled states; fit line text for fits / too big / unknown; no-key message;
  Generate calls the store with the edited brief.
- **Done when:** a report can be written from the UI.

### 1.8 Report panel: read

- **Files:** `src/components/ReportView.tsx` (new), `src/lib/reportDownload.ts` (new),
  `src/components/ReportPanel.tsx`, `src/components/ReportView.test.tsx` (new)
- **Change:**
  - Render with `MarkdownContent` (throttled live text while streaming, like `ReaderResponse`).
  - Actions: Copy, Download `.md` (`<tree-slug>-report-<date>.md`, reusing the slug rule in
    `treeExport.ts`), Regenerate (same leaves, brief and model), Edit selection (re-enters
    selecting mode with these leaves), Delete.
  - Header line: model · tokens · cost · date. Amber "Sources changed since this was
    written" when `reportSourceDigest` of the current turns differs, or a leaf is gone.
  - A small list of past reports for this tree (title + date) when there is more than one.
- **Tests:** stale badge appears after a source turn's response changes; download builds
  the right filename; list switches reports.
- **Done when:** a report can be read, exported and regenerated.

### 1.9 Cost receipt line

- **Files:** `src/lib/treeCost.ts`, `src/components/CostReceipt.tsx`,
  `src/lib/treeCost.test.ts`
- **Change:** `reportsCostUSD(reports, catalog)` using `resolvePrice`. Receipt gets a
  "Reports · N · $X" row under the tree's actual line, excluded from the counterfactual
  and the saving.
- **Tests:** priced, unpriced, no reports (row hidden).
- **Done when:** report spend is visible and does not move the "saved" figure.

### 1.10 Export and import carry reports

- **Files:** `src/lib/treeExport.ts`, `src/lib/treeExport.test.ts`
- **Change:** `remapImportedTree` (`:170`) spreads `doc.tree`, so `reports` already travels
  — but its `leafIds` point at the old node ids. Remap them through the same `idMap`; drop
  ids that do not map. The digest has no ids (1.1), so it stays valid. Schema version stays
  1: the field is optional.
- **Tests:** round trip keeps the report and its leaves point at the new ids; an export
  from before this phase imports unchanged.
- **Done when:** export → import → the report opens and is not marked stale.

### 1.11 Close out

- **Files:** `docs/ROADMAP.md`, `docs/CHANGELOG.md`, `docs/STATUS.md`, `docs/ARCHITECTURE.md`
- **Change:** update the Track B entry (Phase 1 shipped), changelog line, STATUS sync,
  short "Reports" section in ARCHITECTURE.
- **Manual (deployed URL):** OpenRouter key: three branches of the demo tree → report;
  reload; export/import; regenerate one source turn → stale badge. A selection over a
  small-window model's limit is blocked before sending.
- **Done when:** `npm run check` green; docs match.

## Risks

- **Quality of the default brief decides whether this feels like a product or a dump.**
  Budget time in 1.6 to try it on the demo tree with two or three models and tune the
  wording. Record the final brief's rationale in the changelog line.
- **Tree row size.** Each report is a few KB to tens of KB. `submitPrompt` reads the tree
  row on every turn (`ARCHITECTURE.md` §3.1). Fine at a handful of reports. Revisit if a
  tree passes ~20.
- **Digest is length-based.** A regenerated answer of exactly the same length reads as
  unchanged. Rare enough to accept; a content hash costs a full-text pass per render.

## Shelved: Ollama as a report writer

Shelved 2026-10-11: no practical way to test Ollama on the dev machine. Lift it when there
is one. The work, when it comes back:

- `streamLLMResponse` gains `opts?: { numCtx?: number }`; Ollama sends
  `options: { num_ctx }` sized to the request. Without it, Ollama silently drops the
  oldest input.
- `fetchOllamaContextLength(baseUrl, model)` via `POST /api/show`, reading the
  `*.context_length` key of `model_info`, as the window for the fit check.
- Remove the `'ollama'` block from `reportWriterStatus`.
- Manual: a small model with a selection under its window, and check the report mentions
  the first turn (proof nothing was cut).
