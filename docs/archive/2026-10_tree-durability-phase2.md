# Tree durability — spec phase 2, implementation record

Date: 2026-10-11 · Branch: `feat/write-failures` (not merged) ·
Spec: `specs/roadmap-items-phase3-front-door-2026-10-11/phase-2-tree-durability.md`

Spec phase 2 is built as 8 commits: tasks 2.1–2.7 plus the docs. `npm run check` passes
(tsc, oxlint, 460 tests in 62 files, up from 402). The ROADMAP storage box is **not
ticked**: its condition is the manual cross-browser check on the deployed URL, which
had not been run when this was written.

## Commits

| Task | Commit | What changed |
|---|---|---|
| 2.1 | `4183ceb` | `lib/storageHealth.ts`: `requestPersistence`, `isPersisted`, `readEstimate`, `formatBytes`. Every call checks the API exists and catches errors. |
| 2.2 | `ce1a41b` | Settings gains `persistResult`, `exportedAt` (per tree) and `exportNudgeDismissedAt`, plus `recordDurability` and `recordExport`. `SettingsModal` now fills its draft only when it opens, so background writes no longer wipe a key being typed. |
| 2.3 | `9bfecf5` | `lib/realWork.ts` (thresholds 3 and 6 live here). `useDurabilityWatcher` asks for persistence once per session until granted, re-checks the stored result on boot, and logs `[durability] persist() →` in dev. |
| 2.4 | `c877e48` | `ExportButton` extracted from `HeaderBar`. It stamps that tree's export time after the download. |
| 2.5 | `0362046` | `shouldNudge` (pure, table-tested) and the `ExportNudge` strip, mounted below the storage and provider banners. |
| 2.6 | `f3a5f9b` | `useImportPicker` is shared by `ImportButton` and a new "Returning? Import a backup." link, shown on the demo banner only. |
| 2.7 | `740cf65` | `DataLocationNote` in Settings. The modal is now 147 lines, so the footer did not need extracting. |
| 2.8 | `15a153c` | CHANGELOG, ROADMAP (cross-browser paragraph updated), STATUS and SETUP §2. |

## Where the build departed from the spec

- **Watcher signature:** it is `useDurabilityWatcher(enabled)`, not
  `useDurabilityWatcher()`. A hook can't be called conditionally after `ready`, so
  `App` passes `ready` instead.
- **Shared type:** `PersistResult` lives in `types/index.ts`, and `storageHealth.ts`
  re-exports it. That edit to `storageHealth.ts` went into the 2.2 commit.
- **Unknown persistence:** when `isPersisted()` can't tell, the Settings note says
  "Not protected — export regularly".
- **Skipped optional item:** the storage banner does not reuse `ExportButton`.
- **Commit messages:** no `Co-Authored-By` lines, per the user's global instructions.

## Open at the time of writing

- Merge and deploy, then run the 2.8 checklist in Chrome, Safari, Firefox and a
  private window.
- Record in `STATUS.md` what Safari's `persist()` returns.
- `specs/` was still untracked in git.
