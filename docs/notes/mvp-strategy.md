# MVP Strategy & Product Evaluation

> **Where this fits.** This is the *reasoning* behind the plan — competitive scan,
> positioning, assets/liabilities, instrumentation targets. The *actionable checklist*
> lives in [`../ROADMAP.md`](../ROADMAP.md); tick boxes there, not here. This note is
> updated only when the strategy itself changes.

**Revision:** 2 — 2026-09-01
**Assessed against:** branch `poc_enhancements_1` at `754bff0` · 87 source files · 253 tests across 32 files · typecheck and lint clean
**Formatted version:** <https://claude.ai/code/artifact/eaf63bc6-8d0e-4aa2-ad4e-7a70ec8f9447>

> **What changed in revision 2.** Rev. 1 assumed branching and multi-model comparison were open
> ground. A competitive scan says otherwise on both counts (§2). The positioning has been narrowed
> to the one gap still unoccupied, and the timeline cut from eight weeks to fourteen days — because
> the thing most likely to kill this project is not a rival, it is polishing in private until the
> momentum is gone. The post-launch work is no longer scheduled; it is gated on evidence.

---

## 1. Verdict

| Dimension | Rating | Reasoning |
|---|---|---|
| Engineering risk | **Low** | The hard problems are solved and tested: streaming path, context engine, deterministic layout, persistence with four clean migrations, three provider clients. |
| Adoption risk | **High** | The category is crowded and partly commoditised. Branching is a shipped incumbent feature. |
| Time to a public link | **14 days** | Not eight weeks. Ship, then listen. |
| Unreachable features | **6** | Built and tested, but no UI can invoke them (§4). |

Almost nothing on this plan is hard to build. The problem is positioning, and the second problem
is distribution. Neither is solved by more code.

---

## 2. Competitive reality

A scan of the current landscape (September 2026) invalidates two of the three wedges in rev. 1.

| Who | What they already have | Where they structurally cannot follow |
|---|---|---|
| **ChatGPT · Claude** | Conversation branching shipped in ChatGPT in Sept 2025; Claude has always forked on message edit. Overwhelming distribution. | They will never run a competitor's model, or your local one, beside their own. Multi-provider is permanently closed to them. |
| **LibreChat** — the real rival | Multi-provider BYOK, conversation branching, agents, MCP, RAG, code interpreter, full-text search, SSO. More features than you will ever ship. | Self-hosting: Docker, MongoDB, Meilisearch. The gap between "click a link" and "stand up a stack" is the whole opening. |
| **Open WebUI** | The default face of local models. Enormous community. | Same install tax; optimised for managing models, not structured research. |
| **Comparison playgrounds** — MultipleChat, Langfuse, Google LLM Comparator | Same prompt to N models, side by side, often with cost. | Every one is stateless. They compare on a *cold prompt*. None has thirty turns of accumulated context for the models to inherit. |
| **Tree extensions** — Nodea and similar | Draw the tree the incumbent hides. Free. | They visualise someone else's conversation. No context control, no provider choice, no economics. |

**Conclusion:** "you can branch" is dead as a pitch, and plain side-by-side comparison is a crowded
tool category. Neither can carry the positioning.

**Ammunition.** The premise is no longer yours to prove. A CHI 2026 study of tree-structured chat
interfaces reports faster completion and lower cognitive load against a linear baseline, and an
arXiv paper on context branching finds branched conversations both cheaper and measurably more
focused. *Verify the figures before putting them on a landing page* — these are summaries, not
papers read end to end — but you can cite rather than argue. See §9 for links.

---

## 3. Positioning: deep-context model arbitration

Every comparison tool is a cold playground. Every branching implementation is a version selector
bolted onto a linear scroll. The intersection is empty, and it is exactly where this architecture
already sits.

> **You're thirty turns into a hard problem. Ask three models what to do next — same context, side
> by side, with the bill.**

That sentence is unoccupied. It needs three things at once — isolated ancestry context, multiple
providers, and per-turn cost data — and this is the only project that already has all three in the
data layer. Own it, and stop describing the product as a conversation tree. The tree is the
substrate, not the pitch.

### The receipt

```
This tree · 34 turns · 6 branches          $0.41
Same 34 turns, one linear thread           $3.12
Context you didn't pay for        $2.71 saved · 87%
```

Exactly computable from data already persisted: actual spend is the sum of real `inputTokens`; the
counterfactual is each turn re-sending every prior turn in the tree, chronologically. Not a moat —
but people screenshot numbers, and that is distribution you don't pay for.

---

## 4. Blocker: the Phase 3 refactor regressed the product

The re-engineer track shipped a full card UI: edit prompt, regenerate, cancel stream, per-node
model picker, per-node system-prompt editor, context meter. Phase 3 replaced the card with a
240×72 pill and re-implemented **only delete**.

`submitPrompt` and `cancelGeneration` are now called exclusively from `PromptSection.tsx`, which
nothing mounts. In the running app today:

- a failed generation cannot be retried;
- a running generation cannot be cancelled;
- a submitted prompt cannot be edited;
- per-node model selection has no UI;
- **the per-node system-prompt override has no UI at all** — which means persona comparison, half
  of the wedge in §3, is currently impossible for a user.

Separately: add your first API key and the "no provider configured" banner stays up until reload,
because `useTreeStore.settings` and `useSettingsStore.settings` are two copies of the same row and
the modal writes only one. That lands in the first sixty seconds of every new session.

Dead files with no live importers: `PromptSection.tsx`, `SystemPromptEditor.tsx`,
`ModelPicker.tsx`, `NodeFooter.tsx`, `ResponseArea.tsx`, `ContextMeter.tsx`.

---

## 5. Assets and liabilities

### Advantages worth pressing

| Advantage | Why it matters |
|---|---|
| **Zero install — the big one** | The rival's onboarding is a docker-compose file; yours is a URL. They cannot copy this without abandoning their architecture. Make the landing page *be* the app, with the demo already loaded. |
| **Comparison inside accumulated context** | The one thing the playgrounds structurally lack and the incumbents can't offer. This is the product. |
| **The dual-pane resolution** | Canvas for wayfinding, chat for reading. Most tree UIs die by making you read on the canvas. Near-zero learning curve. |
| **Focus** | LibreChat is becoming a platform, and platforms bloat. One job done beautifully beats forty done adequately, for the people who have that job. |
| **Speed** | Hear a complaint at 2pm, ship the fix by 6pm. The only axis on which a solo project beats a large OSS one. |
| **Zero infrastructure** | Static hosting, no accounts, no per-user cost. Free forever, no unit economics to solve. |
| **Disciplined engineering** | Non-streaming nodes take zero re-renders during a stream — measured, with a regression test. Layout is a pure function. Imports are all-or-nothing. |

### Honest liabilities

| Liability | Why it matters |
|---|---|
| **Outgunned on features** | Agents, RAG, MCP, code interpreter, SSO. Do not fight here. Every hour is an hour the rival already spent better, with more hands. |
| **No distribution at all** | The real bottleneck — not the product. A tool nobody has heard of loses to a worse tool with a community. |
| **The cold-start tax** | A key is required before a single token appears. Biggest hole in the funnel; fixed by a canned demo tree. |
| **Data lives in one browser profile** | No sync, no sharing, silent IndexedDB eviction. A research tool that can lose your research is hard to trust, and a JSON export is not a sharing story. |
| **Branch/continue is invisible** | Submitting forks off whatever is selected. Elegant, but people will branch by accident and never notice. |
| **Nothing converges** | You can diverge forever but never fold branches back together. The missing half of research — but it waits until after launch. |

### Carried defects

| Severity | Issue | Impact |
|---|---|---|
| **Blocker** | Six capabilities unreachable (§4) | An errored node is a dead end. |
| **Blocker** | Settings split-brain | First-run banner survives adding an API key. |
| **Measure** | `ChatMessage` re-parses the whole markdown document per streamed token | Long responses likely degrade quadratically. **Reasoned from the source, not benchmarked — measure first.** |
| **Trust** | No backup prompt, no recovery path | Browser storage eviction is silent and total. |
| **Tidy** | `@dagrejs/dagre` unused; `openRouterBaseUrl` ignored; `width`/`height` vestigial | Cheap to clear; stops the next contributor trusting a lie. |

---

## 6. The line: fourteen days to something you can post

Not a beta plan — a launch plan. Every item either removes a reason to bounce or builds the demo.
Anything that does neither has been moved off the line.

### Stop 1 — Stop the bleeding · days 1–4

*Only the defects a stranger would hit in their first two minutes.*

- Consolidate on `useSettingsStore`; delete the duplicate settings state in `useTreeStore`. Fixes
  the first-run banner.
- Retry on errored nodes, regenerate on idle ones.
- Cancel while streaming.
- Delete dagre; wire or remove `openRouterBaseUrl`.

**Gate:** a wrong key, a rate limit or a bad answer can never permanently damage a node.

### Stop 2 — Build the demo · days 5–9

*The five days that decide whether this project has a reason to exist.*

- Per-node model picker and per-node persona, rehomed into the reader panel. Both are
  prerequisites for the wedge, not extras.
- Fan-out: one prompt, N branches, a different model or persona each, dispatched in parallel from
  identical ancestry.
- Compare view: selected siblings column by column, with the shared-context guarantee on screen.
- Model pricing table, then per-node, per-tree and counterfactual cost in dollars.

**Gate:** a 30-second capture of comparing three models at turn 30 makes an experienced LLM user
say "wait, do that again."

### Stop 3 — The front door · days 10–12

*Nobody installs anything, ever. That is the whole advantage — spend it.*

- Demo tree shipped with the app: canned responses, no key, fully explorable, receipt already
  showing numbers.
- Static deploy; the landing page *is* the app with the demo preloaded.
- Key setup in three steps with a live connection test, and the Ollama `OLLAMA_ORIGINS` gotcha
  documented where people hit it.
- One honest line about where data lives, plus an export nudge after real work.

**Gate:** a stranger with no API key understands the product within one minute of clicking.

### Stop 4 — Post it, then listen · days 13–14

*The bottleneck was never the product.*

- Ship where people already think in tokens: local-model communities, BYOK power users, prompt
  engineers.
- Lead with the comparison capture, not a feature list.
- Reply to every person. Ship one fix the same day, publicly.
- Track one thing: who came back a second time, and what they did.

**Gate:** twenty strangers have used it and you know which capability brought the returners back.

---

## 7. Open track — build only what the returners ask for

Each of these was on a fixed schedule in rev. 1. That was wrong. None ships until evidence from
Stop 4 says which one matters.

| Track | Contents | Unlocks if |
|---|---|---|
| **A — Deepen arbitration** | Persona presets, response diffing, per-branch model memory, cheap-model-first routing with escalation. | People use fan-out repeatedly and ask for sharper comparison. |
| **B — Close the loop** | Branch from a text selection; synthesis nodes whose context is the union of several chains, with sources as distinct inbound edges. | People build big trees and complain they can't converge. |
| **C — Trust and reach** | Read-only shared tree links compressed into the URL — no backend, and the only viral loop available. Storage health, real backup. | People ask to show someone else their tree. |

**Carried debt, none launch-blocking:** edit a submitted prompt; throttle the chat pane's Markdown
re-parse (measure first); a 200-node performance pass; remove the four dead components once their
capabilities are rehomed.

---

## 8. What to refuse, harder than before

Agents · MCP · RAG and file upload · code interpreter · user accounts · SSO · real-time
collaboration · cloud sync · mobile authoring · plugin system · a hosted proxy · team workspaces

Every one is a fight against a better-resourced project on ground it already holds.

One deserves a note. **Sync** is the most-requested thing you will hear and the one that converts a
free static page into a service with costs, liabilities and a support burden. Hold it until people
ask twice. Read-only share links give most of the benefit and none of the bill.

---

## 9. Instrumentation

| Signal | What it tells you | Healthy |
|---|---|---|
| Demo → key conversion | Whether the canned tree earns the credential | > 25% |
| Fan-out used | Whether the wedge is the wedge, or the guess was wrong again | > 30% in week one |
| Second branch created | Activation — one branch is an accident, two is intent | > 60% of keyed users |
| Day-7 return | Research tool or toy | > 20% |
| Receipt shared | Whether the growth loop exists at all | Any signal is signal |
| Trees with ≥ 3 branches | Whether the shape of the product matches how it is used | Majority |

All computable locally from IndexedDB and showable to the user as their own stats, which keeps the
privacy claim intact. For aggregates later: opt-in, counts only, never content.

---

## 10. The bet

Not displacing ChatGPT. Not out-featuring LibreChat. Neither is available, and aiming at them is
how solo projects spend a year building the fortieth-best version of a platform.

What is available: a few thousand people who compare model outputs as part of their actual work,
for whom this becomes the obvious tool, who would be genuinely annoyed if it disappeared. Strong
repository presence. The default answer to one specific question. Possibly sponsorship or a small
paid tier. That is a real outcome, and it is what making it work means.

People don't love tools for their data structures. They love them for a feeling, and the one
available here is *nothing you send is wasted*. Every turn carries exactly the context it needs,
the cost of that choice is visible in money, and the map on the left means you never lose the
thread you put down twenty minutes ago. Two things make that land: **speed of thought** —
keyboard-first, branch in one keystroke, never a modal between an idea and pursuing it — and **a
counter that keeps going up**, an honest running tally of context you didn't pay for.

The engineering is already better than most shipped products. The risk was never that you can't
build it. Spend fourteen days proving the thesis in public rather than eight weeks extending the
mechanism.

---

## Sources — competitive scan, September 2026

- [OpenAI introduces conversation branching in ChatGPT](https://alternativeto.net/news/2025/9/openai-introduces-conversation-branching-in-chatgpt)
- [LibreChat vs OpenWebUI vs Lobe Chat: Which to Self-Host in 2026?](https://blog.elest.io/librechat-vs-openwebui-vs-lobe-chat-which-to-self-host-in-2026/)
- [Langfuse LLM Playground — side-by-side comparison](https://langfuse.com/changelog/2025-07-28-playground-side-by-side)
- [Google LLM Comparator](https://ai.google.dev/responsible/docs/evaluation/llm_comparator)
- [MultipleChat AI model comparison](https://multiple.chat/ai-model-comparison-tool)
- [Nodea — How to branch a chat in Claude](https://nodea.ai/blog/branching-ai-chat-guide)
- [Context Branching for LLM Conversations (arXiv)](https://arxiv.org/pdf/2512.13914)
- [Branchat: A Tree-Structured Interface (CHI 2026)](https://dl.acm.org/doi/full/10.1145/3772363.3798792)
