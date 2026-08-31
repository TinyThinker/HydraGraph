# Re-Engineering — Phase 1 Summary: Ground Truth & Safety Net

**Phase:** 1 — Ground Truth & Safety Net
**Date:** 2026-08-31
**Branch:** `re-engineer`
**Plan:** `docs/plans/re-engineer.md` (Phase 1, tasks T1.1–T1.9)

## Final `npm run check` result

`npm run check` chains `tsc -b && npm run lint && npm run test` and exits **0**:

```
> hydra-graph@0.0.0 lint
> oxlint

> hydra-graph@0.0.0 test
> vitest run

 RUN  v4.1.11 /Users/osiris/dev/hydra-graph

 Test Files  3 passed (3)
      Tests  14 passed (14)
```

Lint is completely clean (no warnings). 14 tests across 3 files: 1 smoke, 9 context-engine, 4 store.

---

## T1.1 — Add a test runner

- **Done:** Added dev deps `vitest@^4.1.11`, `jsdom@^30.0.1`, `@testing-library/react@^16.3.3`, `@testing-library/jest-dom@^7.0.1`, `fake-indexeddb@^6.2.5` (no `--legacy-peer-deps` needed). Configured a `test` block in `vite.config.ts` (import switched to `vitest/config`): `environment: 'jsdom'`, `globals: true`, `setupFiles: ['./src/test/setup.ts']`, `css: false`. New `src/test/setup.ts` imports `fake-indexeddb/auto`, `@testing-library/jest-dom/vitest`, and registers RTL `cleanup()` in `afterEach`. Added `"test": "vitest run"` script. New `src/test/smoke.test.ts` asserts `1 + 1 === 2`.
- **Files changed:** `package.json`, `package-lock.json`, `vite.config.ts`, `src/test/setup.ts` (new), `src/test/smoke.test.ts` (new).
- **Gate:** `npm test` → 1 passing test, exit 0. `npm run build` → exit 0. `npm run lint` → only the then-known App.tsx warning (later removed by T1.8).
- **Verify:** Automated — `npm test` exits 0 and reports one passing test. Met.
- **Grade: A.** Clean, idiomatic, matches repo style; no coverage threshold or CI added, as instructed.
- **Deviations/blockers:** None. `package-lock.json` changed alongside `package.json` (expected side effect of `npm install`, not called out in the Files field but unavoidable and benign).

## T1.2 — Add the `check` script

- **Done:** Added `"check": "tsc -b && npm run lint && npm run test"` to `package.json` scripts. Fail-fast via `&&`. Does not run `vite build` (type check only, per plan).
- **Files changed:** `package.json`.
- **Gate:** `npm run check` → exit 0. Fail-fast proven by the builder: a temporary type error in `src/main.tsx` made `check` exit non-zero and abort before lint/tests ran; the edit was fully reverted.
- **Verify:** Automated — runs clean now; introduces-a-type-error step confirmed non-zero exit then reverted. Met.
- **Grade: A.** Exactly the required chain, no app source touched.
- **Deviations/blockers:** None.

## T1.3 — Remove the unused Google SDK dependency

- **Done:** Confirmed zero imports of `@google/generative-ai` / `generative-ai` / `GoogleGenerativeAI` anywhere in `src/`. Ran `npm uninstall @google/generative-ai`.
- **Files changed:** `package.json`, `package-lock.json`.
- **Gate:** `npm run check` → exit 0. `grep -rn "generative-ai"` across `package.json` + `package-lock.json` → no hits. Build still passes.
- **Verify:** Automated — dependency gone from both files, source search returns nothing, check green. Met.
- **Grade: A.** No replacement SDK added; native fetch path untouched.
- **Deviations/blockers:** None.

## T1.4 — Correct the stack documentation

- **Done:** `CLAUDE.md` framework line → `React 19 + Vite 8 + TypeScript 6 (Strict Mode)`; state line → `Zustand 5 ...`. `docs/architecture_design.md` §3.2 table version column: Framework `^19.2 / ^8.1`, TypeScript `~6.0`, React Flow `^12.11`, Zustand `^5.0`, Dexie `^4.4`. Added an italic note under the table stating it records installed versions and must be updated on major dependency changes. Also applied the same two line corrections to the duplicated CLAUDE.md blueprint in §7.2. Dagre and native-fetch rows left as-is (dagre is a Phase 5 addition, not installed, so no contradiction).
- **Files changed:** `CLAUDE.md`, `docs/architecture_design.md`.
- **Gate:** `npm run check` → exit 0 (docs-only). No stale `React 18` / `^18.3` / `^5.4` / `^4.5` version claims remain.
- **Verify:** Manual read of both docs against `package.json` line by line — no remaining contradiction. Met.
- **Grade: A.** No dependency downgraded; documents corrected to match code.
- **Deviations/blockers:** None. Editing the §7.2 blueprint copy is slightly beyond the literal "§3.2 table" wording but is inside an allowed file and was necessary to satisfy "no version claim in either document contradicts package.json".

## T1.5 — Track the status document

- **Done:** Removed `docs/current_state_and_next_steps.md` (and the now-orphaned `# Temp / session notes` comment) from `.gitignore`. Fully rewrote the doc: three explicit buckets — **A. Verified working end to end** (Dexie schema, `resolveContextPayload` traversal, clean production build, plus the new Vitest runner and corrected stack docs), **B. Implemented but never exercised** (both streaming clients, token-delta rendering, branch context isolation, session restore, drag persistence, the ineffective `memo()`), **C. Absent** (settings UI, header, node edit/retry/delete, markdown rendering, collapse/expand, override editing, auto-layout, tree switcher/search/export/import, cancel, durable streaming, error surfacing, per-node model, explicit provider routing, OpenRouter). Plus a **Known Defects** section enumerating the ten concrete bugs from Part 1, and a pointer to the plan. No "phases complete" framing.
- **Files changed:** `.gitignore`, `docs/current_state_and_next_steps.md` (now tracked).
- **Gate:** `npm run check` → exit 0. `git check-ignore docs/current_state_and_next_steps.md` → exit 1 (no longer ignored). File committed and clean.
- **Verify:** `git status` shows the file tracked and clean after commit. Met.
- **Grade: A.** Honest, concise (~75 lines), no contradiction with Part 1, file deletion avoided.
- **Deviations/blockers:** None.

## T1.6 — Test the context engine

- **Done:** New `src/lib/contextEngine.test.ts` with a local `createNode` factory and nine `it` cases against `resolveContextPayload`: (1) lone root → one user message; (2) three-deep chain → root-to-leaf, alternating roles, length 5; (3) target's own stored assistant response excluded; (4) sibling branch content absent; (5) no override → default; (6) root-only override wins; (7) mid override beats root (nearest-to-target wins); (8) whitespace-only override ignored, does not shadow ancestor; (9) missing-parent reference terminates the walk without throwing.
- **Files changed:** `src/lib/contextEngine.test.ts` (new).
- **Gate:** `npm test` → all 9 pass. `npm run check` → exit 0.
- **Verify:** Automated — nine passing assertions in this file. Met.
- **Grade: A.** `contextEngine.ts` untouched. No bug revealed, so no `docs/backlog.md` entry and no skipped test — all nine behaviours are correct as implemented.
- **Deviations/blockers:** None.

## T1.7 — Make the settings row durable

- **Done:** `src/store/useTreeStore.ts`: `loadSettings` now `db.settings.put({ ...DEFAULT_SETTINGS })` (fresh object) when no row exists, and sets that same object into state — a row exists in IndexedDB immediately after first load. `loadTree` no longer uses `db.settings.update(...)`; it builds a complete `nextSettings` object, `put`s it, and folds it into the same immutable `set(...)` so memory and DB agree. `createTree` builds `nextSettings` once and uses it for both the `put` and the in-memory `set`. `saveSettings` already wrote a complete row — unchanged. No remaining `db.settings.update(` call in the file.
- **Files changed:** `src/store/useTreeStore.ts`.
- **Gate:** `npm run check` → exit 0. Dispatcher ran a throwaway fake-indexeddb test: `loadSettings` with an empty DB writes a `global_settings` row with `defaultModel: 'gemini-2.5-flash'` and `ollamaBaseUrl: 'http://localhost:11434'`; `createTree` leaves in-memory `settings.activeTreeId` equal to the DB value. Both passed. (Scratch test not committed.)
- **Verify:** Browser step (clear site data → load app → inspect IndexedDB `settings` store for one row with default model + Ollama URL) — **PENDING HUMAN VERIFICATION.** Click-path: DevTools → Application → Storage → IndexedDB → HydraGraphDB → settings → confirm exactly one `global_settings` row with `defaultModel` and `ollamaBaseUrl` populated, present before any tree is created.
- **Grade: A.** Every persist path now writes a full row; settings type shape unchanged; no schema bump; immutability preserved.
- **Deviations/blockers:** None.

## T1.8 — Fix the boot race

- **Done:** `src/App.tsx`: added `bootedRef = useRef(false)`; the effect's first two statements are the synchronous `if (bootedRef.current) return` / `bootedRef.current = true` latch, before any `await`, so the StrictMode second invocation is a no-op. Removed the component-body `useTreeStore()` destructure (also dropped an unnecessary whole-store subscription); actions are read from `useTreeStore.getState()` inside `boot`, so the dependency array is legitimately `[]`. Before `createTree`, a fresh `useTreeStore.getState()` read gates creation on BOTH `settings.activeTreeId` still empty AND top-level `activeTreeId` still null. StrictMode left intact.
- **Files changed:** `src/App.tsx`.
- **Gate:** `npm run lint` → **no output, no warnings** (the previous react-hooks/exhaustive-deps warning is gone). `npm run check` → exit 0. `npm run build` → exit 0.
- **Verify:** Browser step (clear site data → `npm run dev` → load page once → IndexedDB `trees` store has exactly one row) — **PENDING HUMAN VERIFICATION.** Click-path: DevTools → Application → IndexedDB → HydraGraphDB → trees → confirm exactly one row (and `nodes` has exactly one root node) after a single fresh load in dev.
- **Grade: A.** Latch is synchronous and correct; lint warning genuinely resolved (no suppress comment); StrictMode not disabled.
- **Deviations/blockers:** None.

## T1.9 — Test the store's node operations

- **Done:** New `src/store/useTreeStore.test.ts` (fake-indexeddb via the T1.1 setup; `beforeEach` does `db.delete()` / `db.open()` and resets store state). Four cases: (1) `createTree` → one `trees` row + one `nodes` row, root `parentId === null`, id matches `rootNodeId`, one in-memory entry; (2) `addNode(child)` → child id in parent's `childrenIds` both in memory and in `db.nodes.get(rootId)`, child present in both; (3) `appendTokenDelta` twice → `after !== before` (new object), `before.assistantResponse` still `''` (old ref not mutated), `after.assistantResponse === 'Hello world'`; (4) `appendTokenDelta('does-not-exist', …)` → `nodes` Map reference unchanged and root node object identity unchanged. No network calls.
- **Files changed:** `src/store/useTreeStore.test.ts` (new).
- **Gate:** `npm test` → 4/4 pass, full suite 14/14. `npm run check` → exit 0.
- **Verify:** Automated — `npm test`, all four pass. Met.
- **Grade: A.** Immutability contract (case 3) and no-op contract (case 4) both locked in; store source untouched.
- **Deviations/blockers:** None.

---

## Phase 1 Exit Criteria

| Criterion | Status | Evidence |
|---|---|---|
| `npm run check` runs types + lint + tests together and passes | **MET** | `check` = `tsc -b && npm run lint && npm run test`; exits 0; lint clean; 14 tests pass. Fail-fast verified in T1.2. |
| Pure logic has test coverage | **MET** | `contextEngine.resolveContextPayload` — 9 cases (ordering, sibling isolation, cascading override resolution, whitespace handling, missing-parent). Store ops — 4 cases (tree/root creation, child append to memory + DB, token-delta immutability, absent-id no-op). |
| Docs describe the installed stack | **MET** | `CLAUDE.md` and `docs/architecture_design.md` §3.2 (+ §7.2 blueprint) now state React 19 / Vite 8 / TypeScript 6 / Zustand 5 / React Flow 12.11 / Dexie 4.4, matching `package.json`; §3.2 carries a maintenance note. `docs/current_state_and_next_steps.md` is tracked and rewritten honestly. |

All nine tasks landed as individual commits; each graded **A**. No task partially landed, no task failed, no deviation from any task's Files field beyond `package-lock.json` moving with `package.json` (T1.1, T1.3) and the §7.2 blueprint copy corrected alongside §3.2 (T1.4) — both inside allowed files.

## Outstanding / handed to human

Two runtime checks could not be performed headlessly and are handed to a human. Both have automated proxies that passed (a fake-indexeddb test for T1.7; a clean `npm run lint` with the warning gone for T1.8), so confidence is high, but the browser-truth check remains:

1. **T1.7 — settings row exists on first load.** Clear all site data. Load the app. DevTools → Application → Storage → IndexedDB → `HydraGraphDB` → `settings`: confirm exactly one `global_settings` row with `defaultModel` and `ollamaBaseUrl` populated, present *before* any tree is created.
2. **T1.8 — exactly one tree on a fresh dev load.** Clear all site data. `npm run dev`, load the page once. DevTools → Application → IndexedDB → `HydraGraphDB`: confirm `trees` has exactly one row and `nodes` has exactly one (root) row — i.e. no StrictMode-induced duplicate.
