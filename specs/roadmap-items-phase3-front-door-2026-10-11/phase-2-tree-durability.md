# Phase 2 — Tree durability

## Problem

- Trees live only in IndexedDB. Browsers can delete them. Safari clears site data after
  7 days without a visit; `persist()` does not reliably override that.
- The app never calls `navigator.storage.persist()` or `estimate()`.
- Nothing tells the user where their data lives or prompts an export.
- Export and import already work (`src/lib/treeExport.ts`, `ImportButton.tsx`).

## Outcome

- The browser is asked to protect the data after the first real work.
- After real work, the user is nudged to export, harder if the browser did not grant
  persistence.
- Settings says in one line where data lives, with real usage numbers.
- A person who lost their data has an obvious way back.

## Design decisions

- **Real work** = a non-demo tree with at least `REAL_WORK_TURNS` completed turns
  (`status: 'idle'` with a response). Start at 3 for `persist()` and 6 for the nudge;
  both are constants in one file so they are easy to tune.
- **Urgency is feature-based, never a user-agent check.** Use the result of `persist()`:
  granted → soft nudge, longer interval; not granted/unsupported → firm nudge, shorter
  interval, copy mentions the browser may clear data.
- **Ask again until granted.** Chrome grants `persist()` based on how much the user has
  used the site, so an early "no" can become "yes" later. Re-ask once per session while
  the stored result is not `granted`. Firefox shows the user a real prompt when asked;
  after a block it answers silently, so re-asking does not nag.
- **Export state is per tree.** Export downloads one tree at a time, so one global
  "last exported" date would let exporting tree A silence the nudge for trees B and C.
  Store an export time per tree id, and nudge only when the tree changed since then.
- **State lives in the settings row** as optional fields. No Dexie bump. It is wiped on
  eviction, which is fine: after eviction there is nothing left to protect.
- **Background settings writes must not touch the Settings draft.** `SettingsModal`
  re-syncs its draft on every `settings` change (effect deps `[open, settings]`). This
  phase writes settings in the background (after a turn, on export), which would wipe a
  key the user is typing. 2.2 fixes the effect first.
- No new network calls.

## Tasks

### 2.1 Storage helpers

- **Files:** `src/lib/storageHealth.ts` (new), `src/lib/storageHealth.test.ts` (new)
- **Change:**
  - `requestPersistence(): Promise<'granted' | 'denied' | 'unsupported'>` — checks
    `navigator.storage?.persist`, calls it, catches everything.
  - `isPersisted(): Promise<boolean | null>` — `persisted()` or `null` if unsupported.
  - `readEstimate(): Promise<{ usageBytes: number; quotaBytes: number } | null>`.
  - `formatBytes(n)` for display.
- **Tests:** stub `navigator.storage` for each outcome, including methods that throw.
- **Done when:** no import of React or stores.

### 2.2 Durability fields in settings

- **Files:** `src/types/index.ts`, `src/store/settingsStore.ts`, `src/store/settingsStore.test.ts`,
  `src/components/SettingsModal.tsx`, `src/components/SettingsModal.test.tsx`
- **Change:**
  - `AppSettings` gains optional `persistResult?: 'granted' | 'denied' | 'unsupported'`,
    `exportedAt?: Record<string, number>` (tree id → last export time),
    `exportNudgeDismissedAt?: number`.
  - Action `recordDurability(patch)` — thin wrapper over `updateSettings`, typed to
    `persistResult` and `exportNudgeDismissedAt`.
  - Action `recordExport(treeId)` — immutable merge of `{ [treeId]: Date.now() }` into
    `exportedAt`.
  - `loadSettings` already backfills; confirm an old row loads with them undefined.
  - `SettingsModal`: copy settings into the draft only when `open` turns true, not on
    every `settings` change. `handleForget` already clears its own field, so nothing
    else depends on the re-sync.
- **Tests:** round-trip; old row without the fields; `recordExport` keeps other trees'
  entries; with the modal open and a typed key, a `recordDurability` call leaves the
  draft untouched.
- **Done when:** type-checks; no migration test changes; existing Settings tests pass.

### 2.3 Ask for persistence after the first real work

- **Files:** `src/lib/realWork.ts` (new), `src/lib/realWork.test.ts` (new),
  `src/components/useDurabilityWatcher.ts` (new), `src/App.tsx`
- **Change:**
  - `countCompletedTurns(nodes, treeId)` and `hasRealWork(tree, nodes)` — false for the
    demo tree (`isDemoTree`).
  - `useDurabilityWatcher()`:
    - On mount, if `persistResult` is stored, refresh it from `isPersisted()` (the user
      or browser may have changed it). Write only if it differs.
    - Subscribes to the tree store. First time this session that `hasRealWork` is true
      and `persistResult !== 'granted'`: `requestPersistence()`, then
      `recordDurability({ persistResult })`. Guard so it runs once per session.
  - Mount in `App` after `ready`.
- **Tests:** pure tests for `realWork`; hook tests with a stubbed `requestPersistence`:
  one call and one settings write per session; no call when already `granted`; a
  stored `denied` is asked again in a new session.
- **Done when:** in the dev app, completing 3 turns in a new tree logs one persist call.
  In Firefox, the browser's prompt appears at that point.

### 2.4 Extract the export button and stamp exports

- **Files:** `src/components/ExportButton.tsx` (new), `src/components/ExportButton.test.tsx`
  (new), `src/components/HeaderBar.tsx`
- **Change:**
  - Move the inline export handler out of `HeaderBar` into `ExportButton`. After
    `downloadTreeExport`, call `recordExport(tree.id)`.
  - `HeaderBar` shrinks by ~12 lines. No behavior change otherwise.
  - Optional: let `StorageBanner` (Phase 1.4) reuse `ExportButton` for its quota action.
- **Tests:** click → download called once, `exportedAt[tree.id]` set.
- **Done when:** existing `HeaderBar` tests pass unchanged.

### 2.5 Export nudge

- **Files:** `src/lib/exportNudge.ts` (new), `src/lib/exportNudge.test.ts` (new),
  `src/components/ExportNudge.tsx` (new), `src/components/ExportNudge.test.tsx` (new),
  `src/components/HeaderBar.tsx`
- **Change:**
  - `shouldNudge({ realWork, persistResult, treeUpdatedAt, exportedAt, dismissedAt, now })`
    — pure. Evaluated for the **active** tree; `exportedAt` is that tree's entry.
    - Needs real work (nudge threshold).
    - Never exported → nudge.
    - Exported, and the tree has not changed since (`treeUpdatedAt <= exportedAt`) → no
      nudge. A backup that is still current needs no reminder.
    - Exported and changed since: `granted` → nudge if the export is > 14 days old;
      `denied`/`unsupported`/undefined → > 3 days old.
    - Dismiss snoozes for 24 h.
  - `ExportNudge` strip under the header: "Your trees live only in this browser.
    Export a copy." Firm variant adds "This browser may clear them if you don't visit
    for a while." Contains an `ExportButton` and a dismiss.
  - Mount beside the other banners in `HeaderBar` (one line).
- **Tests:** table test for `shouldNudge`, including "exported, unchanged since" and
  "another tree was exported"; component renders soft vs firm copy.
- **Done when:** 6 completed turns on a non-demo tree shows the strip; exporting that
  tree hides it; exporting a different tree does not.

### 2.6 Import a backup from the demo banner

- **Files:** `src/components/useImportPicker.ts` (new), `src/components/ImportButton.tsx`,
  `src/components/ProviderBanner.tsx`, `src/components/ProviderBanner.test.tsx`
- **Change:**
  - Extract the file-pick + `importTree` logic from `ImportButton` into
    `useImportPicker()` returning `{ inputProps, pick, error, clearError }`.
  - `ImportButton` uses the hook; markup and behavior unchanged.
  - In the **demo** variant of `ProviderBanner`, add a second link: "Returning? Import a
    backup." It uses the same hook and shows errors inline.
  - Only the demo variant. Do not add it to the warning variant.
- **Tests:** banner link opens the picker and a valid file imports a tree; existing
  `ImportButton` tests unchanged.
- **Done when:** from a cold boot you can import a previously exported file in two clicks.

### 2.7 Where your data lives (Settings)

- **Files:** `src/components/DataLocationNote.tsx` (new), `src/components/DataLocationNote.test.tsx`
  (new), `src/components/SettingsModal.tsx`
- **Change:**
  - One paragraph: "Trees are stored in this browser only. Prompts go straight from
    your browser to your chosen provider. Nothing passes through our servers." Plus a
    line from `readEstimate()`: "Using 4.2 MB of 2.1 GB" and, from `isPersisted()`,
    "Browser agreed to keep this data. Still export." / "Not protected — export
    regularly". Don't say "protected" for the granted case: Safari can still clear
    data after 7 days without a visit.
  - **`SettingsModal.tsx` is 142 lines.** Mount the note with one line, and if that
    pushes past 150, first extract the footer/buttons into `SettingsFooter.tsx` in the
    same commit (6 files; allowed here because the extraction is mechanical).
  - Estimate failures render nothing for that line.
- **Tests:** renders both lines with stubs; hides the estimate when `null`.
- **Done when:** the sentence is visible in Settings on the deployed build.

### 2.8 Close out and cross-browser check

- **Files:** `docs/ROADMAP.md`, `docs/CHANGELOG.md`, `docs/STATUS.md`, `docs/SETUP.md` (§ 2 Settings: one line on where data lives)
- **Change:**
  - Tick the storage box; update ROADMAP's cross-browser paragraph to say the "user has been
    here before" detection was replaced by the demo-banner link (README of this spec).
  - Manual run on the deployed URL in Chrome and Safari: complete 6 turns, confirm
    persist result is recorded, nudge appears, export clears it, a second changed tree
    still nudges, clear site data, reload, import via the banner.
  - Firefox: confirm the persistence prompt appears after turn 3, once.
  - Private window: force a quota error (e.g. fill storage from the console) and confirm
    the Phase 1 banner shows and no turn is left generating.
  - Record in `STATUS.md` what Safari actually returned from `persist()`.
- **Done when:** manual checklist done; docs synced.

## Risks

- Safari may return `false` for `persist()` every time. That is expected; the firm
  nudge is the real mitigation.
- Banner stacking: ProviderBanner, StorageBanner, ExportNudge could all show. Ordering:
  storage (error) → provider → nudge. Check the header height on a small viewport.
