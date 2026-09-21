# Roadmap

> **Where this fits.** This is the **source of truth** for what happens next. The
> earliest unchecked `- [ ]` box in the earliest incomplete phase is "the next step".
> [`STATUS.md`](STATUS.md) is generated from this file. Strategy and rationale behind
> this plan live in [`notes/mvp-strategy.md`](notes/mvp-strategy.md) (competitive scan,
> positioning, instrumentation targets). **Why the remaining boxes are ordered the way
> they are** — ROI, user impact, infra impact, and the signals that would re-rank them
> — is in [`notes/launch-priorities.md`](notes/launch-priorities.md).

**Goal:** a public link in ~14 working days. Ship, then listen — do not keep polishing
in private. Positioning: *deep-context model arbitration* — compare several models/
personas at turn 30 of a real problem, on identical inherited context, with the cost.

---

## Current State

The engineering is largely done and tested (streaming, context engine, deterministic
layout, 5 clean DB migrations, 2 provider clients — OpenRouter + Ollama — 368 tests
across 51 files, `tsc` and `oxlint` clean as of 2026-09-20).
Phases 1–2 are complete — the first-run friction and the retry/cancel regression are
fixed, and the deep-context arbitration demo (fan-out, compare, cost receipt) is
built. The model-catalog work under Phase 3 is done; next up is the front door.

### Active blockers

- [x] **Six built capabilities are unreachable from the UI.** Retry / cancel /
  regenerate are back via the new `MessageActions` control (chat stream + reader
  panel). Per-node model and per-node persona are deliberately deferred to Phase 2,
  where they are rebuilt into the reader panel rather than revived. The six dead
  files (`PromptSection`, `SystemPromptEditor`, `ModelPicker`, `NodeFooter`,
  `ResponseArea`, `ContextMeter`) and their tests are deleted.
- [x] **Settings split-brain.** `useTreeStore` no longer holds a settings copy;
  `useSettingsStore` is the only one. Last-open-tree persistence moved there via
  `setActiveTreeId`. The "no provider configured" banner now clears the moment a
  key is saved — no reload.

---

## Phase 1 — Stop the bleeding (days 1–4)

Only the defects a stranger hits in their first two minutes.

- [x] Consolidate on `useSettingsStore`; delete the duplicate settings state in
  `useTreeStore`. Fixes the first-run banner.
- [x] Retry on errored nodes; regenerate on idle ones (rewire `submitPrompt`).
- [x] Cancel while streaming (rewire `cancelGeneration`).
- [x] Delete the unused `@dagrejs/dagre` dependency; wire or remove `openRouterBaseUrl`
  (wired: OpenRouter client reads it, Settings exposes it).

**Gate:** a wrong key, a rate limit, or a bad answer can never permanently damage a node.
✅ Retry always shows on an errored turn; Stop always shows while streaming.

---

## Phase 2 — Build the demo (days 5–9)

The five days that decide whether the project has a reason to exist.

- [x] Per-node model picker and per-node persona, rehomed into the reader panel.
- [x] Fan-out: one prompt → N branches, a different model or persona each, dispatched
  in parallel from identical ancestry.
- [x] Compare view: selected siblings column by column, with the shared-context
  guarantee visible on screen.
- [x] Model pricing table → per-node, per-tree, and counterfactual cost in dollars
  ("context you didn't pay for").

**Gate:** a 30-second capture of comparing three models at turn 30 makes an experienced
LLM user say "wait, do that again."

---

## Phase 3 — The front door (days 10–12)

Nobody installs anything, ever. That is the whole advantage — spend it.

- [x] OpenRouter + Ollama are the only providers (native Gemini removed; Dexie v5
  remaps old `gemini` rows to `google/*` slugs). Prices come from a live OpenRouter
  `/api/v1/models` catalog — IndexedDB-cached, 1 h TTL, with a committed bundled
  snapshot as the offline / first-run fallback. Searchable priced model pickers
  replace the hand-typed model-id inputs in the reader panel, fan-out, and Settings;
  one provider-linked credential field; fan-out can auto-fill a cheap→frontier price
  spread.
  - The demo tree's cost receipt (below) depends on these real prices, and the
    bundled snapshot is the catalog the no-key demo runs against.
- [x] Demo tree shipped with the app: canned responses, no key required, fully
  explorable, receipt already showing numbers.
  - `lib/demoContent.ts` (transcript) + `lib/demoTree.ts` (`buildDemoTree`,
    `DEMO_TREE_ID`). 16 turns, 4 forks, trunk 8 deep: a 3-model fan-out on one
    identical question, a 3-persona fan-out on one DDL, and two late branches that
    reach back to early turns. Seeded on first run by `App.tsx`; re-seedable and
    idempotent via `useTreeStore.seedDemoTree()` / "Reset demo tree".
  - Receipt: **$0.1794 vs $0.2545 linear, 29% saved**, 0 unpriced turns — token
    counts derived from the canned text via `resolveContextPayload`, priced against
    `BUNDLED_CATALOG` so it holds with no key and no network. With the live catalog
    loaded it reads ~$0.1803 vs ~$0.2557 (~30%): live prices win where OpenRouter
    still lists the model, and `resolvePrice` falls back to the snapshot for the two
    Anthropic models OpenRouter has since delisted.
  - No demo branch in the streaming / dispatch / pricing / export paths; the demo is
    ordinary rows. The only UI concession is `ProviderBanner`, which explains rather
    than warns while the demo is open.
- [ ] Static deploy; the landing page *is* the app with the demo preloaded.
  - **Live at `https://hydragraph.tinythinkerlabs.dev` (2026-09-21).** `public/_headers`
    ships the CSP (`connect-src` limited to OpenRouter and localhost), `X-Robots-Tag:
    noindex` and `Referrer-Policy: no-referrer`, all three confirmed on the live
    response; `__BUILD_SHA__` is stamped at build time and shown in the corner. The A3
    checklist passes against the live URL — demo seeds cold, receipt priced, catalog
    fetch 200.
  - **Open before this box ticks: the injected analytics beacon.** Pages injects
    `static.cloudflareinsights.com/beacon.min.js` at the edge, which `script-src 'self'`
    blocks — the only violation on the live site, and the CSP behaving correctly.
    Declined rather than allowed, for consistency with "no third-party script" rather
    than out of any threat from Cloudflare. **There is no dashboard toggle**: the
    injection toggle only exists once a site is opted *into* Web Analytics. The fix is
    `Cache-Control: public, max-age=0, must-revalidate, no-transform` in
    `public/_headers` (Cloudflare's documented opt-out) — shipped, pending a deploy to
    verify against the live response. See A8 in the execution plan.
  - **Execution plan: [`notes/launch-execution-plan.md`](notes/launch-execution-plan.md)**
    — three session-sized phases (deploy · key hardening · landing page), with the
    settled decisions and a do-not-do list so no session re-derives them.
  - Host is Cloudflare Pages; domain is `tinythinkerlabs.dev`, bought 2026-09-20 via
    Cloudflare Registrar so DNS is already in-account.
  - Layout: **the app at the root of `hydragraph.tinythinkerlabs.dev`** — no multi-page
    build, no `base`, no subpath. Projects are explained on the hub at the apex, so
    each project's URL is stable forever. Future projects get their own **subdomain** —
    subpaths share a browser origin, which would let one project's compromised
    dependency read another's IndexedDB.
- [ ] Key setup in three steps with a live connection test; surface the Ollama
  `OLLAMA_ORIGINS` gotcha **in the app**.
  - The prose is already written and good: [`SETUP.md`](SETUP.md) §4 covers the env
    var, the macOS `launchctl` variant, the instant-fail symptom, and a
    troubleshooting row. What is missing is a hint next to the Ollama option in
    Settings, where someone hits the wall. This item is smaller than it reads.
  - `SettingsModal` is currently a flat form (provider · credential · default model ·
    Save) with no step state and no connection probe anywhere in `src/`.
- [ ] One honest line about where data lives, plus an export nudge after real work.
  - Export already ships (`HeaderBar` → `downloadTreeExport`); only the sentence and
    the nudge trigger are missing.
  - **Scope revised 2026-09-20.** This was one checkbox covering two problems with
    opposite goals — trees want durability, the key wants minimal exposure — and they
    currently share one storage policy. Split, designed, and risk-rated in
    [`notes/storage-and-key-plan.md`](notes/storage-and-key-plan.md). The pre-launch
    slice grows from ~0.5d to ~0.75d and now changes the posture instead of just
    describing it:
    - Trees: call `navigator.storage.persist()` on first real write (never called
      today), `estimate()` for real numbers, export nudge at a real-work threshold.
    - Key: **persist by default** — an OpenRouter key cannot be retrieved after
      creation, so refusing to store it costs the user more than it protects them.
      Warn at the point of entry to save it in a password manager; recommend a
      dedicated key with a spend limit (blast radius, not secrecy, is the control);
      add a "Forget key" control; show which host the key will be sent to.
  - Deferred out of this box, tracked in the same note: File System Access autosave
    (~1d, Chrome/Edge, local file — *not* sync and *not* a backend); a CSP
    (`index.html` has none); passphrase / WebAuthn unlock (gated on Phase 4 demand);
    OAuth PKCE, which would dissolve the key-storage question entirely if OpenRouter's
    flow works as documented — verify before committing.

**Gate:** a stranger with no API key understands the product within one minute.

---

## Phase 4 — Post it, then listen (days 13–14)

- [ ] Ship where people already think in tokens: local-model communities, BYOK power
  users, prompt engineers.
- [ ] Lead with the comparison capture, not a feature list.
- [ ] Reply to every person; ship one fix the same day, publicly.
- [ ] Track one thing: who came back a second time, and what they did.

**Gate:** twenty strangers have used it and you know which capability brought the
returners back.

---

## Later — Open track (gated on evidence from Phase 4)

Nothing here ships until Stop-4 evidence says which one matters. See
[`notes/mvp-strategy.md`](notes/mvp-strategy.md) §7.

- [ ] **Track A — Deepen arbitration:** persona presets, response diffing, per-branch
  model memory, cheap-model-first routing with escalation. *(if fan-out is used repeatedly)*
  - Persona presets is pulled forward ahead of the Stop-4 gate: the current list is a
    hardcoded four-entry const and fan-out cannot take a custom persona at all. Design
    in [`notes/persona-library-plan.md`](notes/persona-library-plan.md) — global
    library + per-tree default, **Dexie v6** (which also drops the vestigial
    `TurnNode.width` / `height` below).
- [ ] **Track B — Close the loop:** ~~branch from a text selection~~ (shipped in v0.5.1,
  pulled forward ahead of the Stop-4 gate); synthesis nodes whose context is the union
  of several chains still open. *(if people build big trees and can't converge)*
- [ ] **Track C — Trust and reach:** read-only shared tree links compressed into the
  URL (no backend); storage-health warnings; real backup. *(if people ask to show someone their tree)*

Investigated but not scheduled: web search / tool calling — API shapes, what the node
schema can absorb, and the UI decision are written up in
[`notes/tooling-research.md`](notes/tooling-research.md). That note's §3.4 is what
retired the "OpenRouter never reports token usage" debt item below — the opt-in
parameter it recorded as the fix is deprecated, and usage arrives unasked. Its
proposed `TurnNode.steps[]` schema bump is **v7**, not v6 — the persona library above
takes v6.

Investigated but not scheduled: **canvas node labels.** An optional `TurnNode.label` +
`labelSource` pair carries a user-typed branch name or a generated title, with
`stationSummary()` as the fallback. Design in
[`notes/node-labels-research.md`](notes/node-labels-research.md) §5. It needs **no
Dexie version** — `stores()` declares indexes, not columns, so two optional
non-indexed fields need no migration and this work never joins the v6/v7 queue above.
Ship manual rename before any auto-summarization; the model call is opt-in, needs a
line in the cost receipt, and is exactly a Stop-4 decision.

### Carried debt (none launch-blocking)

- [ ] Edit a submitted prompt (not just regenerate).
- [x] Throttle the chat pane's Markdown re-parse — `ChatMessage` re-parses the whole
  document per streamed token. Measured at 40 parses per 40 tokens; now 6 (v0.5.1).
- [ ] 200-node performance pass. The existing harness does not reach that size:
  `renderTally.ts`'s `seedFiftyNodes` is hard-capped at 50 (`:126`) and is exposed
  only on `window.__hydraSeedFiftyNodes`, so this item includes extending the seeder
  before anything can be measured.
- [x] **Pill labels are truncated twice and unreadable when dimmed.** Fixed
  2026-09-20 — all four defects, per
  [`notes/node-labels-research.md`](notes/node-labels-research.md) §2–3. Summary is
  `line-clamp-2` on a 64-char / 12-word budget, so the clamp does the trimming instead
  of the browser silently re-cutting 40–60% of every label. `pillModelRef` (new, in
  `formatModelRef.ts`) gives the model its own row whenever a turn departs from the
  default — the only thing that can ever distinguish fan-out siblings, and O(1) on the
  node's own fields rather than a node-map scan per pill per commit. A leading
  blockquote is skipped when the prompt continues below it, so quote-seeded branches
  label the question rather than the parent's prose. Off-path dimming goes
  `opacity-40` → `opacity-70` (3.09:1 → 7.46:1) and the role label `slate-500` →
  `slate-400` (3.75:1 → 6.96:1). All three rows fit the existing 72 px pill (55 px
  used), so `NODE_HEIGHT` / `H_GAP` / `V_GAP` are untouched and nothing re-lays-out.
  - Known limit, deliberately accepted: `pillModelRef` compares against the *global*
    default model, because the tree record is not held in memory (only `submitPrompt`
    reads it, from Dexie). A tree with its own default model therefore labels every
    pill rather than none — noisy, not wrong. Fixing it means holding the active tree
    record in the store, which is a bigger change than the defect warrants.
- [ ] **No hover detail on a pill.** The only expansion is a double-click into the
  reader panel. `NodeToolbar` is already exported by the installed React Flow and
  renders at constant screen size (legible at `minZoom` 0.2, where the 12 px label
  renders at 2.4 px). Mount **one** instance in `Canvas`, never one per node — a
  mounted `NodeToolbar` subscribes to the viewport transform, so 200 of them
  re-render every pan frame and blow the `renderBudget` lock.
  [`notes/node-labels-research.md`](notes/node-labels-research.md) §4.
- [x] ~~**OpenRouter never reports token usage.**~~ **Withdrawn 2026-09-20 — the
  record was wrong, not the client.** The item claimed every real OpenRouter turn
  finalized at `{0, 0}`. It does not. OpenRouter deprecated the
  `usage: { include: true }` / `stream_options: { include_usage: true }` opt-ins and
  now always sends usage in the final SSE frame; `streamingClient` already parses it
  (`:83`) and already flushes the last buffered line (`:106`), so nothing was missing.
  Confirmed on a live tree: a real `deepseek/deepseek-v4-flash-0731` turn reports
  `1,701 in · 1,996 out · $0.0002`, tree receipt `$0.0025` actual vs `$0.0042` linear,
  42% saved. No code change. Predicted by
  [`notes/tooling-research.md`](notes/tooling-research.md) §3.4, which called the
  recorded fix obsolete but could not re-diagnose without a key.
  - Still open as an *enhancement*, not a defect: the final frame also carries
    `usage.cost` (dollars actually charged), `prompt_tokens_details.cached_tokens`
    and `completion_tokens_details.reasoning_tokens`. Recording `cost` would make the
    receipt authoritative rather than a client-side reprice. Not launch-blocking.
- [x] **The linear-thread counterfactual is an unlabelled estimate.** Labelled
  2026-09-20: `(est.)` on the row, `~` on every figure derived from it, assumptions
  stated in the panel rather than only on hover, full caveat as a tooltip. The receipt
  also stopped claiming a *negative* saving on shallow trees, where the modelled thread
  can undercut real spend. The arithmetic is still an estimate — see the next item.
- [ ] **Make the counterfactual arithmetic match its own ruler.** Now that it reads as
  an estimate, it can be made a good one. Four known biases, all currently flattering
  the branching story, all four re-verified in source on 2026-09-20: (1) actual uses
  provider-reported tokens while the counterfactual uses `text.length / 4`
  (`approxTokens`, `treeCost.ts:42-44`) — two rulers for one subtraction; (2) the
  system prompt is re-sent on every real turn but is absent from the modelled
  transcript (`cfInput`, `treeCost.ts:117`); (3) excluded turns vanish from the
  transcript later turns would have inherited (the loop at `treeCost.ts:114` walks
  `priced` only); (4) no prompt-caching discount in the price math
  (`treeCost.ts:119`), though a re-sending linear thread is the exact shape caching
  rewards. The rigorous fix for (1) needs no estimator at all — a
  turn's real prompt tokens are recoverable by differencing along a chain,
  `inputTokens(child) − inputTokens(parent) − outputTokens(parent)`. Worth doing when
  the number is challenged, not before.
- [ ] `TurnNode.width` / `height` are vestigial since fixed-size pills — drop them at
  the next schema bump.
- [x] **Read-hook `--max-tokens` was too low for this repo's files.** Raised in
  `.claude/settings.json` from `800` to `3000` (2026-09-20). Plan:
  `ast_token_trimmer` repo, `specs/2026-09-20-read-hook-consumer-fixes/plan.md`,
  Phase 2 Task A.
- [x] **Prefer `Read` over `Bash` for file inspection.** Added to `CLAUDE.md`
  (2026-09-20), after the upstream `ast_token_trimmer` offset/limit fix (Phase 1)
  shipped and was verified live. Plan: same doc, Phase 2 Task B. Verified
  2026-09-20 in a fresh session: reading `src/store/useTreeStore.ts` produced a
  real (non-passthrough) trim in `~/.cache/trim-metrics.jsonl`
  (`input_tokens: 6208`, `limit: 3000`, `cuts: 5`) — the first trim under the
  raised limit. See also
  [`docs/archive/2026-09_read-hook-trimmer-analysis.md`](archive/2026-09_read-hook-trimmer-analysis.md).

---

## What to refuse

Agents · MCP · RAG / file upload · code interpreter · user accounts · SSO · real-time
collaboration · cloud sync · mobile authoring · plugin system · hosted proxy · team
workspaces. Every one is a fight against a better-resourced project on ground it holds.
**Sync** is the most-requested and the one that turns a free static page into a service
with costs — hold it until asked twice; read-only share links give most of the benefit.
