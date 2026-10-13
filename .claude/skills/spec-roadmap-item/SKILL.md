---
name: spec-roadmap-item
description: Turn a roadmap item, or an idea from the current discussion, into a phased spec under specs/. One phase per idea, tasks as small vertical slices. Ideas not yet in the roadmap get added to it first.
argument-hint: <roadmap item, or "discussed" to use ideas from this conversation>
disable-model-invocation: true
---

# Spec a roadmap item

Input: `$ARGUMENTS`. Either a roadmap item (a box title, a track name, a phrase from
`docs/ROADMAP.md`), or ideas discussed in this conversation.

The output is a spec folder that `/implement-phase` can run one phase at a time.

## 1. Pin down what is being specced

- Read `CLAUDE.md`, `docs/ROADMAP.md`, `docs/STATUS.md` and `docs/README.md`.
- Find the item in `ROADMAP.md`.
  - **Found:** use its text, sub-bullets and linked notes as the starting point.
  - **Only discussed, not in the roadmap:** add it to `ROADMAP.md` first, in the phase or
    track it belongs to. Write it like the entries around it: what it is, the decisions
    made in the discussion (with today's date), and what it is gated on. Mirror one line
    in `STATUS.md`. Do this before writing the spec, so the spec always points at a
    roadmap entry.
  - **Partly in the roadmap** (the item exists, but the discussion added ideas): add the
    new ideas as sub-bullets under the existing entry.
- List the **ideas** the spec covers. Each idea becomes its own phase. If the item has a
  base that every idea needs, the base is Phase 1.
- If it is unclear what is in scope, or two readings would produce different specs, ask
  with `AskUserQuestion`. Do not guess scope.

## 2. Read the code before writing

A spec that cites the wrong file wastes the implementer's session.

- Find every file the work touches: stores, components, `lib/` modules, types, DB schema,
  export/import, tests. Use `Read` for single files (the trim hook only fires there) and
  `grep` across files.
- Record real facts: file paths, line numbers for the functions to change, file sizes
  against the 150-line component limit, existing helpers to reuse, existing test files
  and their patterns.
- Look for what breaks: id remapping on import, Dexie schema versions, render cost on the
  canvas (primitive selectors only), `connect-src` in `public/_headers`, write-failure
  handling, provider differences (OpenRouter vs Ollama).
- Check which test files already exist. Mark new ones `(new)`.

## 3. Write the spec folder

Path: `specs/roadmap-items-<slug>-<YYYY-MM-DD>/`. Use today's date. Look at the newest
folder in `specs/` and match its format.

### `README.md`

- Title, date, the roadmap item it serves (section + entry name), where the ideas came from.
- **The idea in one paragraph**: plain English, what a user gets.
- **Phases table**: phase (linked) · idea · what a user gets · depends on.
- **Order**: recommended sequence, which phases make a first release, what can be skipped.
- **Settled design decisions (do not re-derive)**: every decision made in the discussion
  or the roadmap, one bullet each, with the reason.
- **Rules for every task** (copy and adapt):
  - One task = one vertical slice: logic + UI + test, user-visible or test-visible on its own.
  - Max 5 source files touched per task (tests count separately).
  - Each task ends green on `npm run check` and is its own commit.
  - `CLAUDE.md` constraints apply (immutable Zustand updates, async/await on Dexie,
    components ≤ 150 lines, UI separate from store logic).
  - Any spec-specific rule (no Dexie bump, no new network destination, …).
- **Out of scope**, and **Definition of done** for the whole spec.

### `phase-N-<slug>.md`, one per idea

```markdown
# Phase N — <Name> (idea X)

## Problem
<bullets: what is wrong or missing today, with file:line references>

## Outcome
<bullets: what a user can do after this phase>

## Data model            (only if the phase adds or changes types)

## Tasks

### N.1 <Short name>
- **Files:** <paths, (new) where new; at most 5 source files>
- **Change:** <what to build, concretely: functions, signatures, UI copy, rules>
- **Tests:** <the cases that prove it>
- **Done when:** <one observable condition>

### N.last Close out
- **Files:** `docs/ROADMAP.md`, `docs/CHANGELOG.md`, `docs/STATUS.md` (+ ARCHITECTURE / SETUP if behavior changed)
- **Manual:** <what a human checks on the deployed URL; the implementer cannot do this>
- **Done when:** `npm run check` green; docs match.

## Risks
<bullets: what could go wrong and the guard against it>
```

Task rules:

- **Vertical, not layered.** Prefer "store action + its test" or "component + its test"
  over "all types", "all stores", "all UI". A pure `lib/` module with tests is a valid
  first slice when later tasks build on it.
- **A handful of files.** If a task needs more than 5 source files, split it.
- **Name real things**: existing functions to reuse, line numbers to change, exact UI
  copy where it matters.
- **Order tasks so each one builds on the last** and the app works after every commit.
- **Every phase ends with a close-out task** that updates the docs and lists the manual
  checks.

## 4. Check the spec

Before reporting, reread every phase file and check:

- Every file path exists, or is marked `(new)`.
- No task touches more than 5 source files.
- Each phase's dependencies match the README table.
- No two phases contradict each other on a data shape.
- The settled decisions in the README are respected in every phase.

Fix what fails.

## 5. Sync the roadmap and report

- Point the roadmap entry at the spec: add a line with the spec path and the phase list.
  Update the `STATUS.md` line to match.
- Do not tick anything. Do not commit unless the user asks.
- Report to the user, short:
  1. The spec path.
  2. The phase table (one line per phase).
  3. What was added to `ROADMAP.md` / `STATUS.md`.
  4. Open questions, if any.
  5. How to run it: `/implement-phase specs/<folder> 1`.
