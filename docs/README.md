# Documentation Map

Four questions, four files. If you read nothing else, read this table.

| Question | File | Who maintains it |
|---|---|---|
| **Where is the project right now?** | [`STATUS.md`](STATUS.md) | Hand-maintained snapshot, kept in sync with ROADMAP + CHANGELOG after every unit of work. |
| **What do I do next?** | [`ROADMAP.md`](ROADMAP.md) | Hand-maintained. The single source of truth for future work. |
| **What already shipped?** | [`CHANGELOG.md`](CHANGELOG.md) | Hand-maintained. One line per change, newest first. |
| **How does the system work?** | [`ARCHITECTURE.md`](ARCHITECTURE.md) | Hand-maintained. The permanent design document. |
| **How do I run it / configure a provider?** | [`SETUP.md`](SETUP.md) | Hand-maintained. |

Repo-root [`README.md`](../README.md) is the public overview and quickstart. Repo-root
[`CLAUDE.md`](../CLAUDE.md) is the contributor / AI-agent coding-constraints file.

---

## The three tiers

Every `.md` file in this project belongs to exactly one tier. When in doubt, this is
the decision:

### Tier 1 — Permanent (system characteristics)

Describes how the system **currently is**. Edited in place, never dated, never
"versioned" with a suffix. If a fact changes, you change the sentence.

`CLAUDE.md` · `README.md` · `docs/ARCHITECTURE.md` · `docs/SETUP.md`

### Tier 2 — Living pointers (state & direction)

Small, exactly one of each, always current. This is how you find "where we are and
what's next" at any moment.

- **`STATUS.md`** — a hand-maintained snapshot: version, last commit, active blockers,
  the next 3–5 actions. Update it directly whenever `ROADMAP.md` or `CHANGELOG.md`
  changes — there is no generator for it, so a stale STATUS.md means someone skipped
  this step.
- **`ROADMAP.md`** — future work as `- [ ]` / `- [x]` checklists under `## Phase N`
  headings. The earliest unchecked box is "what's next". `STATUS.md` reads this file.
- **`CHANGELOG.md`** — what shipped, under `## vX.Y.Z` headings, newest first.

### Tier 3 — Archive (`docs/archive/`)

Records of the past: completed plans, phase-completion logs, point-in-time diagnoses,
closed backlogs. **Born here, written once, never edited again.** Named
`YYYY-MM_<name>` or grouped in a `YYYY-MM_<effort>/` directory.

---

## Filing rule for any new document

1. **Describes how the system currently is** → edit `ARCHITECTURE.md` / `README.md` /
   `SETUP.md` / `CLAUDE.md` **in place**. Do not create a new file.
2. **A plan or intention about the future** → add checklist items to `ROADMAP.md`.
   Long rationale or a strategy essay → `docs/notes/<topic>.md`, linked from `ROADMAP.md`.
3. **A record of work done, a snapshot, or a diagnosis** → it is born in
   `docs/archive/` with a `YYYY-MM_` prefix, and is never edited after it lands.
4. **Never** create a "phase progress", "current state", or "tasks" file at the repo
   root again. That role belongs to `STATUS.md` (auto) + `ROADMAP.md` (checkboxes).

## When you finish a chunk of work

1. Tick the relevant boxes in `ROADMAP.md`.
2. Prepend one line to `CHANGELOG.md` under the current `## vX.Y.Z`.
3. Update `STATUS.md` by hand to match — version, last commit, active blockers, next
   actions.
4. When a whole phase closes, move any working notes for that phase into
   `docs/archive/`.

## Staleness guard

Anything outside Tier 1 and Tier 2 that has not been true for ~30 days is already
overdue for `docs/archive/`. `ARCHITECTURE.md` carries a "reconciled against source
on `<date>`" line — re-check it at every phase closure.

---

## Current contents

```
docs/
  README.md            ← you are here
  STATUS.md            Tier 2 — generated snapshot
  ROADMAP.md           Tier 2 — forward checklist (source of truth)
  CHANGELOG.md         Tier 2 — shipping history
  ARCHITECTURE.md      Tier 1 — the permanent design document
  SETUP.md             Tier 1 — run + provider configuration
  notes/               Tier 2 — rationale behind ROADMAP boxes (no checklists here)
    mvp-strategy.md            the competitive-scan / positioning essay
    model-catalog-plan.md      live OpenRouter catalog + pricing design
    persona-library-plan.md    editable personas + per-tree default (Dexie v6)
    tooling-research.md        web search / tool calling assessment (Dexie v7)
    node-labels-research.md    pill legibility, hover card, generated titles (no migration)
  archive/
    2026-08_original-tasks.md        the original Phase 1–4 task matrix
    2026-08_state-diagnosis.md       the re-engineer-era "current state" doc
    2026-08_backlog-closed.md        closed performance + UX backlog
    2026-08_re-engineering/          the 5-phase re-engineering effort (plan + logs + report)
    2026-08_poc-enhancements/        the dual-pane / subway-layout track (progress + specs)
    2026-09_read-hook-diagnosis.md         read-hook metrics diagnosis (superseded, see next)
    2026-09_read-hook-trimmer-analysis.md  the corrected follow-up analysis
```

## Local-only files (not part of this system)

`study-*.md` at the repo root is a reserved, gitignored pattern (`.git/info/exclude`) for
personal orientation scratch docs — dated, point-in-time indexes a contributor builds for
their own onboarding. They are never committed, never linked from here, and go stale on
purpose; if you find one, treat it as informal and reconcile against `ARCHITECTURE.md`
before trusting it.
