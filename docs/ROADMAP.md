# Roadmap

> **Where this fits.** This is the **source of truth** for what happens next. The
> earliest unchecked `- [ ]` box in the earliest incomplete phase is "the next step".
> [`STATUS.md`](STATUS.md) is generated from this file. Strategy and rationale behind
> this plan live in [`notes/mvp-strategy.md`](notes/mvp-strategy.md) (competitive scan,
> positioning, instrumentation targets).

**Goal:** a public link in ~14 working days. Ship, then listen — do not keep polishing
in private. Positioning: *deep-context model arbitration* — compare several models/
personas at turn 30 of a real problem, on identical inherited context, with the cost.

---

## Current State

The engineering is largely done and tested (streaming, context engine, deterministic
layout, 5 clean DB migrations, 2 provider clients — OpenRouter + Ollama — 292 tests).
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
- [ ] Demo tree shipped with the app: canned responses, no key required, fully
  explorable, receipt already showing numbers.
- [ ] Static deploy; the landing page *is* the app with the demo preloaded.
- [ ] Key setup in three steps with a live connection test; document the Ollama
  `OLLAMA_ORIGINS` gotcha where people hit it.
- [ ] One honest line about where data lives, plus an export nudge after real work.

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
- [ ] **Track B — Close the loop:** ~~branch from a text selection~~ (shipped in v0.5.1,
  pulled forward ahead of the Stop-4 gate); synthesis nodes whose context is the union
  of several chains still open. *(if people build big trees and can't converge)*
- [ ] **Track C — Trust and reach:** read-only shared tree links compressed into the
  URL (no backend); storage-health warnings; real backup. *(if people ask to show someone their tree)*

### Carried debt (none launch-blocking)

- [ ] Edit a submitted prompt (not just regenerate).
- [x] Throttle the chat pane's Markdown re-parse — `ChatMessage` re-parses the whole
  document per streamed token. Measured at 40 parses per 40 tokens; now 6 (v0.5.1).
- [ ] 200-node performance pass.
- [ ] **OpenRouter never reports token usage.** `streamingClient` parses a `usage`
  frame but never asks for one (`usage: { include: true }`), so every real
  OpenRouter turn finalizes at `{0, 0}` and the cost receipt reads `$0.0000`.
  The streaming test hand-feeds a usage frame, which is why it stayed green.
  Found 2026-09-12, not yet fixed — this makes the headline feature demo as zeros.
- [ ] `TurnNode.width` / `height` are vestigial since fixed-size pills — drop them at
  the next schema bump.

---

## What to refuse

Agents · MCP · RAG / file upload · code interpreter · user accounts · SSO · real-time
collaboration · cloud sync · mobile authoring · plugin system · hosted proxy · team
workspaces. Every one is a fight against a better-resourced project on ground it holds.
**Sync** is the most-requested and the one that turns a free static page into a service
with costs — hold it until asked twice; read-only share links give most of the benefit.
