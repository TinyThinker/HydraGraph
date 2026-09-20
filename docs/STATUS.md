# Project Status

> Hand-maintained snapshot. Update it directly whenever `ROADMAP.md` or
> `CHANGELOG.md` changes — there is no generator for this file.
> Last synced: 2026-09-20

---

## Version

Current: v0.6.0
Last commit: c9f37fb — 2026-09-20
Last commit message: feat: ship a no-key demo tree, seeded on first run
Merged to `main` as a four-commit v0.6.0 series (test fix · feature · two doc syncs).

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
- [ ] Static deploy; the landing page is the app with the demo preloaded
- [ ] Key setup in three steps with a live connection test; document the Ollama `OLLAMA_ORIGINS` gotcha where people hit it
- [ ] One honest line about where data lives, plus an export nudge after real work

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
- [ ] Edit a submitted prompt (not just regenerate)
- [x] Throttle the chat pane's Markdown re-parse — 40 parses per 40 tokens → 6 (v0.5.1)
- [ ] 200-node performance pass
- [ ] Pill labels truncated twice, low contrast off-path (`notes/node-labels-research.md` §2–3)
- [ ] No hover detail on a pill — `NodeToolbar` mount plan written (`notes/node-labels-research.md` §4)
- [ ] **OpenRouter never reports token usage** — `usage: { include: true }` has no effect (deprecated param); every real OpenRouter turn's cost receipt reads `$0.0000`. Found 2026-09-12, not yet fixed. See "Next Actions" — and note the demo tree now makes it worse by contrast: its receipt is populated, so a visitor's first real turn reads as a regression.
- [ ] `TurnNode.width` / `height` are vestigial since fixed-size pills — drop at the next schema bump (folded into the v6 persona-library migration)
- [x] Read-hook `--max-tokens` raised 800 → 3000 (2026-09-20).
- [x] `Read`-over-`Bash` read policy added to `CLAUDE.md` (2026-09-20). Verified
  same day in a fresh session: reading `src/store/useTreeStore.ts` produced a
  real (non-passthrough) trim in `~/.cache/trim-metrics.jsonl` under the new
  `limit: 3000`. See ROADMAP for the plan link.

---

## Active Blockers

None launch-blocking, but one demo-credibility issue is now sharper: **the cost
receipt reads $0.0000 on every real OpenRouter turn** (Ollama was always $0 by
design — this is new and affects the paid path). See Carried debt above. The demo
tree is unaffected — its numbers are derived from canned text and priced off
`BUNDLED_CATALOG` — which means a visitor who adds their own key watches a working
receipt go to zero. That asymmetry is the argument for fixing it before launch.

Phases 1–2 cleared the shipping blockers and built the deep-context arbitration
demo; Phase 3's catalog work and the no-key demo tree are done. What's left of
Phase 3 is the static deploy and honest onboarding copy.

---

## Next Actions (priority order)

1. Fix the OpenRouter usage-reporting gap so the cost receipt shows real numbers
   on real API calls, not just the demo tree's derived ones. Now the most visible
   defect a visitor can find: the demo's receipt works, theirs won't.
2. [Phase 3] Static deploy; the landing page is the app with the demo preloaded
   (the demo tree it preloads is done — `lib/demoTree.ts`, seeded by `App.tsx`)
3. [Phase 3] Key setup in three steps with a live connection test; document the Ollama `OLLAMA_ORIGINS` gotcha where people hit it
4. [Phase 3] One honest line about where data lives, plus an export nudge after real work

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
$0.2545 linear — 29% saved, 0 unpriced turns**. Nothing in the streaming, dispatch,
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
Surfaced but not yet fixed in this pass: OpenRouter never actually requests usage
data, so real-provider cost receipts read $0.0000 (see Active Blockers).
