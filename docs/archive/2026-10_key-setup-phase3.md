# Key setup — spec phase 3, implementation record

Date: 2026-10-11 · Branch: `feat/write-failures` (not merged) ·
Spec: `specs/roadmap-items-phase3-front-door-2026-10-11/phase-3-key-setup.md`

## In plain English

- Settings has a "Test connection" button. It checks the key or Ollama address you
  typed, before you save, and costs nothing.
- A bad OpenRouter key now says "OpenRouter rejected this key." right away, not later
  as a failed message.
- For Ollama, the test says how many models are available, or tells you to pull the
  model you picked.
- When Ollama can't be reached, the app lists the three usual causes. One of them is
  Chrome asking permission to reach apps on your computer.
- Next to the Ollama option there is a hint with the exact command to run, already
  filled in with this site's address. It opens by itself when the test fails.
- A row at the top of Settings shows three steps: provider, key, test. It ticks them
  off as you go. It never blocks Save.
- A message that failed because of a bad key or no connection now has a "Check
  connection" button that opens Settings.
- Still open: nobody has tried this on the live site in Chrome and Safari yet.

## Commits

| Task | Commit | What changed |
|---|---|---|
| 3.1 | `a25e2c0` | `lib/connectionProbe.ts`: OpenRouter `GET {base}/key`, Ollama `GET {url}/api/tags`, 8 s timeout composed with the caller's signal, injectable `fetch`. |
| 3.2 | `00c38d5` | `useConnectionTest` (result tied to the inputs it ran with; aborts on edit, reset, unmount) and the presentational `ConnectionTest`. |
| 3.3 | `3983e97` | `SettingsModal` calls the hook and mounts `ConnectionTest` under the credential field. `SettingsFooter` extracted. Test proves the draft key is probed, not the saved one. |
| 3.4 | `65410c5` | `OllamaOriginsHint` inside `SettingsCredentialField`'s Ollama branch, forced open after a `network` failure. |
| 3.5 | `370cb9d` | `useSetupSteps` + `SettingsSteps`: ① Provider ② Key/URL ③ Test, mounted at the top of the modal body. |
| 3.6 | `755cbce` | Optional task done: `useSettingsModalStore` replaces `HeaderBar`'s `useState`; `MessageActions` shows "Check connection" on auth/network errors. |
| 3.7 | `9d5da57` | SETUP §§ 2, 3, 4, 7; ARCHITECTURE; CHANGELOG; ROADMAP text; STATUS. |

`npm run check` passes: tsc, oxlint, 510 tests in 66 files (up from 460 in 62).

## Where the build departed from the spec

- **Branch:** built on `feat/write-failures`, on top of phases 1–2, because those were
  not merged and Phase 3 restructures the same `SettingsModal`.
- **OpenRouter `/key` shape confirmed** against the docs on 2026-10-11:
  `{ data: { limit_remaining: number | null, … } }`, 401 on a bad key. A pass shows
  "Key accepted." plus the credit left when the key has a limit.
- **Caller abort:** `probeConnection` rejects with the `AbortError` instead of
  returning a result. The result union has no "cancelled" kind, and the hook drops
  aborted runs anyway.
- **Probe injection:** `useConnectionTest(draft, probe?)` takes the probe as an
  optional second argument, so hook tests need no `fetch` stub.
- **Model check:** Ollama treats `llama3` as `llama3:latest`, so the probe does too.
  The model is passed only when the provider is Ollama.
- **Closing Settings** resets the test result. The modal stays mounted while closed, so
  without this an old result would reappear on reopen.
- **Step 2 label** reads "URL" for Ollama, "Key" for OpenRouter.
- **Hint stays open** once opened (by the user or by a failure), even after the inputs
  change and the forced-open flag drops.
- **"Check connection" match:** `OpenRouter|Ollama 401/403`, and the Chrome, Safari
  and Firefox wordings of a fetch network failure.
- **SettingsModal** ends at 148 lines (limit 150).
- **Not done:** the Safari mixed-content line in the hint. The spec makes it depend on
  the 3.7 live check.
- **ROADMAP box not ticked:** spec 3.7's "done when" includes the manual check.
- **Commit messages:** no `Co-Authored-By` lines, per the user's global instructions.

## Open at the time of writing

- Merge and deploy, then run the 3.7 check on `https://hydragraph.tinythinkerlabs.dev`:
  good key, bad key, Ollama with and without `OLLAMA_ORIGINS`, in Chrome and Safari; in
  Chrome, Local Network Access allowed then blocked.
- Match the hint's Chrome line to the real prompt wording.
- Record Safari's HTTPS → `http://localhost` behavior in `STATUS.md`. Add the
  mixed-content line to the hint only if Safari blocks it.
- Follow-up outside this spec: a passing Ollama probe could count as "configured" at
  the default URL (`configuredProviders`).
- `SETUP.md` §3 still carries the withdrawn "`$0.0000` receipt" known-gap note. Left
  untouched here; it is out of this phase's scope.
- `specs/` was still untracked in git.
