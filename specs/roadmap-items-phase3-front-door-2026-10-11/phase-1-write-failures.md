# Phase 1 — Write failures

## Problem

- `persistError` (`src/store/useTreeStore.ts:397`) answers a failed stream by awaiting
  `db.nodes.update(...)` first and only then updating memory. It is called unawaited from
  the `onError` callback (`:436`). If that write throws (quota, private window), the
  rejection is unhandled and the node never leaves `streaming`.
- `finalizeNode` (`:330`) has the same shape: DB write (`:343`) before `set(...)`, called
  unawaited from the `onDone` callback (`:432`). It runs at the end of every turn, so it
  is the write most likely to hit quota. A failure leaves the node `streaming` with its
  `liveText` entry still present.
- `cancelGeneration` (`:523`) also writes (`:542`) before `set(...)`, and is called
  unawaited from `MessageActions.tsx:36`. A failed write leaves Stop with no effect on
  screen.
- The throttled flush (`:75`) only `console.error`s. The user sees nothing.
- `importTree` returns the raw `err.message` on write failure.
- Nothing in the app says "storage is full."

## Outcome

- A failed write never leaves a node stuck and never throws unhandled.
- A quota failure produces a visible banner in plain words.

## Tasks

### 1.1 Classify storage errors

- **Files:** `src/lib/storageErrors.ts` (new), `src/lib/storageErrors.test.ts` (new)
- **Change:**
  - `isQuotaError(err: unknown): boolean` — true for `name === 'QuotaExceededError'`
    or a `DOMException` with `code === 22` (older form some browsers still raise).
    Walk the `err.inner` chain: Dexie wraps the original error, and inside a
    transaction it surfaces as an `AbortError` whose `inner` is the quota error.
  - The tests run on fake-indexeddb, which never runs out of space, so a real quota
    error cannot be produced. Build fixtures from Dexie's own classes instead
    (`new Dexie.QuotaExceededError(msg)`, `new Dexie.AbortError(msg, quotaErr)`).
  - `describeWriteError(err: unknown): { kind: 'quota' | 'other'; message: string }`.
    Quota message: "Browser storage is full. New work is not being saved." Other: the
    error's message, or `String(err)`.
- **Tests:** plain `DOMException` (by name and by `code === 22`), Dexie-wrapped,
  `AbortError` with quota `inner`, `Error`, string, `null`.
- **Done when:** pure module, no imports from stores or React.

### 1.2 Make the three end-of-stream writes safe

- **Files:** `src/store/useTreeStore.ts`, `src/store/useTreeStore.test.ts`
- **Change:** same fix in `persistError`, `finalizeNode` and `cancelGeneration`:
  - Call `set(...)` (new status, clear `liveText`) **before** the DB write. Memory is
    the source of truth during a session.
  - Wrap the DB write in `try/catch`. On catch, `console.error` and continue; do not write
    again.
  - With the internal try/catch, none of the three can reject from the write, so the
    unawaited call sites (`:432`, `:436`, `MessageActions.tsx:36`) need no change.
    `finalizeNode`'s trailing `touchActiveTree()` goes inside the same try.
- **Tests (extend existing store tests):**
  - Mock `db.nodes.update` to reject with a `QuotaExceededError`. Run a failing stream.
    Assert: node ends `status: 'error'`, `errorMessage` set, `liveText` entry gone, no
    unhandled rejection (vitest fails the run on one by default).
  - Same mock, successful stream: node ends `status: 'idle'` with the full text,
    `liveText` entry gone.
  - Same mock, cancel mid-stream: node ends `status: 'idle'`, `liveText` entry gone.
  - Normal error and a working DB: behavior unchanged.
- **Done when:** a quota failure on finish, error or cancel never leaves a node
  `streaming`.

### 1.3 Report write failures to a store

- **Files:** `src/store/storageStatusStore.ts` (new), `src/store/storageStatusStore.test.ts`
  (new), `src/store/useTreeStore.ts`
- **Change:**
  - Small Zustand store: `writeFailure: { kind, message } | null`,
    `reportWriteFailure(err)` (uses `describeWriteError`), `clearWriteFailure()`.
    Immutable updates.
  - Call `reportWriteFailure` from: the throttled-flush `.catch` (`:75`), the three DB
    `catch` blocks added in 1.2, and the `importTree` catch (replace the raw message with
    `describeWriteError(err).message`).
  - A later successful write does not auto-clear (the user may not have seen it). Only
    the banner's dismiss clears it.
- **Tests:** store unit test; one store test that a rejected flush sets `writeFailure`.
- **Done when:** a quota failure on any of the three paths is observable in state.

### 1.4 Show the banner

- **Files:** `src/components/StorageBanner.tsx` (new), `src/components/StorageBanner.test.tsx`
  (new), `src/components/HeaderBar.tsx`
- **Change:**
  - `StorageBanner` reads `writeFailure`. `quota` → amber strip: "Browser storage is full.
    New work is not being saved. Export your trees, then delete ones you don't need. In a
    private window, open the app in a normal one." with a dismiss button. (The app has no
    "free space" action; quota is mostly hit in private windows.) `other` → shorter strip with the message.
  - Mount next to `ProviderBanner` in `HeaderBar` (one line; file is 117 lines).
  - Under the quota text, a button that exports the active tree. Reuse `downloadTreeExport`;
    if the inline handler in `HeaderBar` is needed, do the extraction in Phase 2 task 2.4
    and link here afterwards. For now, text only if it would push this task past 5 files.
- **Tests:** renders nothing when null; renders quota copy; dismiss clears.
- **Done when:** forcing `reportWriteFailure` in the dev console shows the banner.

### 1.5 Close out

- **Files:** `docs/ROADMAP.md`, `docs/CHANGELOG.md`, `docs/STATUS.md`
- **Change:** tick the two defect bullets under the Phase 3 storage box, add a changelog
  line, sync STATUS (test count, next actions).
- **Done when:** `npm run check` green; docs match.

## Risks

- Dexie error wrapping differs by version. 1.1's fixtures use the installed Dexie's own
  classes, but they cannot prove what a real browser raises. Force a quota error by hand
  in a private window during the Phase 2 live check.
- `useTreeStore.ts` is 744 lines. Keep the diff to the three functions in 1.2 and the
  report calls in 1.3; no refactor.
