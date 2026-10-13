---
name: implement-phase
description: Implement one phase of a spec document end to end. One commit per task, docs kept in sync, push at the end, then a plain-English summary shown and saved to docs/archive/.
argument-hint: <spec-file-or-folder> [phase number or name]
disable-model-invocation: true
---

# Implement a phase

Input: `$ARGUMENTS` — a path to a spec file (or a spec folder) and, optionally, which phase.

## 1. Find the phase

- If the path is a folder, list its files. Pick the file for the requested phase
  (e.g. `phase-3-*.md`). Also read the folder's `README.md` and any `review-*.md`:
  review notes can override the spec.
- If the phase is unclear (no phase given and the doc has several), ask with
  `AskUserQuestion`. Do not guess.
- Read the tasks. In these specs they are `### N.M` headings with **Files**, **Change**,
  **Tests**, **Done when**.

## 2. Preflight

- Read `CLAUDE.md`, `docs/STATUS.md`, `docs/ROADMAP.md`, and the ROADMAP box this phase
  serves.
- `git status`: the tree must be clean apart from untracked files you will not touch. If
  not, stop and ask.
- If on `main`, create `feat/<phase-slug>` first. Never commit to `main`.
- Run `npm run check` once. If it already fails, stop and report: you must not inherit a
  red baseline.
- List the tasks back to the user in one line each before starting.

## 3. Each task = one commit

For each task, in spec order:

1. Read the files the task lists before editing. Follow `CLAUDE.md` rules (150-line
   component limit, immutable Zustand updates, async/await with Dexie).
2. Implement the change and the tests the spec asks for.
3. Run `npm run check`. Fix until green. Never commit a red check.
4. Stage only this task's files by name (`git add <paths>`, never `git add -A`). Check
   with `git diff --cached --stat`.
5. Commit with a conventional message (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`),
   matching recent `git log` style. Body: one or two lines on why, if useful.
   **No `Co-Authored-By` trailer** (user's global rule).
6. Note the short hash and any departure from the spec.

Rules while working:

- **Spec vs. code:** if the spec is wrong about the code (a signature, a line count, a
  file that moved), follow the code and record the deviation. If the gap changes the
  design, stop and ask.
- **Optional tasks:** do them only if they fit the files the spec lists. Otherwise skip
  and record why.
- **Manual tasks** (live checks on a deployed URL, other browsers): you cannot do them.
  Leave them open. Do not tick a ROADMAP box whose condition depends on them.
- **Stuck:** if a task can't go green after a real attempt, stop. Do not commit. Report
  what failed with the output.

## 4. Docs commit

If the spec has its own docs task, that task is this commit. Otherwise add one at the end.
Follow `docs/README.md`:

- `docs/ROADMAP.md`: tick the box only if its full condition is met. Otherwise update
  the text under it to say what is left.
- `docs/CHANGELOG.md`: one entry under `## Unreleased`, newest first, same style as
  the entries around it (date, spec reference, what changed, test count).
- `docs/STATUS.md`: version, last commit, blockers, next actions — by hand.
- `docs/ARCHITECTURE.md` / `docs/SETUP.md`: edit in place if the system's behavior or
  setup changed.

Commit: `docs: record <phase name> (spec phase N)`.

## 5. Persist the summary

Write `docs/archive/YYYY-MM_<phase-slug>.md` (use today's date). Use
`docs/archive/2026-10_tree-durability-phase2.md` as the model, with one addition at the
top:

```markdown
# <Phase name> — spec phase N, implementation record

Date: YYYY-MM-DD · Branch: `<branch>` · Spec: `<spec path>`

## In plain English

<5–10 short bullets. Basic English: what a user can now do, what was fixed, what is
still open. No file names, no jargon. One idea per bullet.>

## Commits

| Task | Commit | What changed |
|---|---|---|

## Where the build departed from the spec

## Open at the time of writing
```

Add the file to the "Current contents" tree in `docs/README.md`. Commit:
`docs: archive the spec phase N implementation record`. This file is never edited again.

## 6. Push and report

- Confirm `npm run check` is green and `git status` is clean.
- `git push -u origin <branch>`. Never force-push. If the push fails, report the error
  and stop.
- Show the user:
  1. The "In plain English" bullets, copied from the record.
  2. The commit table (task → hash → one line).
  3. Open items (manual checks, skipped tasks).
  4. The path of the saved record.

Keep the report short. No closing summary beyond this.
