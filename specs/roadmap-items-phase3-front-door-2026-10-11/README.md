# Spec: Phase 3 front door — write failures, durability, key setup

Date: 2026-10-11
Roadmap items: the two open boxes in `docs/ROADMAP.md` § Phase 3, plus the two
`useTreeStore` defects folded into the second box.

| Spec phase | Issue | Roadmap box |
|---|---|---|
| [1 — Write failures](phase-1-write-failures.md) | `persistError` throws on quota; quota is never named | "One honest line about where data lives…" (defects) |
| [2 — Tree durability](phase-2-tree-durability.md) | Browser can delete trees; app never asks it not to or tells the user | same box (trees half) |
| [3 — Key setup](phase-3-key-setup.md) | No connection test; Ollama CORS hint is not in the app | "Key setup in three steps…" |

Revised after review on 2026-10-11 — what changed and why: [review-2026-10-11.md](review-2026-10-11.md).

## Order

1 → 2 → 3. Phase 1 is a prerequisite for 2 (the nudge reads write-failure state). Phase 3 is
independent and can run first if you prefer; nothing in it touches Phase 1–2 files except
`SettingsModal.tsx` (Phase 2 fixes its draft re-sync in 2.2 and adds one line in 2.7;
Phase 3 restructures it).

`ROADMAP.md` lists key setup first. This spec puts it last because it is the only
phase that does not protect user data.

## Rules for every task

- One task = one vertical slice: logic + UI + test, user-visible or test-visible on its own.
- Max 5 source files touched per task (tests count separately).
- Each task ends green on `npm run check` (`tsc -b`, `oxlint`, `vitest run`) and is its own commit.
- Repo constraints from `CLAUDE.md` apply: immutable Zustand updates, async/await on Dexie,
  components ≤ 150 lines, UI separate from store logic.
- Use `Read` (not `cat`) for `.ts`/`.py` files — the trim hook only fires there.
- No Dexie version bump anywhere in this spec. New fields are optional and non-indexed.
- No new network destination. `connect-src` in `public/_headers` stays as is.

## One correction to the roadmap

`ROADMAP.md` says "restore on empty: offer import when the DB is empty **but the user has
been here before**." The app cannot detect that on its own. Eviction wipes IndexedDB,
including the settings row. Safari's 7-day purge also clears `localStorage` and
script-set cookies. No marker the app can write survives. (A cookie set by the server
would outlive Safari's cap, but on a static host that needs edge config. Not worth it
for this.)

Phase 2 task 2.6 does the honest version instead: whenever the app boots into the seeded
demo, show an "Import a backup" link next to it. A first-time visitor sees a link they
ignore. An evicted returner sees the recovery path.

Side effect for Phase 4: an evicted returner looks like a new visitor in any
"came back a second time" count. Treat Safari retention numbers as a floor.

## Out of scope

- File System Access autosave, passphrase unlock, OAuth PKCE, BYO-cloud (see
  `docs/notes/storage-and-key-plan.md`).
- Checking whether an installed web app escapes Safari's purge (separate ~20 min item).
- Treating a successful Ollama probe as "configured" at the default URL (noted in
  Phase 3 as a follow-up; changes `configuredProviders`).
- Recording `usage.cost`, the counterfactual arithmetic, hover detail, 200-node pass.

## Definition of done (whole spec)

- Both Phase 3 boxes in `ROADMAP.md` ticked. `CHANGELOG.md` line added. `STATUS.md` synced
  by hand (version, last commit, next actions, test count).
- `SETUP.md` §§ 2, 4 and 7 match the shipped behavior.
- Manual check on the deployed URL in Chrome and Safari (see each phase's last task).
