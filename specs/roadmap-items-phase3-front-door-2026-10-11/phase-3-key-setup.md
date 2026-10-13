# Phase 3 — Key setup with a connection test

## Problem

- `SettingsModal` is a flat form. A bad key or unreachable Ollama only shows up later as
  a failed message.
- Ollama needs `OLLAMA_ORIGINS` set to the app's origin. The fix is written in
  `docs/SETUP.md` § 4 but not shown where users get stuck.
- `SETUP.md` § 4 hardcodes `http://localhost:5173`. The deployed app's origin is
  `https://hydragraph.tinythinkerlabs.dev`.

## Outcome

- A "Test connection" button that says pass or fail in plain words, without spending tokens.
- A light three-step flow: pick provider → enter credential → test.
- The Ollama hint appears next to the Ollama option and opens itself when the test fails.

## Design decisions

- Test uses the **draft** values, not saved ones, so a user can test before saving.
- Probes are read-only, free endpoints:
  - OpenRouter: `GET {base}/key` with the bearer token (`base` defaults to
    `https://openrouter.ai/api/v1`). This is the documented "get current API key"
    endpoint as of 2026-10-11; the older `/auth/key` path is not the one to build on.
    Confirm the response shape when coding 3.1.
  - Ollama: `GET {url}/api/tags` (lists pulled models).
- A browser cannot tell the causes of a failed local request apart — all are a
  `TypeError` from `fetch`. There are three:
  1. Ollama is not running.
  2. `OLLAMA_ORIGINS` does not include the app's origin (CORS).
  3. Chrome's Local Network Access permission (Chrome 142+): a public HTTPS site must
     get the user's permission before it can reach `localhost`. If the user blocks it,
     the request fails the same way.
  The failure copy lists all three. The Test button is a good place for Chrome's
  prompt to appear first, rather than mid-chat.
- **The test result lives in `SettingsModal`.** Three pieces need it: the
  `ConnectionTest` display, the Ollama hint (opens on failure), and the step
  indicator (ticks step 3). `SettingsModal` calls `useConnectionTest` and passes the
  result down.
- Steps are guidance, not gates. Save stays enabled at every step.
- A custom `openRouterBaseUrl` is blocked by the production CSP. The probe reports the
  CSP block as a network failure; copy mentions it only when the base URL is not
  `openrouter.ai`.

## Tasks

### 3.1 Connection probe

- **Files:** `src/lib/connectionProbe.ts` (new), `src/lib/connectionProbe.test.ts` (new)
- **Change:**
  - `probeConnection({ provider, openRouterApiKey, openRouterBaseUrl, ollamaBaseUrl, model, signal })`
    → `{ ok: true; detail?: string } | { ok: false; kind: 'auth' | 'network' | 'http' | 'timeout' | 'missing'; message: string }`.
  - `missing`: no key / empty URL, no request made.
  - OpenRouter 401/403 → `auth` "OpenRouter rejected this key." Other non-2xx → `http`
    with status.
  - Ollama: `ok` with detail "N models available", or if `model` is set and not in
    the list, `ok` with detail "Connected, but model 'x' is not pulled. Run `ollama pull x`."
  - `fetch` `TypeError` → `network`. Own 8 s timeout via `AbortController`, composed
    with the caller's `signal`.
  - `fetch` injectable (parameter with default) so tests need no global stub.
- **Tests:** each outcome, timeout with fake timers, abort.
- **Done when:** pure module, no React or stores.

### 3.2 Connection test control

- **Files:** `src/components/useConnectionTest.ts` (new), `src/components/ConnectionTest.tsx`
  (new), `src/components/ConnectionTest.test.tsx` (new)
- **Change:**
  - Hook: `{ state: 'idle' | 'testing' | 'ok' | 'fail'; result; run(); reset() }`.
    Cancels an in-flight probe on unmount and on `reset()`. Resets to `idle` when the
    inputs change. Called by `SettingsModal` (3.3), not by the component.
  - Component: presentational. Takes `state`, `result` and `onRun` as props. Button
    "Test connection", spinner text "Testing…", green line on `ok`, red line with
    `message` on `fail`.
  - Not mounted yet.
- **Tests:** hook state transitions with a stubbed probe; cancels on unmount;
  component renders each state from props.
- **Done when:** renders standalone in tests.

### 3.3 Mount the test in Settings

- **Files:** `src/components/SettingsModal.tsx`, `src/components/SettingsFooter.tsx`
  (new, only if needed), `src/components/SettingsModal.test.tsx`
- **Change:**
  - Call `useConnectionTest(draft)` in `SettingsModal`. Mount `ConnectionTest` under
    the credential field with its state and `run`.
  - `SettingsModal.tsx` is 142 lines (limit 150) and grows again in 3.4 and 3.5. If
    Phase 2.7 already extracted `SettingsFooter`, reuse that space; otherwise extract
    it here first, once, so 3.4 and 3.5 don't each fight the limit.
  - Save behavior unchanged.
- **Tests:** existing Settings tests pass; a test that the button uses draft values,
  not saved ones.
- **Done when:** typing a bad key and pressing Test shows "rejected this key" without
  saving.

### 3.4 Ollama origin hint

- **Files:** `src/components/OllamaOriginsHint.tsx` (new), `src/components/OllamaOriginsHint.test.tsx`
  (new), `src/components/SettingsCredentialField.tsx` (mount + one prop, 120 lines),
  `src/components/SettingsModal.tsx` (pass the prop)
- **Change:**
  - `<details>` shown only when the draft provider is `ollama`. Contents: the command
    with `window.location.origin` filled in, the macOS `launchctl setenv` variant, and
    "This is the cause when requests fail instantly."
  - Add the Chrome case: "Chrome asks permission before a website can reach apps on
    your computer. Choose Allow. If you blocked it, change it in the site settings
    (icon left of the address bar)." Check the exact prompt wording in 3.7 and match it.
  - Accepts an `open` prop. `SettingsModal` computes it (last probe failed with
    `network` and provider is Ollama) and passes it through `SettingsCredentialField`.
  - Mixed content: Chrome treats `localhost` as secure, and a granted Local Network
    Access permission also lifts mixed-content blocking. Only Safari is unknown.
    **Add a line about HTTPS → `http://localhost` only if the 3.7 Safari check shows a
    block.**
- **Tests:** hidden for OpenRouter; origin string comes from `window.location`; opens on
  `open`; Chrome permission line present.
- **Done when:** selecting Ollama shows the hint.

### 3.5 Three-step indicator

- **Files:** `src/components/useSetupSteps.ts` (new), `src/components/SettingsSteps.tsx`
  (new), `src/components/SettingsSteps.test.tsx` (new), `src/components/SettingsModal.tsx`
- **Change:**
  - `useSetupSteps(draft, testState)` → three steps with `done` flags:
    1. Provider chosen (always true; selected provider shown).
    2. Credential present (key for OpenRouter; URL not empty for Ollama — the URL is
       prefilled, so for Ollama step 3 is the real check).
    3. Test passed.
  - `SettingsSteps` renders a compact row: ① Provider ② Key ③ Test, ticks when done,
    current step highlighted. No hiding of fields, no gating of Save.
  - Mount at the top of the modal body (one line).
- **Tests:** step flags for each draft/test combination.
- **Done when:** the row updates live as the user types and tests.

### 3.6 Optional: test from the failed node

- **Files:** `src/components/MessageActions.tsx`, `src/store/useSettingsModalStore.ts`
  (new), `src/components/HeaderBar.tsx`, tests
- **Change:** an errored turn whose message looks like auth/network shows "Check
  connection", which opens Settings. Requires lifting the modal's `open` state out of
  `HeaderBar`'s `useState` into a tiny store.
- **Cut this task** if it needs more than the listed files. It is a convenience, not part
  of the roadmap box.

### 3.7 Docs, close out, live check

- **Files:** `docs/SETUP.md` § 4 and § 7, `docs/ROADMAP.md`, `docs/CHANGELOG.md`,
  `docs/STATUS.md`
- **Change:**
  - `SETUP.md` § 4: describe the in-app test and hint; replace the hardcoded
    `localhost:5173` with "the origin shown in the hint"; add the deployed origin.
  - Troubleshooting table: add "Test connection says network error" row covering the
    three causes (not running, `OLLAMA_ORIGINS`, Chrome permission blocked).
  - Tick the box, changelog line, sync STATUS.
  - Manual check on `https://hydragraph.tinythinkerlabs.dev`: good key, bad key, Ollama
    with and without `OLLAMA_ORIGINS`, in Chrome and Safari. In Chrome, also: Local
    Network Access allowed, then blocked; note the prompt's exact wording. Record
    results (esp. Safari's HTTPS → localhost behavior) in STATUS.
- **Done when:** manual checklist done; docs synced.

## Follow-up (not in this spec)

`configuredProviders` treats Ollama as configured only once the URL differs from the
default, so a user on the default port still sees the "no provider" banner. A passing
probe could set a `ollamaVerified` flag that counts as configured. Small, but it changes
a function with other callers (banner, fan-out price spread), so it gets its own task.

## Risks

- OpenRouter's `/key` response shape may differ from the docs. 3.1 confirms it.
- Browser rules for public sites reaching `localhost` keep changing (Chrome's Local
  Network Access shipped in 142; Safari's mixed-content behavior is unverified). Only
  the live check settles it.
