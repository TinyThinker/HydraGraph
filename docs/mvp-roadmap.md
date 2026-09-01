# MVP Roadmap & Product Evaluation

**Date:** 2026-09-01
**Assessed against:** branch `poc_enhancements_1` at `38db6d1` · 87 source files · 253 tests across 32 files · typecheck and lint clean
**Companion:** a formatted version of this document is published at
<https://claude.ai/code/artifact/eaf63bc6-8d0e-4aa2-ad4e-7a70ec8f9447>

---

## 1. Verdict

| Dimension | Rating | Reasoning |
|---|---|---|
| Engineering risk | **Low** | The hard problems are solved and tested: streaming path, context engine, deterministic layout, persistence with four clean migrations, three provider clients. |
| Adoption risk | **High** | Tree-chat interfaces have a graveyard. Branching alone is not a reason to switch. |
| Time to public beta | **~8 weeks** | One developer, focused. Nothing below is technically difficult for this codebase. |
| Unreachable features | **6** | Built and tested, but no UI can invoke them (see §2). |

The gap is not where you would expect. Almost nothing on this roadmap is hard to build. The
problem is that Hydra Graph is currently positioned as *a spatial conversation tree*, which
describes a mechanism rather than a promise to a person.

ChatGPT and Claude already fork conversations every time you edit a message — they simply hide
the tree behind a version arrow. "You can branch" is therefore not the pitch. The pitch has to be
something a single-vendor chat app structurally cannot do. There are exactly three of those, and
they are the spine of this plan (§4).

---

## 2. Blocking finding: the Phase 3 refactor regressed the product

The re-engineer track (phases 1–5) shipped a full card UI: edit prompt, regenerate, cancel
stream, per-node model picker, per-node system-prompt editor, context meter. Phase 3 replaced the
card with a 240×72 pill and re-implemented **only delete**.

`submitPrompt` and `cancelGeneration` are now called exclusively from `PromptSection.tsx`, which
nothing mounts. In the running app today:

- a failed generation cannot be retried;
- a running generation cannot be cancelled;
- a submitted prompt cannot be edited;
- per-node model selection has no UI;
- **the cascading system-prompt override has no UI at all.**

That last one matters most: it is one of the two genuine differentiators. The engine supports it,
`contextEngine.test.ts` covers it, and no user can reach it.

Dead files with no live importers: `PromptSection.tsx`, `SystemPromptEditor.tsx`,
`ModelPicker.tsx`, `NodeFooter.tsx`, `ResponseArea.tsx`, `ContextMeter.tsx`.

---

## 3. Assets and liabilities

### Strengths

| Strength | Why it matters |
|---|---|
| **The dual-pane resolution** | Canvas for wayfinding, chat for reading. Most tree-chat products die because they make you read on the canvas. Solving this makes the learning curve near-zero — it looks like a chat app with a minimap. |
| **Context isolation is correct** | Ancestry-only payloads, nearest-ancestor prompt cascade, cycle-safe traversal, unit tested. The core claim actually holds. |
| **Three providers in one workspace** | Gemini, OpenRouter and local Ollama side by side. No single-vendor product can copy this. Currently the most under-exploited asset. |
| **Disciplined engineering** | Non-streaming nodes take zero re-renders during a stream — measured, with a regression test. Layout is a pure function. Imports are all-or-nothing. This buys velocity later. |
| **Zero infrastructure** | Static hosting, no accounts, no per-user cost. Can be free forever with no unit economics problem. |
| **Stale propagation** | Re-prompt an ancestor and descendants flag themselves. Small, thoughtful, signals a tool that respects correctness. |

### Weaknesses

| Weakness | Why it matters |
|---|---|
| **The cold-start tax** | A user must find an API key before seeing a single token. The biggest hole in the funnel, and entirely fixable with a canned demo tree. |
| **Data lives in one browser profile** | No sync, no sharing, and IndexedDB can be evicted silently. A research tool that can lose your research is hard to trust. A JSON export is not a sharing story. |
| **Branch/continue distinction is invisible** | Submitting forks off whatever is selected, so branching is implicit in the selection. Elegant, but users will branch by accident and never notice. |
| **No way in from a phrase** | The killer move is "this paragraph is interesting, explore it." You can only branch from a whole turn. |
| **Nothing converges** | You can diverge forever but never fold two branches back together. That is the missing half of research. |
| **Cost shown in tokens, not money** | BYOK users are precisely the people who think in dollars. |

### Defects worth naming

| Severity | Issue | Impact |
|---|---|---|
| **Blocker** | Six capabilities unreachable (§2) | An errored node is a dead end. |
| **Blocker** | Settings split-brain — `useTreeStore.settings` and `useSettingsStore.settings` are two copies of the same row; the modal writes only one | Add your first API key and the "no provider configured" banner stays up until reload. This lands in the first sixty seconds of every new user's experience. |
| **Measure** | `ChatMessage` feeds live streaming text straight to `react-markdown`, re-parsing the whole document per token | The canvas render budget was carefully optimised; the chat pane never was. Long responses likely degrade quadratically. **Measure before optimising** — this is reasoned from the source, not benchmarked. |
| **Trust** | No backup prompt, no recovery path | Browser storage eviction is silent and total. One incident ends the relationship. |
| **Tidy** | `@dagrejs/dagre` unused; `openRouterBaseUrl` stored but ignored; `width`/`height` vestigial | Cheap to clear, and it stops the next contributor trusting a lie. |

---

## 4. Positioning: stop selling the tree

Every incumbent has a hidden conversation tree. What none of them has is the ability to run the
*same upstream context* through different models and different personas, show what each one cost,
and then fold the results back together. That is not a chat feature — it is a workbench.

### Wedge 1 — The counterfactual cost meter

You already store `inputTokens` per turn. The linear-chat equivalent is exactly computable from
data you already persist: each turn re-sending every prior turn in the tree, chronologically.

```
This tree · 34 turns · 6 branches          $0.41
Same 34 turns, one linear thread           $3.12
Context you didn't pay for        $2.71 saved · 87%
```

Roughly two days of work, including a per-model pricing table. Nobody else has it, and it is the
only number that *proves* the product thesis instead of asserting it.

### Wedge 2 — Fan out, compare

One prompt, N branches, a different model or persona each, identical ancestry, dispatched in
parallel and shown side by side. This is the demo that makes an experienced LLM user understand
in five seconds. Your multi-provider BYOK setup is what makes it possible.

### Wedge 3 — Fold it back

Select several branches and spawn a node whose context is the union of their chains plus a
synthesis instruction. Diverge, compare, converge. That last step is what turns chatting into
research.

---

## 5. The roadmap

Ordered by dependency, not ambition. Each milestone has a gate — if it does not pass, do not start
the next one.

### M0 — Restore the verbs · weeks 1–2

*Not new features. Re-exposing capabilities the engine already has and the UI lost.*

- Consolidate on `useSettingsStore`; delete the duplicate settings state in `useTreeStore`. This
  alone fixes the first-run banner.
- Retry on errored nodes, regenerate on idle ones — in the pill's selected state and the reader panel.
- Cancel control while a node is streaming.
- Per-node system-prompt override, rehomed into the reader panel where there is room for it.
- Per-node model picker, same place.
- Edit a submitted prompt.
- Drop dagre; wire or remove `openRouterBaseUrl`.

**Gate:** a wrong API key, a rate limit, or a bad answer can never permanently damage a node.
Every capability in the data layer has a way in.

### M1 — Survive the first sixty seconds · week 3

*Right now the app asks for a credential before it gives value. Invert that.*

- A real demo tree shipped with the app — canned responses, no key required, fully explorable and
  branchable, with the cost meter already showing numbers.
- Three-step key setup with a live "test connection" check, and the Ollama `OLLAMA_ORIGINS` gotcha
  documented where people actually hit it.
- Make branching legible: when submitting off a mid-chain node, say so — *"this starts a new
  branch from turn 4."*
- Data safety: a visible storage-health line, an export nudge after meaningful work, and an honest
  "this lives in this browser only" statement.

**Gate:** a stranger with no API key understands what the product does within one minute.

### M2 — Ship the wedge · weeks 4–5

*The two features that make this un-copyable by a single-vendor chat app.*

- Model pricing table plus per-node, per-tree and counterfactual cost in dollars.
- Fan-out: one prompt, N branches, a different model or persona each, dispatched in parallel.
- Compare view: select sibling branches, see them column by column in the right pane, with the
  shared-context guarantee stated plainly.
- Persona presets, so switching a branch to "sceptic" or "security reviewer" is one click.

**Gate:** you can record a 45-second screen capture that makes an experienced LLM user say
"wait, do that again."

### M3 — Close the research loop · weeks 6–7

*Divergence without convergence is just a mess with better graphics.*

- Branch from a text selection — highlight a phrase in any response, spawn a child that quotes it
  as its opening context.
- Synthesis nodes: select several nodes, generate one whose context is the union of their chains.
- Show a synthesis node's sources as distinct inbound edges so the map stays truthful.
- Performance pass: throttle the chat pane's Markdown parsing, then load a 200-node tree and watch it.

**Gate:** a real research session ends with one node worth keeping, and its provenance is visible
on the map.

### M4 — Put it in front of people · week 8

*Static hosting means launch is a deploy, not a migration.*

- Deploy the static build; add a keyboard shortcut sheet and empty states with actual guidance.
- A landing page whose hero is the compare demo, not a feature list.
- Read-only shared tree links via a compressed URL payload — no backend, and the only viral loop
  available.
- Ship to audiences who already think in tokens: local-model communities, BYOK power users,
  prompt engineers.

**Gate:** twenty strangers have used it, and you know which of the three wedges they came back for.

---

## 6. What to refuse for now

User accounts · real-time collaboration · cloud sync · mobile authoring · file upload and RAG ·
agents and tool use · plugin system · a hosted proxy · semantic search · team workspaces

Each is defensible and each costs more than eight weeks. None is the reason someone would switch.

Two deserve a note. **Sync** is the most-requested thing you will hear and the one that turns a
free static site into a service with costs and liabilities — hold it until people ask twice.
**Read-only share links** look like collaboration but are not: compressed into the URL they need
no backend, and they are how anyone else ever finds out this exists.

---

## 7. Instrumentation

| Signal | What it tells you | Healthy |
|---|---|---|
| Demo → key conversion | Whether the canned tree earns the credential | > 25% |
| Second branch created | The real activation moment — one branch is an accident, two is intent | > 60% of keyed users |
| Fan-out used | Whether the wedge is the wedge, or the guess was wrong | > 30% in week one |
| Synthesis nodes created | Whether anyone converges, or they all diverge and leave | > 1 per active tree |
| Day-7 return | Research tool or toy | > 20% |
| Trees with ≥ 3 branches | Whether the shape of the product matches how it is used | Majority |

All of these are computable locally from IndexedDB and can be shown to the user as their own
stats rather than shipped anywhere, which keeps the privacy claim intact. If aggregate numbers are
wanted later, ask for opt-in and send counts, never content.

---

## 8. The bet

People do not love tools for their data structures. They love them for a feeling, and the feeling
available here is *nothing you send is wasted*. Every turn carries exactly the context it needs,
the cost of that decision is visible in money, and the map on the left means you never lose the
thread you put down twenty minutes ago.

Two things would make that land. **Speed of thought** — keyboard-first, branch in one keystroke,
never a modal between having an idea and pursuing it. And **the counter that keeps going up** — a
running tally of context you did not pay for is a small, honest, slightly addictive reward for
using the tool the way it wants to be used.

The engineering here is already better than most shipped products. Spend the next eight weeks
proving the thesis rather than extending the mechanism.
