# Re-Engineering — Phase 2 Summary: Make The Core Loop Actually Work

**Phase:** 2 — Make The Core Loop Actually Work
**Date:** 2026-08-31
**Branch:** `re-engineer`
**Plan:** `docs/plans/re-engineer.md` (Phase 2, tasks T2.1–T2.11)

## Final `npm run check` result

`npm run check` chains `tsc -b && npm run lint && npm run test` and exits **0**:

```
> hydra-graph@0.0.0 lint
> oxlint

> hydra-graph@0.0.0 test
> vitest run

 RUN  v4.1.11 /Users/osiris/dev/hydra-graph

 Test Files  4 passed (4)
      Tests  30 passed (30)
```

Lint clean (no warnings). 30 tests across 4 files (14 at the end of Phase 1, +16 in Phase 2):
smoke 1, contextEngine 9, streamingClient 10 (+7 new), useTreeStore 10 (+6 new).

Each task landed as its own commit, in order, `type(phase-2): ...`, no trailers:

```
bf4a37e feat(phase-2): add settings modal and header bar
9c8af78 feat(phase-2): first-run banner when no provider is configured
bf30430 fix(phase-2): buffer streaming reads across network chunk boundaries
e6cd7c2 fix(phase-2): emit every text part of a Gemini chunk
b8e8d66 fix(phase-2): send Gemini key in x-goog-api-key header, not the URL
35972d3 feat(phase-2): explicit provider routing, per-node model, schema v2
c517f67 feat(phase-2): persist streaming text incrementally with a throttled writer
93c77c9 feat(phase-2): store and surface stream errors on the node
8f5e997 feat(phase-2): recover zombie streaming nodes on tree load
f829254 feat(phase-2): cancel a running generation
234afda docs(phase-2): document OLLAMA_ORIGINS setup for local models
```

Every task was implemented by a builder sub-agent (haiku) from prose-only instructions,
then reviewed here: every changed file read, `npm run check` run, guardrails checked,
Verify performed as far as possible headlessly.

---

## T2.1 — Settings panel

- **Done:** New `src/components/SettingsModal.tsx` (142 lines) — a controlled modal
  (`{ open, onClose }`) that seeds a local draft from store `settings` on open (re-seeds
  via `useEffect` keyed on `open`), with fields for Gemini key, OpenRouter key, Ollama
  base URL, default model. The two key fields use a new `src/components/MaskedInput.tsx`
  (42 lines) with an independent `Eye`/`EyeOff` show/hide toggle each. Save trims and
  calls `saveSettings(draft)`; Cancel and the `X` discard. New
  `src/components/HeaderBar.tsx` shows the active tree title and a gear that opens the
  modal, owning the open/close state. `src/App.tsx` now returns
  `h-full flex flex-col` → `<HeaderBar/>` then `<div className="flex-1 min-h-0"><Canvas/></div>`.
- **Files changed:** `src/components/SettingsModal.tsx` (new), `src/components/MaskedInput.tsx` (new), `src/components/HeaderBar.tsx` (new), `src/App.tsx`.
- **`npm run check`:** clean, 14 tests (no new tests for this task).
- **Verify:** Automated — read every file: no key value reaches `console`, a URL, the
  document title, or any attribute other than an input `value`; keys live only in draft
  state and the input `value`. Save path calls `saveSettings`, which `db.settings.put`s
  the full row (durable per T1.7). **PENDING HUMAN:** open app → gear → type a Gemini
  key → Save → reload → gear → key still shown; DevTools → Application → IndexedDB →
  HydraGraphDB → settings → the `global_settings` row's `geminiApiKey` updated.
- **Grade: A-.** Meets everything; MaskedInput split was pre-authorised and reported.
  Minor: the `useEffect` re-seeds the draft whenever the store `settings` object
  changes while the modal is open, which would discard an in-progress edit if settings
  were mutated elsewhere mid-edit — a rare edge, not user-reachable today.
- **Deviations:** `MaskedInput.tsx` is a fourth file beyond the task's "two new
  components + App.tsx"; the task explicitly permitted one extra split file and it was
  reported.

## T2.2 — First-run guidance

- **Done:** `src/components/HeaderBar.tsx` gains a `settings` selector and a
  `needsProvider` boolean = no trimmed `geminiApiKey` AND no trimmed `openRouterApiKey`
  AND (`ollamaBaseUrl` empty or exactly the shipped default `http://localhost:11434`).
  When true, a persistent amber banner (`bg-amber-950/40 border-b border-amber-800/50`,
  `AlertTriangle`, "Open settings" button) renders below the bar. No close control —
  it clears only when a provider is configured. A code comment records that a real
  Ollama reachability probe is deferred; an untouched default URL counts as "not
  configured".
- **Files changed:** `src/components/HeaderBar.tsx`.
- **`npm run check`:** clean, 14 tests.
- **Verify:** Automated — logic read: fresh-install settings (no keys, default URL) ⇒
  banner shows; a saved Gemini key ⇒ `needsProvider` false ⇒ banner gone. **PENDING
  HUMAN:** clear site data → load → banner visible → Save a key → banner disappears
  without reload.
- **Grade: A.** Single file, non-blocking inline banner, dismiss-by-configuring only.
- **Deviations:** None.

## T2.3 — Fix stream chunk buffering

- **Done:** Both `streamGemini` and `streamOllama` in `src/lib/streamingClient.ts` now:
  carry a `buffer` string across reads; decode every chunk with `{ stream: true }` on a
  single long-lived `TextDecoder`; split the buffer on `\n` and process only complete
  lines, keeping the trailing fragment; after the read loop, flush-decode
  (`decoder.decode()`) and process any remaining buffer as a final line. Per-line logic
  moved into a local `processLine` helper shared by loop and flush. Both empty
  `catch {}` blocks now call `onError(new Error('Malformed stream payload: <snippet>'))`
  and continue (no abort). New `src/lib/streamingClient.test.ts` with 4 cases.
- **Files changed:** `src/lib/streamingClient.ts`, `src/lib/streamingClient.test.ts` (new).
- **`npm run check`:** clean, 18 tests.
- **Verify:** Automated and fully headless. Tests: "reassembles a frame split across two
  reads" (split mid-JSON ⇒ `Hello world` intact, no error); "preserves a multi-byte
  character split across two reads" (🎉 split mid-4-bytes ⇒ `party 🎉 done` intact, no
  `�`); "emits a final frame that has no trailing newline" (proves the post-loop flush);
  "reports a malformed data frame through onError without aborting" (`good` still
  emitted, `onError` called, `onDone` still called). All pass.
- **Grade: A.** Both readers fixed identically, incremental emission preserved,
  malformed frames surfaced not swallowed.
- **Deviations:** `streamingClient.test.ts` is a new file not named in the task's Files
  list; the task's Verify explicitly requires writing that unit test, so it is expected.

## T2.4 — Extract all parts from provider chunks

- **Done:** `streamGemini`'s `processLine` now iterates the whole
  `candidates[0].content.parts` array (guarded), emitting each `part.text` in order and
  `continue`-skipping any part with a truthy `thought` flag, instead of reading only
  `parts[0]`. Usage-metadata handling unchanged (last frame that carries it wins).
  `streamOllama` untouched.
- **Files changed:** `src/lib/streamingClient.ts`, `src/lib/streamingClient.test.ts`.
- **`npm run check`:** clean, 21 tests.
- **Verify:** Automated and fully headless. "emits every text part of a multi-part chunk
  in order" (`first ` then `second`, exactly two `onToken` calls); "skips parts flagged
  as thought" (only `visible answer`, never `MY HIDDEN REASONING`); "keeps usage
  metadata from the last frame that carries it" (`{inputTokens:5,outputTokens:9}`). All
  pass.
- **Grade: A.**
- **Deviations:** None.

## T2.5 — Move the API key out of the URL

- **Done:** `streamGemini`'s URL is now
  `.../models/<model>:streamGenerateContent?alt=sse` — no `&key=`. The key is sent as
  the `x-goog-api-key` request header (`settings.geminiApiKey || ''`), alongside
  `Content-Type: application/json`. Body, buffering, part extraction, abort unchanged.
- **Files changed:** `src/lib/streamingClient.ts`, `src/lib/streamingClient.test.ts`.
- **`npm run check`:** clean, 22 tests. `grep 'key=' src/lib/streamingClient.ts` → none.
- **Verify:** Automated. "sends the Gemini key in the x-goog-api-key header, not the URL"
  asserts the recorded `fetch` URL contains neither `SECRET-KEY-VALUE` nor `key=` but
  does contain `alt=sse`, and `headers['x-goog-api-key'] === 'SECRET-KEY-VALUE'`.
  **PENDING HUMAN:** with a real key configured, send a prompt, open DevTools → Network →
  the `streamGenerateContent` request → confirm the URL carries no secret, the request
  header does, and the response still streams.
- **Grade: A.** Secret now lives only in IndexedDB and the request header.
- **Deviations:** None.

## T2.6 — Explicit provider routing and per-node model (SHARED schema bump → version 2)

- **Done:**
  - `src/types/index.ts`: new `export type LLMProvider = 'gemini' | 'openrouter' | 'ollama'`;
    `AppSettings` gains required `provider: LLMProvider`; `TurnNode` gains optional
    `provider?: LLMProvider`.
  - `src/db/ChatDatabase.ts`: new `this.version(2).stores({...})` (indexes redeclared
    unchanged) with `.upgrade(tx)` that (a) sets `provider` on every existing settings
    row — `'gemini'` if that row has a `geminiApiKey`, else `'ollama'`; (b) infers a
    single provider for nodes from the (first) settings row's key presence and sets
    `provider` on every existing node row. This is the single shared bump; T2.8 extended
    the same upgrade (see below). No `version(3)`.
  - `src/lib/streamingClient.ts`: `streamLLMResponse(payload, settings, target, onToken,
    onDone, onError)` where `target: { provider: LLMProvider; model?: string }` is the new
    3rd arg. Routing is strictly on `target.provider`: `gemini` → `streamGemini`,
    `ollama` → `streamOllama`, `openrouter` → `onError(new Error('OpenRouter client not
    yet implemented'))` + no-op abort (branch intentionally unimplemented), anything else
    → `onError('Unknown provider: …')`. `model = target.model || settings.defaultModel`
    is threaded into both readers (Gemini URL path segment, Ollama body `model`).
  - `src/store/useTreeStore.ts`: `DEFAULT_SETTINGS.provider = 'gemini'`; `saveSettings`
    self-derives `provider` when the patch does not set one explicitly (`'gemini'` if a
    key is present, else `'ollama'` if an Ollama URL is present, else keep current) — an
    explicit `provider` in the patch always wins; `submitPrompt` records
    `provider: settings.provider` on the node and passes
    `{ provider: settings.provider, model: existing.modelUsed || settings.defaultModel }`;
    the streaming call is wrapped in try/catch so a synchronously-throwing provider is
    routed to the error path.
- **Files changed:** `src/types/index.ts`, `src/db/ChatDatabase.ts`, `src/lib/streamingClient.ts`, `src/store/useTreeStore.ts`, plus (pre-authorised, signature change) `src/lib/streamingClient.test.ts` and `src/store/useTreeStore.test.ts` for call-site updates.
- **`npm run check`:** clean, 24 tests.
- **Verify:** Automated (partial). "routes to Ollama when target.provider is ollama even
  though a Gemini key is present" — asserts the request goes to `/api/chat`, not
  `generativelanguage.googleapis.com`, with body `model: 'llama3'`. "reports
  not-implemented for the openrouter provider" — `onError` message contains "OpenRouter
  client not yet implemented", `fetch` never called. **PENDING HUMAN:** configure both a
  Gemini key and a local Ollama URL, then confirm in the Network panel that switching the
  provider sends the request to the selected host each way, and that a node's request
  names the model shown on its own badge. See "Outstanding" for the provider-picker gap.
- **Grade: A-.** Routing, per-node model, and the schema bump are all correct and no
  OpenRouter client was written. Caveats: (1) there is no UI to choose `provider`
  explicitly yet — on a fresh install it is `'gemini'`, and `saveSettings` only
  self-derives it, so forcing Ollama while a Gemini key is present currently needs a
  manual settings write or a later task; (2) the v1→v2 upgrade function is not exercised
  by any test (fake-indexeddb tests always start fresh at v2, where the upgrade does not
  run) — the cross-cutting rule to verify a migration against a prior-version database
  remains PENDING HUMAN.
- **Deviations:** Touched the two `*.test.ts` files outside the task's Files list; this
  was pre-authorised in the builder brief because the `streamLLMResponse` signature
  change forces its own call sites to update, and reported.

## T2.7 — Persist streaming progress incrementally

- **Done:** `src/store/useTreeStore.ts` gains a module-scope
  `pendingTimers: Map<string, timeout>` plus `scheduleThrottledFlush(id)` (trailing
  ~400 ms: if a timer exists, do nothing; else set one that reads the latest in-memory
  text and fire-and-forget `db.nodes.update(id, { assistantResponse })`, then deletes
  itself) and `cancelThrottledFlush(id)`. `appendTokenDelta` calls the scheduler after
  its in-memory update and stays synchronous. `finalizeNode` calls
  `cancelThrottledFlush(id)` before its existing synchronous final write. The stream
  error path is factored into a local `persistError(err)` shared by the `onError`
  callback and the try/catch: it cancels the flush and `await`s a
  `db.nodes.update(nodeId, { status: 'error', assistantResponse: <current text> })`
  (T2.8 later adds `errorMessage`), then updates memory immutably. Stream (re)start also
  cancels any stale timer.
- **Files changed:** `src/store/useTreeStore.ts`, `src/store/useTreeStore.test.ts`.
- **`npm run check`:** clean, 26 tests.
- **Verify:** Automated. "coalesces rapid token appends into a single DB write per
  window" (a,b,c → no sync write → after 450 ms `assistantResponse === 'abc'` → d →
  after 450 ms `'abcd'`, proving per-window re-arm); "finalizeNode cancels the pending
  throttled write and persists the final text" (append x → immediate finalize →
  `'x'` + `status: 'idle'`; +1 s → unchanged). Builder used real timers (fake timers
  conflicted with fake-indexeddb async) with ~450 ms waits. **PENDING HUMAN:** start a
  long real generation, wait a few seconds, reload — the partial answer is present on the
  card.
- **Grade: A-.** Correct throttle + terminal-path flush + error persistence. Minor: the
  tests wall-clock ~1.4 s because they use real timers.
- **Deviations:** None beyond the pre-authorised test file.

## T2.8 — Store and surface stream errors

- **Done:** `TurnNode` gains optional `errorMessage?: string`. The **same** schema
  `version(2)` upgrade from T2.6 was extended — its per-node loop now writes
  `{ provider: inferredProvider, errorMessage: '' }` (no `version(3)`). `persistError`
  now builds `message = err instanceof Error ? err.message : String(err)`, writes
  `{ status: 'error', assistantResponse, errorMessage: message }` to the row, and mirrors
  `status`/`errorMessage` into memory via an immutable `set`. `submitPrompt` sets
  `errorMessage: ''` when a node starts a new generation (memory + DB). `TurnNode.tsx`
  (109 lines) renders, when `status === 'error' && errorMessage`, a bounded scrollable
  red panel (`bg-red-950/40 border border-red-800/50`, `max-h-32 overflow-y-auto`)
  showing the message as plain interpolated text (no `dangerouslySetInnerHTML`).
- **Files changed:** `src/types/index.ts`, `src/db/ChatDatabase.ts`, `src/store/useTreeStore.ts`, `src/components/TurnNode.tsx`, `src/store/useTreeStore.test.ts`.
- **`npm run check`:** clean, 28 tests.
- **Verify:** Automated (via `vi.mock` of the streaming client). "persists error message
  to DB and in-memory state on stream error" (mocked `onError` with
  `Error('HTTP 401: invalid api key')` ⇒ row + memory `status: 'error'`, `errorMessage`
  contains "invalid api key"); "clears errorMessage when starting a new prompt" (next
  `submitPrompt` ⇒ `errorMessage === ''`). **PENDING HUMAN:** save a deliberately wrong
  key, send a prompt, read the provider's actual error text on the card, reload, confirm
  it persists.
- **Grade: A.** Rides the shared version 2, error surfaced as safe plain text,
  card under 150 lines (no split needed).
- **Deviations:** None beyond the pre-authorised test file.

## T2.9 — Recover zombie streaming nodes on load

- **Done:** `loadTree(treeId)` now, after reading the node array, finds every row with
  `status === 'streaming'` (none can be live right after a load). If any exist, a single
  `db.transaction('rw', [db.nodes], …)` rewrites each to
  `{ status: 'error', errorMessage: 'Generation was interrupted before it finished (the
  page was reloaded or closed).' }`, leaving `assistantResponse` untouched. The
  in-memory Map is built from a corrected copy (new object per stale node, others pass
  through). Zero stale nodes ⇒ no transaction, unchanged behaviour.
- **Files changed:** `src/store/useTreeStore.ts`, `src/store/useTreeStore.test.ts`.
- **`npm run check`:** clean, 29 tests.
- **Verify:** Automated. "rewrites stale streaming nodes to error on loadTree and keeps
  partial text" — a seeded `streaming` node with `assistantResponse: 'partial answer so
  far'` becomes `status: 'error'` with a non-empty `errorMessage` in both memory and DB,
  text unchanged; a seeded `idle` node is untouched (still idle, no `errorMessage`).
  **PENDING HUMAN:** start a generation, reload mid-stream, confirm the card shows the
  interrupted-generation error with its partial text and not a pulsing border.
- **Grade: A.** Single transaction, partial text preserved, non-streaming rows untouched.
- **Deviations:** None beyond the pre-authorised test file. Noted: `loadTree` is also the
  tree-switcher path, so switching away from and back to a tree that has a genuinely live
  in-session stream would also mark it interrupted; not in scope for Phase 2 (the abort
  registry from T2.10 is per-session and does not currently cancel on tree switch).

## T2.10 — Cancel a running generation

- **Done:** Module-scope `abortRegistry: Map<string, () => void>` (transient — never in
  Zustand state, never persisted). `submitPrompt` does `abortRegistry.set(nodeId, abort)`
  after `streamLLMResponse` resolves; the entry is deleted in `finalizeNode` (top),
  `persistError`, at stream (re)start, and in the cancel action. New action
  `cancelGeneration(id)` (added to the actions interface): invoke the handle, delete the
  entry, `cancelThrottledFlush(id)`, then `db.nodes.update(id, { status: 'idle',
  assistantResponse: <current text> })` and an immutable memory update to `status:
  'idle'` — partial text kept, status returns to idle (not error). `TurnNode.tsx`
  (120 lines) renders a red `Square`+"Cancel" button while `status === 'streaming'`.
- **Files changed:** `src/store/useTreeStore.ts`, `src/components/TurnNode.tsx`, `src/store/useTreeStore.test.ts`.
- **`npm run check`:** clean, 30 tests.
- **Verify:** Automated. "cancels streaming, preserves partial text, and returns to idle"
  — mocked `streamLLMResponse` returns an `abortSpy` and never completes; after
  `appendTokenDelta(rootId, 'partial text')` and `cancelGeneration(rootId)`: `abortSpy`
  called once, `status: 'idle'`, `assistantResponse === 'partial text'` in memory and DB;
  a second `cancelGeneration` does not throw and does not re-invoke the spy (entry
  removed). **PENDING HUMAN:** start a long real generation, click Cancel, confirm token
  arrival stops within a frame, the Network request is aborted, and the partial text
  survives a reload.
- **Grade: A.** Registry is transient, cleaned on every terminal path, card stays under
  150 lines.
- **Deviations:** None beyond the pre-authorised test file. Tiny known race: the registry
  entry is set just after `streamLLMResponse` resolves, so a cancel click in that
  sub-millisecond window before registration would not abort; not user-reachable in
  practice.

## T2.11 — Document local provider setup

- **Done:** New `### Using a local model (Ollama)` subsection in `README.md` under
  `## Getting Started` (after `### Build`): explains the browser cannot reach a local
  Ollama server until `OLLAMA_ORIGINS` allows the app origin; gives
  `OLLAMA_ORIGINS=http://localhost:5173 ollama serve` and the macOS background-service
  equivalent `launchctl setenv OLLAMA_ORIGINS "http://localhost:5173"` + restart; notes
  a different origin (e.g. `http://localhost:4173` for `preview`) must be added,
  comma-separated; states the failure symptom is an instant network/CORS error in the
  console, not a model error. No instruction to disable browser security.
- **Files changed:** `README.md`.
- **`npm run check`:** clean, 30 tests (docs-only).
- **Verify:** Automated — section re-read; self-sufficient for a reader whose generations
  fail instantly. **PENDING HUMAN:** from a shell where `OLLAMA_ORIGINS` is unset, follow
  the section and confirm a local model then streams.
- **Grade: A.**
- **Deviations:** None.

---

## Phase 2 Exit Criteria

Plan exit criterion: *every failure mode in diagnosis sections B, D, E, and F has a
recovery path exercised by hand at least once.* Headless automation stands in for the
"by hand" runs where a browser is not available; those are itemised under Outstanding.

| Diagnosis | Failure mode | Recovery path now exists | Exercised |
|---|---|---|---|
| **B** — streaming state not durable, no recovery | Partial text lost on reload | Yes — T2.7 throttled incremental DB writes (~2–3/s) | Headless: 2 throttle tests. Browser reload-mid-stream: **PENDING HUMAN** |
| **B** | Stream error left only in `console`, row stuck `streaming` | Yes — T2.8 persists `status: 'error'` + `errorMessage` to row and memory; card shows it | Headless: 2 error-surfacing tests. Bad-key + reload: **PENDING HUMAN** |
| **B** | Zombie `streaming` row after reload/close, no way out | Yes — T2.9 `loadTree` rewrites every stale `streaming` row to `error` (partial text kept) in one transaction | Headless: zombie-recovery test. Browser reload-mid-stream: **PENDING HUMAN** |
| **B** | Runaway generation, no cancel | Yes — T2.10 abort registry + `cancelGeneration` + card Cancel button | Headless: cancel test. Real abort in Network panel: **PENDING HUMAN** |
| **D** — app cannot be configured; settings row fragile | No settings UI | Yes — T2.1 settings modal + header gear; T1.7 (Phase 1) made the row durable | Headless: read-through of secrets handling; store durability covered in Phase 1. Key survives reload: **PENDING HUMAN** |
| **D** | Fresh user has no idea a provider is needed | Yes — T2.2 first-run banner, dismiss-by-configuring | Headless: `needsProvider` logic review. Fresh-install banner → dismiss: **PENDING HUMAN** |
| **E** — stream parsing drops data at chunk boundaries | Frame split across reads is dropped silently | Yes — T2.3 cross-read buffer + shared `processLine` + malformed→`onError` | Headless and **complete**: split-frame test |
| **E** | Multi-byte char split across reads corrupts output | Yes — T2.3 streaming `TextDecoder` + final flush | Headless and **complete**: split-emoji test |
| **E** | Gemini reads only `parts[0]`, multi-part chunks lose content | Yes — T2.4 iterate all parts, skip `thought` parts | Headless and **complete**: multi-part + thought-skip tests |
| **E** | (related, section J) key in URL query string | Yes — T2.5 moved to `x-goog-api-key` header | Headless: header/URL test. Network panel: **PENDING HUMAN** |
| **F** — provider routing is a coin flip; per-node model unused | Gemini-key user can never reach Ollama | Yes — T2.6 routes strictly on `settings.provider`; `saveSettings` self-derives it | Headless: Ollama-despite-key routing test. UI provider switch + Network confirmation: **PENDING HUMAN** (no provider-picker UI yet) |
| **F** | `modelUsed` badge shows a model that was never called | Yes — T2.6 threads the node's `modelUsed` into the request (`|| defaultModel`) | Headless: `model: 'llama3'` asserted in request body. Per-branch model comparison: **PENDING HUMAN** (per-node model picker is a Phase 4 task) |
| **F** | `openRouterApiKey` with no client behind it | Contained — T2.6 leaves `openrouter` as an explicit unimplemented branch reporting a clear error; no client written | Headless and **complete**: not-implemented test |

Net: a recovery path now exists for every B/D/E/F failure mode. Section E (and the T2.5
secret move, and the T2.6 routing/model-plumbing and OpenRouter containment) is fully
covered by headless tests. Sections B, D, and the user-facing half of F have their
recovery paths implemented and unit-tested at the store level, but their end-to-end
"by hand" confirmation needs a browser and a live provider — see Outstanding.

---

## Outstanding / handed to human

Every PENDING HUMAN VERIFICATION item, with exact steps.

1. **T2.1 — settings key persists across reload.** Load the app → click the header gear →
   type any string into "Gemini API key" → Save. Reload the page → click the gear again →
   the key is still shown. DevTools → Application → Storage → IndexedDB → `HydraGraphDB` →
   `settings` → the single `global_settings` row's `geminiApiKey` holds what you typed.

2. **T2.2 — first-run banner shows then dismisses.** Clear all site data → load the app →
   an amber "No LLM provider configured" banner is visible under the header → open
   settings, save any Gemini key → the banner disappears with no reload.

3. **T2.5 — key is not in the request URL.** With a real Gemini key configured, send a
   prompt. DevTools → Network → the `…:streamGenerateContent?alt=sse` request → confirm
   the request URL contains no `key=` and no key value; the `x-goog-api-key` request
   header carries it; the response streams token by token.

4. **T2.6 — explicit provider routing to the selected host.** Configure both a Gemini key
   and a reachable local Ollama URL. There is currently **no provider dropdown in the
   settings modal**, so set the provider explicitly by editing the `settings` row in
   DevTools (IndexedDB → `HydraGraphDB` → `settings` → `global_settings` → set
   `provider` to `"ollama"`), reload, send a prompt → Network panel shows the request go
   to `<ollamaBaseUrl>/api/chat`. Set `provider` back to `"gemini"`, reload, send a
   prompt → the request goes to `generativelanguage.googleapis.com`. (A provider picker
   in the modal is not a Phase 2 task; add it alongside the Phase 4 per-node model
   selector, T4.9.)

5. **T2.6 — migration from a version-1 database.** On a build from before commit
   `35972d3`, create a tree and a couple of nodes (writes v1 rows). Check out the current
   `re-engineer` HEAD and load the app. DevTools → IndexedDB → `HydraGraphDB`: the DB
   version is 2; every `settings` row and every `nodes` row now has a `provider` value
   (`"gemini"` if a Gemini key was configured, else `"ollama"`); every `nodes` row has
   `errorMessage: ""`. No data lost.

6. **T2.7 — partial text survives a mid-stream reload.** Configure a working provider,
   send a prompt that produces a long answer, wait ~3 s, reload the page. The node card
   shows the portion of the answer that had arrived before the reload (it will also carry
   the T2.9 "interrupted" error treatment).

7. **T2.8 — provider error text shows on the card and persists.** Settings → save a
   deliberately wrong Gemini key → send a prompt. The card shows a red error panel with
   the provider's actual message (e.g. an HTTP 400/403 body). Reload → the same message
   is still shown.

8. **T2.9 — no card pulses "streaming" after a reload.** Start a generation and reload
   the page while it is still streaming. After reload the card shows the
   interrupted-generation error and its partial text — never a permanently pulsing cyan
   border.

9. **T2.10 — Cancel actually aborts.** Start a long generation → click the red Cancel
   button on the card. Token arrival stops within a frame; DevTools → Network shows the
   `streamGenerateContent` / `api/chat` request as cancelled/aborted; the partial text
   stays on the card and survives a reload.

10. **T2.11 — the Ollama origin instructions work.** From a shell where `OLLAMA_ORIGINS`
    is unset, start Ollama and try a generation with the Ollama provider — it fails
    instantly with a console network/CORS error. Follow the new README section
    (`OLLAMA_ORIGINS=http://localhost:5173 ollama serve`, or the macOS `launchctl`
    variant + restart) → the same generation now streams from the local model.

---

## Final database schema version

**Version: 2.** One shared bump (`src/db/ChatDatabase.ts`), introduced by T2.6 and
extended in place by T2.8 — no `version(3)`. Its `.upgrade(tx)` step backfills:

- **`settings.provider`** — for every existing settings row: `'gemini'` if that row has a
  non-empty `geminiApiKey`, otherwise `'ollama'`.
- **`nodes.provider`** — for every existing node row: a single value inferred from the
  (first) settings row — `'gemini'` if it has a `geminiApiKey`, else `'ollama'`.
- **`nodes.errorMessage`** — for every existing node row: `''` (empty string default).

Table index strings are unchanged between version 1 and version 2 (`nodes: 'id, treeId,
parentId, timestamp'`, `trees: 'id, createdAt, updatedAt'`, `settings: 'id'`); the bump
exists solely to carry the upgrade function. Fresh installs are created directly at
version 2 (the upgrade function does not run) and get `provider` from
`DEFAULT_SETTINGS.provider = 'gemini'` / from `submitPrompt` writing
`settings.provider` onto each node as it generates.
