# Hydra Graph — Re-Engineering: Final Consolidated Report

**Effort:** the five-phase re-engineering defined in `docs/plans/re-engineer.md`
**Branch:** `re-engineer`
**Completed:** 2026-08-31
**Phase summaries:** `docs/re-engineer-phase-1.md` … `docs/re-engineer-phase-5.md`

---

## 1. Headline status

| | |
|---|---|
| **`npm run check`** | **exit 0** — `tsc -b` clean, `oxlint` clean (zero warnings), **180 tests pass** across 21 files |
| **`npm run build`** | **clean** — CSS 39.93 kB (gzip 8.04 kB), JS 895.68 kB (gzip **279.73 kB**), one chunk over Vite's 500 kB raw warning |
| **DB schema** | **version 4** |
| **Tests** | 0 → **180** (Phase 1 established the runner with 14) |
| **Commits** | 59 `(phase-N)`-tagged commits on `re-engineer` (see §2), plus pre-plan scaffold |

Every task T1.1–T5.9 is committed one-per-task. No task is FAILED. Two tasks
(T3.1, T4.1) shipped at C+ and were not re-built for quality per the plan's
"record and move on" rule; their follow-ups are noted below.

> §1–§8 record the state at the end of the five-phase plan (180 tests). A post-plan
> addition — the OpenRouter provider and a Settings provider selector — is documented
> in **§9** and brings the suite to 183.

---

## 2. Commits per phase

`(phase-N)`-tagged commits (a few Phase 1–3 tags sit on pre-task scaffold commits):

| Phase | Theme | Tagged commits | of which `docs(phase-N)` | Tasks |
|---|---|---|---|---|
| 1 | Ground Truth & Safety Net | 15 | 3 | T1.1–T1.9 |
| 2 | Make The Core Loop Work | 13 | 2 | T2.1–T2.11 |
| 3 | The Render Path | 12 | 1 | T3.1–T3.8 |
| 4 | The Research Surface | 10 | 1 | T4.1–T4.9 |
| 5 | Workspace & Scale | 9 | 1 | T5.1–T5.9 |
| **Total** | | **59** | **8** | **46 tasks** |

(Plus this report, committed as `docs: add final re-engineering report`.)

### Phase 5 commits

```
d8d0a4a feat(phase-5): auto-layout new branches with dagre
69182bb feat(phase-5): manual re-layout command in the header
7dbfd47 feat(phase-5): multi-tree switcher with create/rename/delete
6355426 feat(phase-5): advance tree updatedAt only on real content changes
8ed5878 feat(phase-5): search the active tree from the header
d2e8568 feat(phase-5): export a tree to JSON
d98228b feat(phase-5): import a tree from JSON
52113ca feat(phase-5): context size awareness on cards and in the reader
9fd610d feat(phase-5): persist canvas viewport per tree, add keyboard navigation
d87077f docs(phase-5): add phase 5 summary and grades
```

---

## 3. Test count history

| After phase | Total tests | Δ | Coverage added |
|---|---|---|---|
| 1 | 14 | +14 | context engine (9), store node ops (4), smoke (1) |
| 2 | 30 | +16 | stream chunk buffering / multi-part, settings, provider routing, zombie recovery, cancel, error surfacing |
| 3 | 34 | +4 | render-tally measure, render-budget regression lock, text cap |
| 4 | 102 | +68 | markdown/code, resizable card, reader panel, edit/regenerate, delete subtree, stale cascade, override editor, collapse/expand, model picker |
| 5 | **180** | +78 | auto-layout, re-layout, tree switcher CRUD, honest updatedAt, search, export secret-scan, import validation/remap, context estimate, keyboard nav |

---

## 4. Grade table — every task T1.1–T5.9

Grades are quoted from the five phase summaries.

### Phase 1 — Ground Truth & Safety Net

| Task | Grade | One line |
|---|---|---|
| T1.1 Add a test runner | A | Vitest + jsdom + RTL + fake-indexeddb; clean |
| T1.2 Add the `check` script | A | Exact `tsc && lint && test` chain, fail-fast |
| T1.3 Remove unused Google SDK | A | Zero imports confirmed, no replacement added |
| T1.4 Correct stack docs | A | React 19 / Zustand 5 / TS 6 / Vite 8; no downgrade |
| T1.5 Track the status document | A | Un-ignored and rewritten honestly |
| T1.6 Test the context engine | A | 9 cases; no bug found; engine untouched |
| T1.7 Make the settings row durable | A | Every persist path writes a full row |
| T1.8 Fix the boot race | A | Synchronous ref latch; lint warning gone; StrictMode kept |
| T1.9 Test the store's node operations | A | Immutability + no-op contracts locked |

### Phase 2 — Make The Core Loop Actually Work

| Task | Grade | One line |
|---|---|---|
| T2.1 Settings panel | A− | Modal + header; MaskedInput split reported |
| T2.2 First-run guidance | A | Non-blocking inline banner, dismiss-by-configuring |
| T2.3 Fix stream chunk buffering | A | Cross-read buffer + streaming decoder, both readers |
| T2.4 Extract all parts from chunks | A | Every Gemini text part emitted in order; `thought` skipped |
| T2.5 Move the API key out of the URL | A | Now only in IndexedDB + `x-goog-api-key` header |
| T2.6 Explicit provider routing + per-node model (schema v2) | A− | Routes on `settings.provider`; node model threaded; v2 backfill |
| T2.7 Persist streaming progress incrementally | A− | Throttled writer + terminal flush + error persist |
| T2.8 Store and surface stream errors | A | Persisted `errorMessage`, shown as safe plain text |
| T2.9 Recover zombie streaming nodes on load | A | One transaction, partial text kept |
| T2.10 Cancel a running generation | A | Transient abort registry, cleaned on every terminal path |
| T2.11 Document local provider setup | A | `OLLAMA_ORIGINS` section with exact dev value |

### Phase 3 — The Render Path

| Task | Grade | One line |
|---|---|---|
| T3.1 Build a render-cost harness | C+ | Works and DEV-gated, but the baseline/seed wiring was rough |
| T3.2 Replace whole-store subscriptions with selectors | A | Exactly the change, nothing else touched |
| T3.3 Decouple streaming text from node identity | A | The crux task; single-owner `liveText` map, immutable |
| T3.4 Stabilise derived node/edge arrays | B+ | Right architecture; builder's test was thin |
| T3.5 Fix drag-vs-store sync | A− | Clean pure merge helper; updates preserved by design |
| T3.6 Clean up canvas timers | A− | Flush-then-clear on unmount |
| T3.7 Cap long response text in cards | A | Rendered view capped at 2 000 chars; stored text whole |
| T3.8 Lock in the render budget with a test | A− | Regression lock proven to fail if a whole-store sub returns |

### Phase 4 — The Research Surface

| Task | Grade | One line |
|---|---|---|
| T4.1 Render markdown and code | C+ | Scaffolding sound; builder shipped a real rendering bug, since patched |
| T4.2 Resizable cards (schema v3) | B− | Schema bump + resize + persist landed; rough edges |
| T4.3 Full-text reader panel | A− | Genuinely outside the RF viewport; both open paths |
| T4.4 Edit prompt and regenerate | A− | Four-state UI, single generation entry point |
| T4.5 Delete a node and its subtree | A− | Immutable, single-transaction, counted confirmation |
| T4.6 Mark descendants stale (extends v3) | A− | Reusable action T4.7 reuses; no auto-regeneration |
| T4.7 System prompt override editing | A− | Resolve-at-parent inherited view, clear-to-inherit |
| T4.8 Collapse and expand subtrees | A− | Full-ancestor hidden-set, both arrays filtered |
| T4.9 Per-node model selector | A− | Badge→picker; per-provider list + default + current + free-text |

### Phase 5 — Workspace & Scale

| Task | Grade | One line |
|---|---|---|
| T5.1 Auto-layout on branch creation | A− | dagre; new child anchored to parent's real position (dispatcher fix) |
| T5.2 Manual re-layout command | A− | One-transaction relayout + `CanvasFitter` viewport re-fit |
| T5.3 Tree switcher | A− | Create / switch / rename / delete, last-tree guard, cascade delete |
| T5.4 Keep `updatedAt` honest | A− | `touchActiveTree` on content changes only, DB + memory |
| T5.5 Search across the active tree | A− | Header search → pan/zoom + auto-expand collapsed ancestors |
| T5.6 Export a tree | A | Versioned JSON, no secrets (verified two ways) |
| T5.7 Import a tree | A− | Validate-before-write, fresh ids, all-or-nothing transaction |
| T5.8 Context size awareness | B+ | Estimate + real token counts + non-blocking warning; helper extracted on review |
| T5.9 Viewport persistence + keyboard nav (schema v4) | A− | Per-tree pan/zoom restore + arrow/`b`/`r` shortcuts |

**Distribution:** A ×15, A− ×24, B+ ×2, B− ×1, C+ ×2, C ×0 across 46 tasks.

---

## 5. Database schema — full field history

Indexes are **unchanged across all four versions**:
`nodes: 'id, treeId, parentId, timestamp'` · `trees: 'id, createdAt, updatedAt'` ·
`settings: 'id'`.

| Version | Task(s) | `.upgrade` backfill on existing rows |
|---|---|---|
| **1** | pre-plan base | — (no upgrade) |
| **2** | T2.6 | `settings.provider` = `'gemini'` if a Gemini key is configured else `'ollama'`; `nodes.provider` = same inference from the first settings row; `nodes.errorMessage` = `''` |
| **3** | T4.2 + T4.6 (one shared bump) | `nodes.width` = `320`; `nodes.height` = `240` (T4.2); `nodes.stale` = `false` (T4.6) |
| **4** | T5.9 | `trees.viewportX` = `0`; `trees.viewportY` = `0`; `trees.viewportZoom` = `1` |

Corresponding type additions:
- `TurnNode`: `provider?`, `errorMessage?` (v2); `width?`, `height?`, `stale?` (v3).
- `ConversationTree`: `viewportX?`, `viewportY?`, `viewportZoom?` (v4).

All added fields are optional in the type; the `.upgrade` step is what guarantees
old rows carry a value. **Migrations against a real prior-version database have not
been exercised** in the test suite (fake-indexeddb starts at the current version) —
see §6 PENDING HUMAN, one item per bump.

---

## 6. Consolidated PENDING HUMAN VERIFICATION master list

Nothing below has been run end-to-end in a browser against a live provider. Each
phase summary carries the same items with full prose; steps here are the executable
core. Configure a real Gemini key and/or a reachable Ollama (`OLLAMA_ORIGINS=http://localhost:5173 ollama serve`) first.

### Phase 1

1. **T1.7 — settings row on first load.** Clear site data → load → DevTools → Application → IndexedDB → `HydraGraphDB` → `settings`: exactly one `global_settings` row with `defaultModel` + `ollamaBaseUrl` populated, present before any tree exists.
2. **T1.8 — one tree on a fresh dev load.** Clear site data → `npm run dev` → load once → `trees` has exactly one row, `nodes` one root row (no StrictMode duplicate).

### Phase 2

3. **T2.1 — key survives reload.** Gear → type a Gemini key → Save → reload → reopen gear → key still shown; `settings.geminiApiKey` holds it.
4. **T2.2 — first-run banner.** Clear site data → load → amber "no provider" banner → save any key → banner gone without reload.
5. **T2.5 — key not in URL.** Real key, send a prompt → Network → the `…:streamGenerateContent?alt=sse` request URL has no `key=`; `x-goog-api-key` header carries it; response streams.
6. **T2.6 — explicit provider routing.** Configure a Gemini key AND an Ollama URL. Edit `settings.provider` to `"ollama"` in DevTools → reload → send → Network shows `<ollamaBaseUrl>/api/chat`. Set back to `"gemini"` → request goes to `generativelanguage.googleapis.com`.
7. **T2.6 — v1 → v2 migration.** On a pre-`35972d3` build create a tree + nodes; check out HEAD, load → DB version 2; every `settings`/`nodes` row has `provider`; every `nodes` row has `errorMessage: ""`; no data lost.
8. **T2.7 — partial text survives a mid-stream reload.** Send a long prompt, wait ~3 s, reload → the card shows the text that had arrived (plus the T2.9 interrupted treatment).
9. **T2.8 — provider error persists.** Save a wrong key → send → red error panel with the provider's actual message → reload → still shown.
10. **T2.9 — no permanent "streaming" card.** Start a generation, reload mid-stream → card shows the interrupted error + partial text, never a pulsing cyan border.
11. **T2.10 — Cancel aborts.** Start a long generation → Cancel → token arrival stops within a frame; Network shows the request cancelled; partial text persists across reload.
12. **T2.11 — Ollama origin instructions.** From a shell with `OLLAMA_ORIGINS` unset, a generation fails instantly with a console CORS error; following the README section makes it stream.

### Phase 3

13. **T3.1 / exit — 50-node frame rate.** `window.__hydraSeedFiftyNodes()` → `window.__hydraRenderTally.enable()` + `.reset()` → stream one node → `.get()`: every other id stays 0; pan/zoom stays smooth.
14. **T3.4 — drag re-renders only the dragged card.** Tally enabled/reset → drag one node → only its count moved.
15. **T3.5 — drag while streaming.** Start a generation, drag that node while tokens arrive → text keeps growing; no snap on release.
16. **T3.6 — unmount race.** Drag a node, then within ~300 ms switch trees (Phase 5 switcher) → position persisted on reload; no "setState on unmounted component" warning.
17. **T3.7 — long-response cap.** Let an answer reach ~10k tokens → card shows a bounded scroll box + "Showing the last 2,000 characters…"; canvas stays smooth.

### Phase 4

18. **T4.1 — markdown & code.** A response with headings, a table, a fenced code block → rendered styled + highlighted; per-block Copy works; a link opens in a new tab; no raw HTML executes.
19. **T4.2 — resizable cards.** Select a card, drag a resize handle, reload → size kept; cannot shrink past the footer controls.
20. **T4.3 — reader panel.** Long (>2000-char) response → card shows the truncation notice → "Open full text" and double-click both open the right-hand panel with the whole response; Copy + Escape work; pan/zoom doesn't move the panel.
21. **T4.4 — edit / regenerate.** Wrong key → send → error; fix key → Regenerate on the errored node → streams; Edit a prompt, Save & run → new prompt streams.
22. **T4.5 — delete subtree.** 3-level tree → Trash on a middle node → confirmation names the right count → Remove → DevTools `nodes`: only that node + descendants gone, parent's `childrenIds` fixed; root's Trash disabled.
23. **T4.6 — stale cascade.** 3-level chain → edit the root prompt → both descendants dim + show the amber badge → regenerate the middle one → only its badge clears.
24. **T4.7 — per-branch personas.** Two siblings under one parent, distinct overrides (amber Shield badge each) → same prompt to both → responses reflect the different personas; setting an override does not re-run an existing answer; "Clear override" restores inheritance.
25. **T4.8 — collapse/expand.** Nested collapsed branch → collapse the outer node → whole subtree hides, "Show N hidden" with correct N (all depths) → expand → inner collapsed state preserved; a generation on a hidden node still completes and persists.
26. **T4.9 — per-node model.** Two siblings, two models (one curated, one free-text) → generate both → Network: each request names the model on its own badge; badge inert while streaming.
27. **T4.2/T4.6 — v2 → v3 migration.** On a pre-`4e4a554` build create a tree + nodes; check out HEAD, load → DB version 3; every `nodes` row has `width: 320`, `height: 240`, `stale: false`; no data lost.

### Phase 5

28. **T5.1 — auto-layout.** Tree 3 levels deep, 3 children under each of two parents → no cards overlap.
29. **T5.2 — manual re-layout.** Drag nodes into a mess → header LayoutGrid button → confirm → tidy tree, viewport re-fits, positions survive reload.
30. **T5.3 — tree switcher.** Create 3 trees with distinct content → switch among them → reload → last active restored with correct content; dropdown closes on outside click; deleting the last tree leaves one fresh empty tree.
31. **T5.4 — honest `updatedAt`.** Edit an older tree's prompt → it jumps to the top of the switcher; dragging/resizing a node does not reorder it.
32. **T5.5 — search.** Seed a large tree → search a term in one deep node → canvas pans/zooms to it and it highlights; a match under a collapsed branch auto-expands; typing in the search box does not trigger keyboard nav.
33. **T5.6 — export.** Export a tree → open the `.json` → node count matches; a text search for your real API key finds nothing.
34. **T5.7 — import.** Export a 3-level tree → Clear site data → Import → structure/text/positions/overrides match. Import the same file twice → two independent trees. A file with a hand-edited `schemaVersion` or a broken parent ref → rejected with a clear message, nothing written.
35. **T5.8 — context size.** ~10-deep chain with long responses → "~N tokens of context" grows with depth, amber warning appears past ~6000; Send/Regenerate never disabled; after a real generation the card + reader panel show the actual in/out token counts.
36. **T5.9 — viewport + keyboard.** Pan to a deep corner, reload → same view (not fit-to-graph). Switch trees and back → each keeps its own view. Navigate a 3-level tree with only `↑ ↓ ← →`, viewport follows. `b` → child appears auto-laid-out; `r` → reader panel opens. No shortcut fires while the prompt textarea or search box is focused.
37. **T5.9 — v3 → v4 migration.** On a pre-`9fd610d` build create a tree; check out HEAD, load → DB version 4; every `trees` row has `viewportX: 0`, `viewportY: 0`, `viewportZoom: 1`; no data lost.

---

## 7. Known limitations

1. ~~**No provider-selector control (recommended follow-up #1).**~~ **RESOLVED
   2026-08-31, post-plan** — see §9. The Settings modal now has a Provider dropdown
   (Gemini / OpenRouter / Ollama) whose explicit choice wins over the key-based
   fallback derivation, and `streamOpenRouter` is implemented (OpenAI-compatible SSE,
   `Authorization: Bearer` header, incremental tokens + usage + cancel). The
   "compare models/personas side by side" capability is now reachable from the UI.
2. **Tree-level `defaultSystemPrompt` has no editor.** Every tree is seeded with
   "You are a helpful AI research assistant."; it can only be changed per node
   (override) or in DevTools.
3. **Bundle size.** One ~896 kB raw / **~280 kB gzip** JS chunk, over Vite's 500 kB raw
   warning. `react-markdown` + `rehype-highlight` + `@dagrejs/dagre` dominate. No
   code-splitting / lazy-loading was in scope.
4. **Search** covers only the loaded (active) tree, and the result "highlight" is a
   React-Flow selection outline rather than a bespoke ring.
5. **`estimateContextTokens`** runs an unguarded ancestry walk per store mutation per
   visible card. It causes no re-render (returns a stable primitive) and is cheap
   (pointer walk + length sums), but it is O(N·depth) per mutation.
6. **Viewport-persist race (T5.9).** During a tree switch, if `db.trees.get` for the
   incoming tree resolves slowly while `transform` changes, the outgoing tree's
   viewport could be written onto the incoming row. Window is a few ms and
   self-corrects on the next pan.
7. **Auto-layout only positions new nodes.** A tree the user has dragged around can
   accumulate mild overlap across many branch creations until they run "Tidy layout".
8. **Schema migrations are not exercised against real prior-version databases** in the
   suite (fake-indexeddb starts current). Three PENDING HUMAN items cover v1→2, v2→3,
   v3→4.
9. **No CI.** `npm run check` is the gate but nothing enforces it on push.
10. **T3.1 and T4.1 shipped at C+.** T3.1's harness works but its wiring was rough;
    T4.1's markdown renderer shipped a bug that was patched later in Phase 4. Neither
    was re-built (plan rule: record and move on).

---

## 8. Is the product actually working now? — honest assessment vs Part 1

Part 1 of the plan listed ten structural failings (A–J). Status after five phases:

| Part 1 finding | Status | Where |
|---|---|---|
| **A** Streaming repaints the whole graph at token frequency | **Fixed**, locked by `renderBudget.test.tsx` | Phase 3 (T3.2–T3.4, T3.8) |
| **B** Streaming state not durable; zombie `streaming` rows; no cancel | **Fixed** | Phase 2 (T2.7–T2.10) |
| **C** A node is a one-shot dead end (no edit/retry/delete) | **Fixed** | Phase 4 (T4.4, T4.5, T4.8) |
| **D** App can't be configured; settings row fragile | **Mostly fixed** — modal + durable row + first-run banner; residual = no provider picker | Phases 1–2 (T1.7, T2.1, T2.2) |
| **E** Stream parser drops data at chunk boundaries; mangles multi-byte | **Fixed** | Phase 2 (T2.3, T2.4) |
| **F** Per-node model is a lie; provider routing is a coin flip | **Partially fixed** — per-node model is now actually sent and pickable; provider routing is explicit but only settable via DevTools | Phases 2, 4 (T2.6, T4.9) + limitation #1 |
| **G** Research features absent (markdown, collapse, personas, layout, switcher, search, export/import) | **Fixed** | Phase 4 + Phase 5 |
| **H** Doc drift; zero tests | **Fixed** — 180 tests, `npm run check`, docs corrected, status doc tracked | Phase 1 |
| **I** First-run boot race under StrictMode | **Fixed** | Phase 1 (T1.8) |
| **J** Key in URL; `OLLAMA_ORIGINS` undocumented; timers; drag-sync | **Fixed** | Phases 2–3 (T2.5, T2.11, T3.5, T3.6) |

**Bottom line.** Every structural defect in the diagnosis has an implemented fix with
headless test coverage, and the test suite (180, `renderBudget` lock included) is a
real net where there was none. The architecture is now internally consistent: durable
streaming, a render path that survives a large graph, recoverable error states,
readable output, and a portable multi-tree workspace.

What has **not** happened is a single end-to-end human run against a live Gemini or
Ollama endpoint. The entire §6 list — ~37 items including all four schema migrations —
is unverified in a browser. Confidence is high (each has a passing headless proxy),
but "the product works" is, formally, still a prediction rather than an observation.

The one genuine product gap, not a bug, was the **provider selector** (limitation #1).
It has since been closed (§9). The remaining recommended follow-ups are a tree-level
`defaultSystemPrompt` editor and a bundle-splitting pass.

---

## 9. Post-report addendum — 2026-08-31

Done directly after the plan, at the user's request, outside the five-phase structure.

**OpenRouter provider + Settings provider selector.**

| | |
|---|---|
| `src/lib/streamingClient.ts` | New `streamOpenRouter` reader: `POST https://openrouter.ai/api/v1/chat/completions`, `Authorization: Bearer <openRouterApiKey>` header (no secret in the URL), OpenAI-style `{model, messages, stream:true}` body. Reuses the shared cross-read buffer + streaming-decoder + final-flush pattern; skips `:` SSE keep-alive comments; emits `choices[0].delta.content`; reads `usage.{prompt_tokens,completion_tokens}`; surfaces inline `{"error":…}` frames through `onError`. The `openrouter` branch of `streamLLMResponse` now calls it instead of throwing. |
| `src/components/ProviderSelect.tsx` | New 33-line presentational `<select>` (Gemini / OpenRouter / Ollama). |
| `src/components/SettingsModal.tsx` | Adds a `provider` draft field seeded from `settings.provider`, renders `ProviderSelect` at the top of the form, and passes `provider` explicitly to `saveSettings` (149 lines, under the ceiling). |
| Store | No change needed — `saveSettings` already honours an explicit `patch.provider` over key-based derivation; `submitPrompt` already threads `settings.provider` + the node's model into the streaming call. |
| Tests | +3 net (183 total): OpenRouter happy-path (Bearer header, split-frame reassembly, `[DONE]`, usage), OpenRouter keep-alive-comment skipping, and two store tests pinning explicit-provider-wins vs key-derivation fallback. The removed test was the old "reports not-implemented for openrouter". |
| Gate | `npm run check` green (183 tests); `npm run build` clean (~280 kB gzip, unchanged — no new deps). |
| Commit | `feat: implement OpenRouter provider and a Settings provider selector` |

**Still open:** OpenRouter has not been run against the live endpoint in a browser —
add to the §6 PENDING HUMAN list: *Provider → OpenRouter, paste a real key, send a
prompt; Network panel shows the request to `openrouter.ai/api/v1/chat/completions`
with the key only in the `Authorization` header; response streams; token counts
appear on the card.*
