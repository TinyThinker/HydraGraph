# Spec: Track B — reports from selected branches

Date: 2026-10-11
Roadmap item: `docs/ROADMAP.md` § Later → Track B, "Report from selected branches".
Origin: design discussion 2026-10-11 (user + PM review). The ideas A–G below came out
of that review and were added to the roadmap entry at the same time as this spec.

## The idea in one paragraph

Today the app only diverges: more branches, more models. Nothing turns a tree back into
something you can hand to another person. This spec adds the converge step. You tick
branches on the canvas. One model call writes a cohesive document from them: one argument
start to finish, disagreements named, every point traceable to the turns it came from.
The report lives beside the tree, not in it.

## Phases

| Spec phase | Idea | What a user gets | Depends on |
|---|---|---|---|
| [1 — Core report](phase-1-core-report.md) | base | Tick branches, write a report, read / copy / download it, see its cost | — |
| [2 — Too big: summarize first](phase-2-summarize-fallback.md) | base | Big selections still work; you see what was condensed | 1 |
| [3 — Outline first](phase-3-outline-first.md) | A | Approve and reorder sections before the full write; redo one section | 1 |
| [4 — Source links](phase-4-source-links.md) | C | Click a paragraph, the canvas lights up the turns behind it | 1 |
| [5 — Demo report](phase-5-demo-report.md) | G | The no-key demo ships with a finished report | 1, 3, 4 |
| [6 — Disagreement ledger](phase-6-disagreement-ledger.md) | B | You rule on each conflict between branches before it writes | 3 |
| [7 — Passage shelf](phase-7-passage-shelf.md) | D | Collect highlighted passages from anywhere; write from the shelf | 1 |
| [8 — Continue from report](phase-8-continue-from-report.md) | F | Start a new tree with the report as its first turn | 1 |
| [9 — Compare reports](phase-9-compare-reports.md) | E | Two or three models write the report; compare side by side | 1 (3 if present) |

## Order

- **v1 = 1 → 2 → 3 → 4 → 5.** This is the recommended first release: the core, the
  big-tree fallback, steering, trust, and the demo that shows it all with no key.
- **v2 = 6, 7, 8, 9** in any order, each gated on what people do with v1 (see the roadmap
  entry). 6 needs 3. Everything else needs only 1.
- Phase 2 can be skipped for a first internal cut: Phase 1 blocks a too-big selection
  with a plain message instead of failing mid-stream.

## Settled design decisions (do not re-derive)

- **Selection unit is a turn, meaning its whole path to the root.** Ticking a leaf
  includes its branch. Shared ancestry is sent once. Single-turn picks come only via the
  passage shelf (Phase 7).
- **The report lives outside the tree.** No multi-parent node. Canvas layout, the context
  engine (`lib/contextEngine.ts`) and dispatch are untouched.
- **Storage: `ConversationTree.reports?: TreeReport[]`**, a non-indexed field on the tree
  row. No Dexie version bump in this spec. If reports outgrow the row, a `reports` table
  joins the v6 queue — not here.
- **Fits → send directly. Doesn't fit → summarize per branch first (Phase 2).** "Fits"
  means estimated input + an output reserve stays under the model's context window, with
  a safety margin, because the estimate is chars/4.
- **One editable default brief.** No template library. The default asks the model to name
  disagreements, never to resolve them silently. Phase 6 is where the user resolves them.
- **Reports are OpenRouter-only for now. Ollama is shelved** (decided 2026-10-11). It
  cannot be tested on the dev machine (MacBook Air M4: too slow running Ollama next to the
  app), and Ollama silently cuts the oldest input when a request exceeds its context
  setting, so an untested path would quietly drop early turns. The composer blocks Ollama
  with a plain message (Phase 1, task 1.3). The design to lift this is kept at the end of
  Phase 1 under "Shelved".
- **Turns are cited by short tags** (`[t1]`, `[t2]`, …) assigned per report and stored
  with it, because node ids are UUIDs and branches have no names.
- **Reports count as spend.** They appear as their own line in the cost receipt, never
  folded into the branching counterfactual.

## Rules for every task

- One task = one vertical slice: logic + UI + test, user-visible or test-visible on its own.
- Max 5 source files touched per task (tests count separately).
- Each task ends green on `npm run check` (`tsc -b`, `oxlint`, `vitest run`) and is its
  own commit.
- Repo constraints from `CLAUDE.md` apply: immutable Zustand updates, async/await on Dexie,
  components ≤ 150 lines, UI separate from store logic.
- `useTreeStore.ts` is 765 lines. Add actions there only when they write the tree row;
  report state and streaming live in a new `useReportStore`.
- Canvas pills subscribe with **primitive boolean selectors** only (one boolean per pill),
  never the whole selection set — 200 pills re-render on every pan otherwise
  (`ARCHITECTURE.md` §7.2, `renderTally.ts`).
- No new network destination. `connect-src` in `public/_headers` stays as is (OpenRouter
  and localhost already cover every call in this spec).

## Out of scope

- Synthesis turns inside the tree (multi-parent nodes). Rejected 2026-10-11.
- A template / brief library (revisit with the persona library, `notes/persona-library-plan.md`).
- Sharing a report by link (Track C).
- PDF / DOCX export. Markdown download only; the browser can print it.
- Node labels (`notes/node-labels-research.md`). Tags replace them for citations.
- Ollama as a report writer (shelved; see the decision above).

## Definition of done (whole spec, v1)

- Phases 1–5 shipped; Track B entry in `ROADMAP.md` updated per phase.
- `CHANGELOG.md` line per phase, `STATUS.md` synced by hand.
- `ARCHITECTURE.md` gains a short "Reports" section (data model, where streaming lives,
  how citations map to nodes).
- Manual check on the deployed URL in Chrome and Safari with a real OpenRouter key
  (each phase's last task).
