# Launch Priorities — what to build next, and why in that order

> **Where this fits.** Tier 2 rationale behind the open boxes in
> [`ROADMAP.md`](../ROADMAP.md). No checklists live here — the boxes stay in ROADMAP,
> the *reasoning* stays here. Written 2026-09-20, after every open item was verified
> against source rather than re-read from the docs.

The governing fact: **the product works and nobody can see it.** Phases 1–2 are
closed, the catalog and the no-key demo tree shipped, and `main` is green at 368
tests. There is no URL. Every ordering decision below follows from that one gap.

---

## 1. The ranked table

ROI is *value delivered ÷ effort*, not value alone. "Infra impact" means what the item
does to the codebase's future — schema versions consumed, surfaces coupled, doors
opened or closed.

| # | Item | Effort | ROI | User impact | Infra / project impact | Why here |
|---|---|---|---|---|---|---|
| **1** | **Static deploy** | ~0.5d | **Highest** | Total — it is the difference between zero users and some. Nothing else on this list reaches anybody until this lands. | Adds one host config and possibly a `base` in `vite.config.ts`. No app code. Creates the deploy path every later fix rides on. | Everything below is an improvement to a thing nobody can open. Shipping first also converts Phase 4 from a plan into a feedback loop. |
| **2** | **Record OpenRouter `usage.cost`** | ~0.5d | **High** | Invisible until challenged, then decisive: the receipt stops being *our* arithmetic and becomes *the provider's invoice*. | Three more fields off a frame already parsed (`streamingClient.ts:85`); optional `TurnNode` fields need no migration. Partly dissolves item 5. | Promoted above the onboarding items because the cost receipt **is** the pitch. The first competent reader will ask "says who?" — this is the cheapest possible answer, and it is cheaper than the estimator work in item 5. |
| **3** | **Key setup in three steps + connection test** | ~1d | **High** | The first cliff after the demo. Today a wrong key fails at generation time with a raw HTTP error; a probe moves the failure to the moment of entry, where it is fixable. | Reworks `SettingsModal` (currently a flat form) into step state. Touches no store, no schema. The Ollama hint is one line of JSX. | Second-highest user impact, but it only matters to people who already *decided* to stay — which requires items 1 and 2 to have done their jobs. Smaller than it reads: the `OLLAMA_ORIGINS` prose already exists in `SETUP.md` §4. |
| **4** | **Storage policy: durability + key handling** | ~0.75d | **High** | Answers the question every BYOK user asks silently in the first thirty seconds — *where does my key go?* — and stops trees being silently evictable. | Splits one storage policy into two. `persist()` (never called today), entry warning, scoped-key guidance, "Forget key", destination-host display, export nudge. Designed and risk-rated in [`storage-and-key-plan.md`](storage-and-key-plan.md). | Cheap, and it removes a trust objection rather than adding a feature. Grew from 0.5d after the original scoping was found to describe the problem rather than fix it. Below item 3 only because a user who never connects never gets far enough to worry. |
| **4b** | **File System Access autosave** | ~1d | Medium-High | The only mechanism that survives a site-data clear or eviction. Chrome/Edge; manual export stays the floor elsewhere. | A local file the user picks — no server, no account, no sync. Reuses `buildExportDoc` wholesale. | Just after launch. It is the real durability answer, but `persist()` (in item 4) captures most of the benefit for an hour of work, so it does not block a deploy. |
| — | *— launch line: post it —* | | | | | |
| **5** | **Counterfactual arithmetic** | ~1–2d | Medium | Zero until someone checks the math, then reputational. Today the estimate is honestly *labelled* but still biased four ways, every one flattering us. | Pure `treeCost.ts` work. The rigorous fix needs no estimator — difference `inputTokens` along a chain. | Deliberately after launch. It is already labelled as an estimate, which discharges the honesty duty; item 2 removes some of the pressure by making the *measured* half authoritative. Do it the day the number is challenged. |
| **6** | **Pill hover card (`NodeToolbar`)** | ~1d | Medium | Real daily friction at scale: on a big canvas the only way to read a node is double-clicking into the reader. | One `NodeToolbar` mounted in `Canvas` — **never one per node**, or 200 viewport subscribers re-render every pan frame and blow the render budget. | The top *usability* debt, but it bites returning users on large trees. Nobody has large trees yet. Revisit the instant Phase 4 produces one. |
| **7** | **Persona library (Track A, Dexie v6)** | ~2d | Medium | Fan-out is the demo, and it currently offers four hardcoded personas with no way to add one. The headline capability is the one that can't be customised. | **Consumes Dexie v6.** Bundle the vestigial `width`/`height` drop into the same migration — never spend a version on two dead fields. Design ready in [`persona-library-plan.md`](persona-library-plan.md). | Highest-value item in the gated tracks, and already pulled forward in ROADMAP. Still gated: build it when Phase 4 shows fan-out is used repeatedly, not on the assumption that it will be. |
| **8** | **Edit a submitted prompt** | ~1–2d | Low-Med | Ordinary expectation, currently absent — `MessageActions` offers Stop / Retry / Regenerate only. | The UI is trivial; the *semantics* are the work. Editing a prompt invalidates every descendant's inherited context. That question has no cheap answer. | Underneath its size. The `stale` flag already exists as raw material, but deciding what an edit does to a subtree is a design decision worth having real users before making. |
| **9** | **200-node performance pass** | ~1–2d | Low | Unknown. Possibly none. | Includes extending the harness: `seedFiftyNodes` is hard-capped at 50 and lives on a `window` global. | Classic unmeasured optimisation. v0.5.1 already fixed the two measured problems. Don't spend days on a ceiling no user has touched. |
| **10** | **Tracks B & C, tool calling (v7)** | multi-day | — | — | Track C's share links pull toward a backend — the exact thing [`mvp-strategy.md`](mvp-strategy.md) says to refuse. Tool calling consumes Dexie **v7**. | Correctly gated on Phase 4 evidence. Do not pre-empt the gate. |

---

## 2. The three ordering calls worth arguing with

**Deploy before polish.** Items 3 and 4 make the product better for people who cannot
currently reach it. A week spent perfecting onboarding for an audience of zero is a
week of guessing. Ship, then let real first-contact failures pick the next fix — which
is the whole premise of Phase 4.

**`usage.cost` jumped the onboarding items.** It was carried debt, not a launch item.
It gets promoted because of what this project claims: *deep-context arbitration, with
the cost*. The cost receipt is the load-bearing claim, and right now both halves of it
are our own arithmetic. Half a day converts the measured half into the provider's own
number. That is the best value-per-hour on the entire list, and it defuses item 5
before item 5 becomes urgent.

**The counterfactual is deliberately left biased.** Every bias flatters us, which is
uncomfortable. It sits below the launch line anyway because the previous pass already
did the honest thing — it is marked `(est.)`, every derived figure is `~`-prefixed, and
the assumptions are stated in the panel rather than buried in a tooltip. A labelled
estimate is defensible; an unlabelled one was not. The remaining work upgrades a
defensible number to a rigorous one, and rigour has no audience until someone is
looking.

---

## 3. Sequencing constraints

- **Dexie v6 is the persona library** (item 7), and it carries the `TurnNode.width` /
  `height` drop with it. Do not bump the schema for the dead fields alone.
- **Dexie v7 is tool calling** (`TurnNode.steps[]`, [`tooling-research.md`](tooling-research.md)).
  Nothing else may claim v7.
- **Canvas node labels need no version** — two optional non-indexed fields, so that
  work never joins the v6/v7 queue ([`node-labels-research.md`](node-labels-research.md) §5).
- **`vite.config.ts` has no `base`.** A root-domain host is fine as-is; a project
  subpath (GitHub Pages project site) needs one set before item 1 works.
- **Items 1–4 touch no schema and no store.** They can ship in any order within the
  block, or in parallel, without conflicting.

---

## 4. What would change this order

One signal each. If Phase 4 produces it, re-rank immediately:

| Signal from real users | Promotes |
|---|---|
| Anyone disputes the savings figure | Item 5, to the top |
| People build trees past ~50 nodes | Items 6 and 9 |
| Fan-out used more than once per session | Item 7 |
| "Can I show someone this tree?" — asked twice | Track C share links |
| Onboarding drop-off before the first turn | Items 3 and 4, above everything |
