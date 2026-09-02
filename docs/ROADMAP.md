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
layout, 4 clean DB migrations, 3 provider clients, 253 tests). What blocks a launch is
**product regression and first-run friction**, not missing infrastructure.

### Active blockers

- [ ] **Six built capabilities are unreachable from the UI.** The subway-pill refactor
  re-implemented only *delete*. `submitPrompt` and `cancelGeneration` are called only
  from `PromptSection.tsx`, which nothing mounts. Result: an errored node cannot be
  retried, a running generation cannot be cancelled, a submitted prompt cannot be
  edited, per-node model and per-node system-prompt overrides have no UI at all.
  Dead files: `PromptSection.tsx`, `SystemPromptEditor.tsx`, `ModelPicker.tsx`,
  `NodeFooter.tsx`, `ResponseArea.tsx`, `ContextMeter.tsx`.
- [ ] **Settings split-brain.** `useTreeStore.settings` and `useSettingsStore.settings`
  are two copies of the same row; the modal writes only one, so the "no provider
  configured" banner survives adding an API key until reload.

---

## Phase 1 — Stop the bleeding (days 1–4)

Only the defects a stranger hits in their first two minutes.

- [ ] Consolidate on `useSettingsStore`; delete the duplicate settings state in
  `useTreeStore`. Fixes the first-run banner.
- [ ] Retry on errored nodes; regenerate on idle ones (rewire `submitPrompt`).
- [ ] Cancel while streaming (rewire `cancelGeneration`).
- [ ] Delete the unused `@dagrejs/dagre` dependency; wire or remove `openRouterBaseUrl`.

**Gate:** a wrong key, a rate limit, or a bad answer can never permanently damage a node.

---

## Phase 2 — Build the demo (days 5–9)

The five days that decide whether the project has a reason to exist.

- [ ] Per-node model picker and per-node persona, rehomed into the reader panel.
- [ ] Fan-out: one prompt → N branches, a different model or persona each, dispatched
  in parallel from identical ancestry.
- [ ] Compare view: selected siblings column by column, with the shared-context
  guarantee visible on screen.
- [ ] Model pricing table → per-node, per-tree, and counterfactual cost in dollars
  ("context you didn't pay for").

**Gate:** a 30-second capture of comparing three models at turn 30 makes an experienced
LLM user say "wait, do that again."

---

## Phase 3 — The front door (days 10–12)

Nobody installs anything, ever. That is the whole advantage — spend it.

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
- [ ] **Track B — Close the loop:** branch from a text selection; synthesis nodes whose
  context is the union of several chains. *(if people build big trees and can't converge)*
- [ ] **Track C — Trust and reach:** read-only shared tree links compressed into the
  URL (no backend); storage-health warnings; real backup. *(if people ask to show someone their tree)*

### Carried debt (none launch-blocking)

- [ ] Edit a submitted prompt (not just regenerate).
- [ ] Throttle the chat pane's Markdown re-parse — `ChatMessage` re-parses the whole
  document per streamed token. Measure first; likely degrades on long responses.
- [ ] 200-node performance pass.
- [ ] Remove the four dead components once their capabilities are rehomed (Phase 2).
- [ ] `TurnNode.width` / `height` are vestigial since fixed-size pills — drop them at
  the next schema bump.

---

## What to refuse

Agents · MCP · RAG / file upload · code interpreter · user accounts · SSO · real-time
collaboration · cloud sync · mobile authoring · plugin system · hosted proxy · team
workspaces. Every one is a fight against a better-resourced project on ground it holds.
**Sync** is the most-requested and the one that turns a free static page into a service
with costs — hold it until asked twice; read-only share links give most of the benefit.
