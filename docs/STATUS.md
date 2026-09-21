# Project Status

> Hand-maintained snapshot. Update it directly whenever `ROADMAP.md` or
> `CHANGELOG.md` changes — there is no generator for this file.
> Last synced: 2026-09-21 (re-verified against source on 2026-09-20 — every open
> item below was checked against the code, not just re-read; updated again after
> Phase A of the launch plan, then after Phase B)

---

## Version

Current: v0.6.0, plus unreleased work on `main` (see CHANGELOG § Unreleased)
Last commit: 6fd65b1 — 2026-09-21
Last commit message: docs: record the missing CI gate as carried debt

The hub (launch plan Phase C) lives in a **separate repo** —
`TinyThinker/tinythinkerlabs-hub`, at `db6fce0` — and never affects this repo's
version, tests or deploys. **Live at `https://tinythinkerlabs.dev` since 2026-09-21.**
It deploys as an assets-only **Worker**; this app stays on **Pages**, which still works
and had no reason to move.
v0.6.0 merged as a four-commit series (test fix · feature · two doc syncs); the
commits on `main` since are unreleased — the counterfactual labelling, the receipt
exclusion fix, the pill-label pass, Phase A of the launch plan (deploy + CSP +
`no-transform`), and now Phase B (key hardening).

Test suite on `main`: **378 tests across 52 files**; `tsc -b` and `oxlint` clean.

---

## Phase Checklist

### Current State — Active blockers
- [x] Six built capabilities are unreachable from the UI — retry / cancel / regenerate reconnected via `MessageActions`; per-node model / persona rebuilt into the reader panel in Phase 2 (`NodeDispatchControls`)
- [x] Settings split-brain — `useTreeStore` no longer holds a settings copy; the "no provider configured" banner clears the moment a key is saved

### Phase 1 — Stop the bleeding (days 1–4)
- [x] Consolidate on `useSettingsStore`; delete the duplicate settings state in `useTreeStore`
- [x] Retry on errored nodes; regenerate on idle ones (rewire `submitPrompt`)
- [x] Cancel while streaming (rewire `cancelGeneration`)
- [x] Delete the unused `@dagrejs/dagre` dependency; wire or remove `openRouterBaseUrl` (wired)

### Phase 2 — Build the demo (days 5–9)
- [x] Per-node model picker and per-node persona, rehomed into the reader panel
- [x] Fan-out: one prompt → N branches, a different model or persona each, parallel from identical ancestry
- [x] Compare view: selected siblings column by column, shared-context guarantee visible on screen
- [x] Model pricing table → per-node, per-tree, and counterfactual cost in dollars

### Phase 3 — The front door (days 10–12)
- [x] OpenRouter + Ollama are the only providers (native Gemini removed; Dexie v5 remaps old `gemini` rows to `google/*` slugs); live OpenRouter `/api/v1/models` price catalog (IndexedDB-cached, 1 h TTL, bundled snapshot fallback); searchable priced model pickers replace hand-typed ids in reader panel / fan-out / Settings; one provider-linked credential field; fan-out cheap→frontier price-tier spread
- [x] Demo tree shipped with the app: canned responses, no key required, fully explorable, receipt already showing numbers — 16 turns / 4 forks, seeded on first run, priced off `BUNDLED_CATALOG` ($0.1794 vs $0.2545 linear, 29% saved)
- [x] Static deploy; the landing page is the app with the demo preloaded — **live at `https://hydragraph.tinythinkerlabs.dev` (2026-09-21)**, serving the CSP, `noindex` and `Referrer-Policy`, demo seeding cold, catalog fetch 200, **zero CSP violations and a silent console**. The edge-injected `static.cloudflareinsights.com` beacon was the last holdout; no dashboard toggle exists for it, so `Cache-Control: … no-transform` in `public/_headers` (A8) is what stops it — verified against the live response
- [ ] Key setup in three steps with a live connection test; surface the Ollama `OLLAMA_ORIGINS` gotcha **in the app** (it is already written up in `SETUP.md` §4 — what's missing is a hint next to the Ollama option, not the prose)
- [ ] One honest line about where data lives, plus an export nudge after real work (export itself already exists — `HeaderBar` → `downloadTreeExport`). **The key half shipped 2026-09-21** — `KeyGuidance` under the credential field (save it / scope it / early-build warning), the destination host named and flagged when it isn't `openrouter.ai`, and a "Forget key" button backed by `settingsStore.forgetApiKey`. What's left is the *trees* half: `navigator.storage.persist()` on first real write, `estimate()` for real numbers, the export nudge

### Phase 4 — Post it, then listen (days 13–14)
- [ ] Ship where people already think in tokens: local-model communities, BYOK power users, prompt engineers
- [ ] Lead with the comparison capture, not a feature list
- [ ] Reply to every person; ship one fix the same day, publicly
- [ ] Track one thing: who came back a second time, and what they did

### Later — Open track (gated on evidence from Phase 4)
- [ ] Track A — Deepen arbitration: persona presets (design ready, `notes/persona-library-plan.md`, Dexie v6), response diffing, per-branch model memory, cheap-first routing
- [x] ~~Track B — branch from a text selection~~ shipped in v0.5.1, pulled forward ahead of the gate
- [ ] Track B (remaining) — synthesis nodes whose context is the union of several chains
- [ ] Track C — Trust and reach: read-only shared tree links compressed into the URL; storage-health warnings; real backup
- [ ] Investigated, not scheduled: web search / tool calling (`notes/tooling-research.md`, Dexie v7); canvas node labels — rename + generated titles (`notes/node-labels-research.md`, no migration needed)

### Carried debt (none launch-blocking)
- [ ] **No CI — nothing runs the tests but a human** (checked 2026-09-21). No `.github/`, no workflow, no git hook. Cloudflare Pages deploys on push to `main` with build command `npm run build` (`tsc -b && vite build`), which type-checks but skips lint and all 378 tests. Wants a GitHub Actions workflow running `npm run check`, plus branch protection on `main` to make it binding. Cloudflare deploys; the gate belongs on GitHub, not in the build command
- [ ] Edit a submitted prompt (not just regenerate)
- [x] Throttle the chat pane's Markdown re-parse — 40 parses per 40 tokens → 6 (v0.5.1)
- [ ] 200-node performance pass
- [x] Pill labels truncated twice, low contrast off-path — **fixed 2026-09-20.** Two-line summary on a 64-char budget (`line-clamp-2` does the trimming, not the browser); `pillModelRef` gives fan-out siblings their model on its own row; quote-seeded branches label the question, not the quoted passage; off-path dim `opacity-40` → `opacity-70` (3.09:1 → 7.46:1); role label `slate-500` → `slate-400` (3.75:1 → 6.96:1). All three rows fit the existing 72 px pill — no geometry or layout change. (`notes/node-labels-research.md` §2–3)
- [ ] No hover detail on a pill — `NodeToolbar` mount plan written (`notes/node-labels-research.md` §4)
- [x] ~~**OpenRouter never reports token usage**~~ — **withdrawn 2026-09-20; the record was wrong, not the client.** Usage arrives unasked in the final SSE frame and `streamingClient` already parses (`:83`) and flushes (`:106`) it. Verified live: a real `deepseek/deepseek-v4-flash-0731` turn reports `1,701 in · 1,996 out · $0.0002`; tree receipt `$0.0025` vs `$0.0042` linear, 42% saved. No code change. Open only as an enhancement — the same frame carries `usage.cost`, `cached_tokens` and `reasoning_tokens` (ROADMAP, Carried debt).
- [x] Cost receipt mislabelled *why* a turn was excluded — a turn with no recorded tokens (errored / cancelled) read as "unknown model pricing". `treeCostSummary` now reports `unmeasuredTurns` separately (2026-09-20).
- [x] **The linear-thread counterfactual is an unlabelled estimate** — labelled 2026-09-20: `(est.)` on the row, `~` on every derived figure, assumptions in the panel, full caveat on hover. Also stopped claiming a *negative* saving on shallow trees (rendered `~$-0.0000 saved · ~-12%` in green).
- [ ] **The counterfactual arithmetic still uses a different ruler than the actual line** — four known biases, all flattering the branching story (chars/4 vs reported tokens, missing system prompt, dropped excluded turns, no cache discount). Fixable without an estimator by differencing `inputTokens` along a chain. ROADMAP has the detail. Do it when challenged.
- [ ] `TurnNode.width` / `height` are vestigial since fixed-size pills — drop at the next schema bump (folded into the v6 persona-library migration)
- [x] Read-hook `--max-tokens` raised 800 → 3000 (2026-09-20).
- [x] `Read`-over-`Bash` read policy added to `CLAUDE.md` (2026-09-20). Verified
  same day in a fresh session: reading `src/store/useTreeStore.ts` produced a
  real (non-passthrough) trim in `~/.cache/trim-metrics.jsonl` under the new
  `limit: 3000`. See ROADMAP for the plan link.

---

## Active Blockers

**None.** The one that stood here — "the cost receipt reads $0.0000 on every real
OpenRouter turn" — was withdrawn on 2026-09-20 after being checked against a live
tree. It was never true of the shipped client; the debt entry recorded a fix for a
parameter OpenRouter had already deprecated, and nobody re-ran the observation with
a key. Real turns report real tokens and real dollars.

The credibility question that replaced it — the receipt's *actual* line is measured,
its *linear thread* line is modelled, and the UI drew them identically — is closed as
of 2026-09-20. The estimate is labelled as one. Its arithmetic is still coarse, which
is now recorded honestly rather than hidden. See Carried debt.

Phases 1–2 cleared the shipping blockers and built the deep-context arbitration
demo; Phase 3's catalog work, the no-key demo tree and the static deploy are done,
as is the key half of the storage policy. What's left of Phase 3 is the three-step
key setup with a connection test, the in-app Ollama `OLLAMA_ORIGINS` hint, and
tree durability (`persist()` + export nudge).

---

## Next Actions (priority order)

Ordering rationale, with ROI and impact per item, lives in
[`notes/launch-priorities.md`](notes/launch-priorities.md).

***[`notes/launch-execution-plan.md`](notes/launch-execution-plan.md) is fully closed as
of 2026-09-21** — all three phases. The app is live at
`https://hydragraph.tinythinkerlabs.dev` (Phase A, Pages), key hardening shipped
(Phase B), and the hub is live at `https://tinythinkerlabs.dev` (Phase C, an
assets-only Worker in its own repo). Both URLs verified against the live response:
headers present, no injected beacon, silent console, zero CSP violations.*

1. [Phase 3] Key setup in three steps with a live connection test; surface the Ollama
   `OLLAMA_ORIGINS` gotcha in the app (the prose exists in `SETUP.md` §4)
2. [Phase 3] Storage policy — **the key half is done** (Phase B: guidance, destination
   host, "Forget key"). What remains is durability for trees, **re-ordered 2026-09-21
   after a cross-browser audit** (~1d): (1) `persist()` + `estimate()`; (2) export nudge
   with **browser-aware urgency**; (3) **restore on empty** — offer import instead of a
   blank canvas; (4) name `QuotaExceededError` as quota on the write paths; (5) fix
   `persistError` (`useTreeStore.ts:397`), which answers a failed write with another
   write and throws an unhandled rejection in exactly the quota case it exists for.
   - Why the re-order: the app is **not** Chrome-only (nothing in `src/` is Chrome-gated;
     export *and* import both ship and round-trip), so File System Access is convenience
     on a working mechanism — yet the old plan gave Chrome the most help and **Safari,
     which has a 7-day storage timer, the least**. That also collides with Phase 4's
     "who came back a second time". Quota exhaustion turned out not to be the threat at
     all; eviction is.
   - Design + risk table: [`notes/storage-and-key-plan.md`](notes/storage-and-key-plan.md)
3. [Debt] **CI that actually runs `npm run check`** — a GitHub Actions workflow plus
   branch protection on `main`. Today the only thing standing between a red test and
   the live site is remembering to run it; Cloudflare's build command type-checks and
   nothing more. Small, and it stops being optional the moment anyone else commits
4. [Debt] Record OpenRouter's reported `usage.cost` — cheap, and it strengthens the
   one number a skeptical reader will poke at
5. [Debt, hub] **Two dashboard-only follow-ups, both deferred 2026-09-21 for time.**
   Neither touches code, neither lives in this repo, neither is blocking:
   - **`www.tinythinkerlabs.dev` does not resolve** (checked live — no connection). The
     apex works and is what every link points at, but people type `www`. Cloudflare
     *Rules → Redirect Rules*, 301 to the apex; needs a `www` DNS record to exist
   - **Search Console is not set up** for `tinythinkerlabs.dev`. The hub shipped
     indexable but nothing is watching whether Google crawls it. DNS TXT verification,
     ~2 min, domain already in-account. Best done early rather than well — indexing
     takes weeks to start and the clock runs from verification, so deferring costs data
     rather than saving work
6. [Post-launch] File System Access autosave (~1d, Chrome/Edge) — a local file, not sync.
   **Demoted below the nudge 2026-09-21**; it also covers BYO-cloud for free, since
   `showSaveFilePicker()` can target a synced Drive/OneDrive folder
7. [Track C, declined for now] **BYO-cloud (Drive / OneDrive)** — technically viable with
   no backend (OAuth PKCE, narrow `drive.file` / app-folder scopes, we never hold the
   data). Held because it breaks "no third party", widens `connect-src`, and invites the
   sync request that the refuse list exists to hold back. Reasoning:
   [`notes/storage-and-key-plan.md`](notes/storage-and-key-plan.md) § BYO-cloud

---

## Key Constraints (always in force)

- Store mutating actions MUST be immutable — new object + new container references, or
  React Flow re-render locks (`CLAUDE.md`; `ARCHITECTURE.md` §7.2).
- In-flight streaming text lives in `useTreeStore.liveText` (keyed by node id), NOT on
  the node record — a token delta must never produce a new `TurnNode` object
  (`ARCHITECTURE.md` §5.3). As of v0.5.1, provider deltas are additionally coalesced
  into one store commit per animation frame (`createTokenCoalescer`), and Markdown
  re-parsing is throttled (`useThrottledText`, ~100 ms trailing) rather than firing
  per token.
- `useSettingsStore` is the single in-memory copy of the `global_settings` row
  (provider config + last-open-tree). `useTreeStore` reads it via
  `useSettingsStore.getState()` and never caches it.
- Providers are `'openrouter' | 'ollama'` only — native Gemini was removed in v0.5.0.
  GPT / Claude / Gemini / DeepSeek are reached as OpenRouter `vendor/model` slugs.
- Model prices come from `useCatalogStore` (live OpenRouter `/api/v1/models`, 1 h TTL,
  IndexedDB cache, `BUNDLED_CATALOG` fallback — the store is always non-empty).
  `pricing.ts` helpers (`resolvePrice` / `turnCostUSD` / `treeCostSummary`) stay pure
  and synchronous via an optional `catalog` arg that defaults to the store.
  `resolvePrice` builds a WeakMap-cached index per catalog (v0.5.1) instead of
  re-scanning ~300 models per turn, per render.
- Dispatch resolution precedence: node override (`providerOverride` / `modelUsed`) →
  tree default → global settings. Re-resolved on every submit; `submitPrompt` stamps
  the resolved `provider` and `modelUsed` back onto the turn (`ARCHITECTURE.md` §5.2).
  Model ids are free-text; the catalog feeds suggestions and pricing, not validation.
- Ancestry traversal reads the in-memory Zustand node map, never IndexedDB; the only DB
  read on the submit path is the tree record (`ARCHITECTURE.md` §3.1, §5.1).
- Canvas node positions are a pure function of tree structure — no manual placement to
  preserve; dragging and resizing are disabled (`ARCHITECTURE.md` §5.5). Selection
  state (`selected`) is now derived onto each node wrapper by `useCanvasGraph` from
  `useSelectionStore`, not written imperatively via `setNodes` (v0.5.1 fix).
- Max 150 lines per component file; separate UI rendering from store logic (`CLAUDE.md`).
- DB schema is at version 5; v5 adds the `catalog` object store and best-effort remaps
  legacy `gemini` provider/model values to `google/*` (`ARCHITECTURE.md` §3.4).
  New optional node fields (`providerOverride`) still need no migration. The next
  bump is planned as v6 (persona library, drops vestigial `width`/`height`), not yet
  started.

---

## Last Built (v0.6.0 — 2026-09-20)

The no-key demo tree. An empty browser now boots into a 16-turn metrics-pipeline
design session (`lib/demoContent.ts` + `lib/demoTree.ts`, seeded by `App.tsx`) —
4 forks, trunk 8 deep, a 3-model fan-out on one identical question, a 3-persona
fan-out on one DDL, and two late branches back to early turns. Token counts are
derived from the canned text through the real `resolveContextPayload`, priced off
`BUNDLED_CATALOG`, so with no key and no network the receipt reads **$0.1794 vs
$0.2545 linear — 29% saved, 0 unpriced turns** (with the live catalog, ~$0.1803 vs
~$0.2557 — live prices win where OpenRouter still lists the model). Nothing in the
streaming, dispatch,
pricing or export paths special-cases the demo; the only UI concession is
`ProviderBanner`, which explains instead of warning while the demo is open (and
trims `HeaderBar` back under 150 lines). `seedDemoTree()` is idempotent on fixed
ids, with "Reset demo tree" in the switcher as the way back. New `firstRun.test.tsx`
boots the real `<App/>` offline and asserts what a stranger sees. 337 tests across
49 files; `tsc` and `oxlint` clean. Also fixed one test that was already red on
`main` (`selectionSurvivesFinalize` waited 30 ms for a 100 ms Markdown throttle).

---

## Previously (v0.5.1 — 2026-09-12)

Branch from a selected passage (`SelectionBranchButton` + `useTextSelection`, draft
moved into `useComposerStore`), a streaming-performance pass (token coalescing +
throttled Markdown re-parse + memoized cost math — 40 parses/40 tokens down to 6),
and a fix for a defect where the chat pane blanked the instant any generation
finished (`selected` now derives from `useSelectionStore` instead of being written
imperatively in three places). 315 tests across 45 files; `tsc` and `oxlint` clean.
This pass also recorded "OpenRouter never actually requests usage data, so
real-provider cost receipts read $0.0000". That observation was withdrawn on
2026-09-20 — see Carried debt.
