# Hydra Graph — Re-Engineering Plan

**Status:** Proposed
**Created:** 2026-08-31
**Supersedes:** the Phase 4 section of `tasks.md`
**Audience:** implementation agents (assume no prior context; assume limited reasoning budget)

---

## How To Use This Document

This plan is written to be executed by agents that do **not** have deep architectural
context. Every task is self-contained. Do not improvise beyond a task's stated scope.

Each task has the same five fields:

| Field | Meaning |
|---|---|
| **Files** | The only files you should create or modify. If you need to touch another file, stop and report it. |
| **Do** | Numbered, literal steps. Follow them in order. |
| **Done when** | Observable conditions. If you cannot observe them, the task is not done. |
| **Verify** | The exact command or click-path that proves it. |
| **Do not** | Guardrails. Violating these is a task failure even if "Done when" is met. |

**Global rules for every task:**

1. One task per commit. Commit message format: `type(phase-N): short description`.
2. Run `npm run check` before every commit. It must exit clean.
3. Never write to a state object in place. Always produce a new object and a new
   container, or the canvas will not repaint.
4. Keep every component file under 150 lines. If a file would exceed that, split it
   and say so in the commit message.
5. If a task's "Done when" cannot be met, do not partially land it and mark it done.
   Report the blocker and stop.
6. Do not mark a task complete in a tracking file unless you personally ran the
   **Verify** step and saw it pass.

---

## Part 1 — Diagnosis: Why It Is Not Truly Working

The repository builds cleanly, has sixteen tidy commits, and a task matrix claiming
Phases 1–3 are complete. None of that is evidence that the product works, and it does
not. The following is what the source actually does.

### A. The streaming performance fix is a placebo

`docs/backlog.md` marks P3 "✅ Fixed" because `TurnNodeComponent` was wrapped in
`memo()`. That memo can never hit.

`Canvas.tsx` subscribes to the entire store with no selector, so every single token
delta re-renders the canvas. The re-render recomputes the React Flow node array from
the store map, which allocates a **new object for every node on the board**, including
the `data` object each card receives. `memo()` compares props by reference, so a new
`data` reference on every token means every card re-renders on every token. The edge
array is rebuilt on every token for the same reason. `TurnNode` itself also subscribes
to the whole store with no selector, so it would re-render on every token even if the
props were stable.

Net effect: streaming one response repaints the entire graph at token frequency. The
"fix" addressed the symptom's name, not its cause. This is the single largest reason
the app will feel broken as soon as a tree has more than a handful of nodes.

### B. Streaming state is not durable, and there is no recovery path

Tokens accumulate only in the in-memory store. The database is written once, at
`finalizeNode`, after the stream completes successfully.

Consequences that are all currently reachable:

- Reload mid-stream and the partial response is gone, while the node's stored row
  still says `status: 'streaming'`. It renders as a pulsing cyan card forever, with no
  affordance to clear it. There is no code path that can ever move that row out of
  `streaming`.
- On a stream error, the status is set in memory only. The stored row keeps
  `streaming`. Same zombie state, plus the error text goes to `console.error` and is
  never surfaced, stored, or shown. The user sees a red ring and nothing else.
- `submitPrompt` builds and returns an abort function. `TurnNode` discards the return
  value. There is no cancel button and no way to stop a runaway generation.

### C. A node is a one-shot dead end

`TurnNode` renders its input textarea only while `userPrompt` is empty. The moment a
prompt is submitted the input is gone permanently. There is no edit, no retry, no
regenerate, and no delete.

Combined with B, a single bad API key permanently bricks every node the user touched:
the prompt is set, the response is empty, the status is stuck, and there is no control
that can recover it. The backlog logs this as U3, "no way to delete a node," which
badly understates it.

### D. The app cannot be configured, and its settings row may not exist

There is no settings UI (U1), so the only documented way to enter an API key is to
hand-edit IndexedDB in DevTools. `docs/current_state_and_next_steps.md` admits the
end-to-end flow has therefore never actually been run — yet `tasks.md` marks all of
Phase 3 complete.

Underneath that, the settings row is fragile. `loadSettings` falls back to defaults
**in memory only** and never writes them. `loadTree` persists the active tree with an
update call, which silently does nothing when the row does not exist. The row only
comes into being as an incidental side effect of the first `createTree`. Session
restore works today by accident of ordering, not by design.

### E. Stream parsing silently drops data at chunk boundaries

Both the Gemini and Ollama readers decode each network chunk in isolation and split it
on newlines, with no buffer carried between reads. Any protocol frame that straddles
two reads is malformed when parsed, and both parsers swallow parse failures in an empty
catch block.

Two real defects follow. Tokens go missing mid-response with no error anywhere. And
because the decoder is not told the stream is continuing, any multi-byte character
split across a read boundary is corrupted — emoji, accented characters, and CJK text
will mangle. Gemini extraction also reads only the first part of each chunk, so
multi-part chunks lose content.

This is invisible in short tests and consistently wrong on long research answers, which
is precisely the workload the product exists for.

### F. Per-node model selection is a lie

Every node stores `modelUsed` and displays it in its footer badge. Nothing reads it.
Requests always use the global default model, so the badge can display a model that was
never called.

Provider routing is a coin flip: the client uses Gemini if a Gemini key is present,
otherwise Ollama. A user with a Gemini key configured can never reach a local model.
`openRouterApiKey` exists in the type, the schema, and the settings default with no
client behind it.

This kills the design document's headline capability — comparing personas or models
side by side against identical upstream context — because the model and the persona
cannot actually be varied per branch.

### G. The features that make it a research tool are absent

Everything below is specified in `docs/architecture_design.md` and does not exist:

- **No markdown or code rendering.** Responses render as a plain paragraph inside a
  320px-wide card capped at a fixed max height. LLM research output is mostly headings,
  lists, tables, and code. The core artifact of the product is unreadable.
- **No collapse/expand.** `isCollapsed` is written on every node and read by nothing.
- **No system prompt override editing.** The amber badge renders if the field is set;
  no UI can ever set it. Cascading personas — section 2.3 of the design — are
  unreachable.
- **No auto-layout.** New children are placed at a fixed offset from the parent based
  on that parent's child count. Children of different parents therefore collide on any
  tree deeper or wider than a demo.
- **No tree switcher, header, title, search, export, or import.**

### H. Documentation drift, and no verification net at all

- `CLAUDE.md` and the design doc mandate React 18 and Zustand 4.5. The repo ships React
  19 and Zustand 5. Agents are being instructed against the wrong framework.
- The design doc's mandatory execution loop requires `npm run check`. That script does
  not exist in `package.json`.
- `@google/generative-ai` is installed but imported nowhere. It is also the deprecated
  legacy Google SDK.
- **There are zero tests and no test runner.** Every "phase complete" claim rests
  entirely on the TypeScript compiler exiting zero.
- `docs/current_state_and_next_steps.md` is listed in `.gitignore`. The project's own
  status document is untracked.

### I. Boot race on first run

The bootstrap effect in `App.tsx` has an empty dependency array and no guard against
re-entry. Under React 19 StrictMode the effect runs twice in development, and both runs
can observe no active tree before either commits one — creating two trees and two root
nodes on a fresh install.

### J. Smaller items, carried into the phases below

- The API key is sent in the URL query string, where it lands in history and referrer
  logs. A request header is the supported alternative.
- Ollama refuses browser origins unless `OLLAMA_ORIGINS` is configured. This is
  undocumented, so local-model support appears broken on first contact.
- Position-write debounce timers are never cleared when the canvas unmounts.
- The store-to-canvas sync effect is gated on a ref, which is not reactive. Store
  updates that arrive during a drag are dropped rather than deferred, so a response
  streaming into a node being dragged stops visibly updating.

### Summary

Phases 1–3 delivered structure, not function. The data model is sound and the ancestry
traversal is correct. What is missing is everything that makes the structure usable:
durability, recoverability, configurability, readable output, and a render path that
survives streaming. The plan below fixes those in dependency order.

---

## Part 2 — The Five Phases

| Phase | Theme | Why it is in this position |
|---|---|---|
| 1 | Ground truth and safety net | Nothing else is trustworthy until docs match reality and tests exist. |
| 2 | Make the core loop actually work | Configurable, durable, recoverable, cancellable generation. |
| 3 | Render path | Make streaming survive a real graph before adding more UI to it. |
| 4 | The research surface | Readable output and the node interactions the product is for. |
| 5 | Workspace and scale | Layout, multi-tree management, portability. |

---

# Phase 1 — Ground Truth & Safety Net

**Goal:** the repository stops lying about itself, and there is a way to prove a change
did not break anything.

**Exit criteria:** `npm run check` runs types, lint, and tests together and passes.
Pure logic has test coverage. Docs describe the stack that is actually installed.

---

### T1.1 — Add a test runner

**Files:** `package.json`, `vite.config.ts`, one new test setup file under `src/`

**Do:**
1. Add Vitest and a DOM environment library as dev dependencies. Add React Testing
   Library and a fake IndexedDB implementation as dev dependencies.
2. Configure the test environment in the existing Vite config so tests run in a
   simulated DOM.
3. Create a test setup file that installs the fake IndexedDB into the global scope
   before tests run, and register it in the config.
4. Add a `test` script that runs the suite once and exits.
5. Create one trivial placeholder test asserting a true statement, purely to prove the
   runner works.

**Done when:** the placeholder test runs and passes.

**Verify:** `npm test` exits zero and reports one passing test.

**Do not:** add a coverage threshold, a CI workflow, or any test for application code
in this task.

---

### T1.2 — Add the `check` script the docs already require

**Files:** `package.json`

**Do:**
1. Add a `check` script that runs, in sequence: the TypeScript build check, the linter,
   and the test suite.
2. Make it fail fast — if any step fails, the script must exit non-zero.

**Done when:** `npm run check` exists and exits zero on the current tree.

**Verify:** run `npm run check`; then temporarily introduce a type error in any file,
confirm it exits non-zero, and revert.

**Do not:** change any application source in this task.

---

### T1.3 — Remove the unused Google SDK dependency

**Files:** `package.json`, `package-lock.json`

**Do:**
1. Confirm by searching all of `src/` that `@google/generative-ai` is imported nowhere.
2. If and only if there are zero imports, uninstall it.

**Done when:** the dependency is gone from both files and the build still passes.

**Verify:** `npm run check` exits zero, and a search for the package name across `src/`
returns nothing.

**Do not:** replace it with another SDK. The streaming client intentionally uses the
platform fetch API.

---

### T1.4 — Correct the stack documentation

**Files:** `CLAUDE.md`, `docs/architecture_design.md`

**Do:**
1. Read the installed versions of React, Zustand, TypeScript, Vite, and React Flow from
   `package.json`.
2. Update the framework and state-management lines in `CLAUDE.md` to state the versions
   that are actually installed.
3. Update the technology stack table in the design document's section 3.2 to match.
4. In the design document, add a short note under that table stating that the table
   records installed versions and must be updated whenever a major dependency changes.

**Done when:** no version claim in either document contradicts `package.json`.

**Verify:** read both documents against `package.json` line by line.

**Do not:** downgrade any dependency to match the old documents. The documents are
wrong, not the code.

---

### T1.5 — Track the status document

**Files:** `.gitignore`, `docs/current_state_and_next_steps.md`

**Do:**
1. Remove the line that ignores `docs/current_state_and_next_steps.md`.
2. Rewrite that document to describe the state honestly: which capabilities are
   verified working end to end, which are implemented but never exercised, and which
   are absent. Use the diagnosis in Part 1 of this plan as the source of truth.
3. Commit the document so it is tracked from now on.

**Done when:** the file is tracked by git and contains no claim contradicted by Part 1.

**Verify:** `git status` shows the file tracked and clean after commit.

**Do not:** delete the file, and do not restore any "Phases 1–3 fully implemented"
framing.

---

### T1.6 — Test the context engine

**Files:** one new test file next to `src/lib/contextEngine.ts`

**Do:** write tests covering each of these cases against the existing exported
traversal function. Build the node maps directly in the test; do not touch the database.
1. A lone root node with a prompt produces exactly one user message.
2. A three-deep chain produces messages in root-to-leaf order, alternating user and
   assistant.
3. The target node's own assistant response is excluded from the messages, even when
   that node already has stored response text.
4. A sibling branch's content never appears in the other sibling's messages.
5. With no override anywhere, the resolved system prompt is the passed-in default.
6. With an override on the root only, that override is used.
7. With overrides on both the root and a mid-chain node, the one nearest the target
   node wins.
8. An override consisting only of whitespace is ignored and does not shadow an
   ancestor's real override.
9. A node whose parent id points at a node missing from the map terminates the walk
   without throwing.

**Done when:** all nine cases pass.

**Verify:** `npm test` shows nine passing assertions in this file.

**Do not:** modify `contextEngine.ts` in this task. If a test reveals a bug, record it
in `docs/backlog.md` and finish the task with that test skipped and clearly annotated.

---

### T1.7 — Make the settings row durable

**Files:** `src/store/useTreeStore.ts`

**Do:**
1. Change settings loading so that when no stored row is found, the default settings
   are written to the database immediately, not just placed in memory.
2. Change every place that persists a settings change so it writes the complete row
   rather than patching an assumed-existing row. There are currently three such call
   sites: the settings saver, the tree loader, and the tree creator.
3. Ensure the active tree id is persisted through that same path.

**Done when:** a settings row exists in the database after the very first load, before
any tree is created.

**Verify:** clear site data, load the app, and inspect IndexedDB — the settings store
must contain one row with the default model and Ollama URL populated.

**Do not:** change the shape of the settings type in this task.

---

### T1.8 — Fix the boot race

**Files:** `src/App.tsx`

**Do:**
1. Add a guard so the bootstrap sequence can only execute once per page load, even if
   the effect is invoked twice by StrictMode. Use a ref-based latch checked and set
   synchronously at the top of the effect.
2. Resolve the lint warning about the effect's missing dependencies. Prefer reading the
   store's actions from the store's own non-reactive accessor inside the effect, so the
   dependency array can legitimately be empty.
3. Re-check the "does an active tree already exist" condition immediately before
   creating a tree, using freshly read state rather than state captured earlier.

**Done when:** a fresh load in development creates exactly one tree and one root node.

**Verify:** clear site data, run the dev server, load the page once, and confirm the
trees store in IndexedDB contains exactly one row. Also confirm `npm run lint` reports
no warnings.

**Do not:** disable StrictMode. It is surfacing a real bug.

---

### T1.9 — Test the store's node operations

**Files:** one new test file next to `src/store/useTreeStore.ts`

**Do:** using the fake IndexedDB from T1.1, write tests that:
1. Creating a tree produces one tree row and one root node row, with the root's parent
   pointer empty.
2. Adding a child node appends the child's id to the parent's child list, both in
   memory and in the database.
3. Appending a token delta produces a new node object rather than modifying the
   existing one — assert that the object reference before the append is not the same
   reference as after, and that the earlier reference's text is unchanged.
4. Appending a token delta for an id that is not present leaves state untouched.

**Done when:** all four pass.

**Verify:** `npm test`.

**Do not:** make network calls in these tests.

---

# Phase 2 — Make The Core Loop Actually Work

**Goal:** a user can configure the app in the UI, send a prompt, watch it stream, cancel
it, survive a reload, see errors, and retry — for both a cloud and a local provider.

**Exit criteria:** every failure mode in diagnosis sections B, D, E, and F has a
recovery path exercised by hand at least once.

---

### T2.1 — Settings panel

**Files:** two new component files under `src/components/`, plus `src/App.tsx`

**Do:**
1. Create a modal component that reads current settings from the store and edits a
   local draft copy.
2. Include fields for: Gemini API key, OpenRouter API key, Ollama base URL, and default
   model. Render the two key fields as masked inputs with a show/hide toggle.
3. Include Save and Cancel. Save persists the whole draft through the store's settings
   saver. Cancel discards the draft without writing.
4. Create a small header bar component that renders the current tree title and a
   settings button that opens the modal.
5. Render the header above the canvas in `App.tsx`, with the canvas filling remaining
   height.

**Done when:** a key entered in the modal survives a page reload.

**Verify:** open the app, enter a key, save, reload, reopen the modal — the key is
still there. Confirm the row in IndexedDB updated.

**Do not:** log key values anywhere. Do not put the key in the page title, a URL, or
any element attribute other than the input's own value.

---

### T2.2 — First-run guidance

**Files:** the header component from T2.1

**Do:**
1. Detect the state where no Gemini key, no OpenRouter key, and no reachable Ollama URL
   have been configured.
2. In that state, render a persistent banner in the header explaining that a provider
   must be configured, with a button that opens the settings modal.
3. Hide the banner once any provider is configured.

**Done when:** a fresh install shows the banner, and configuring a key dismisses it.

**Verify:** clear site data, load, observe banner, save a key, observe it disappear.

**Do not:** block the canvas or use a blocking dialog. The banner must be dismissible by
configuring, not by closing.

---

### T2.3 — Fix stream chunk buffering

**Files:** `src/lib/streamingClient.ts`

**Do:**
1. In both provider readers, create a text decoder configured to handle streaming input
   so that multi-byte characters split across reads are reassembled correctly.
2. Maintain a string buffer across reads. On each read, append the newly decoded text to
   the buffer, then split off only the **complete** lines — the trailing fragment after
   the last newline must stay in the buffer for the next read.
3. After the reader reports the stream is finished, flush the decoder and process any
   remaining buffered content as a final line.
4. In both readers, replace the silent empty catch around parsing with one that records
   the malformed payload through the error reporting path but does not abort the stream.

**Done when:** no complete protocol frame can be lost to a read boundary.

**Verify:** write a unit test that feeds a byte stream where one JSON frame is split
across two reads, and one where a multi-byte character is split across two reads. Assert
that the full text is emitted intact in both cases.

**Do not:** buffer the entire response before emitting. Tokens must still be emitted
incrementally as complete frames arrive.

---

### T2.4 — Extract all parts from provider chunks

**Files:** `src/lib/streamingClient.ts`

**Do:**
1. In the Gemini reader, iterate every part of the first candidate's content and emit
   each part that carries text, in order, rather than reading only the first part.
2. Skip parts flagged as internal reasoning rather than emitting them as answer text.
3. Keep taking usage metadata from whichever frame carries it, preferring the last one
   seen.

**Done when:** a chunk containing two text parts emits both, in order.

**Verify:** extend the T2.3 test with a fixture chunk carrying multiple parts, and
assert both texts arrive concatenated in order.

**Do not:** change the Ollama reader in this task.

---

### T2.5 — Move the API key out of the URL

**Files:** `src/lib/streamingClient.ts`

**Do:**
1. Remove the API key from the Gemini request URL's query string.
2. Send the key as a request header instead, using Google's documented API key header.
3. Leave the streaming query parameter that selects server-sent-event framing in the
   URL.

**Done when:** the request URL contains no secret.

**Verify:** with a valid key configured, send a prompt and inspect the request in the
browser network panel — the URL must contain no key, the header must carry it, and the
response must still stream.

**Do not:** store or cache the key anywhere new.

---

### T2.6 — Explicit provider routing and per-node model

**Files:** `src/types/index.ts`, `src/lib/streamingClient.ts`, `src/store/useTreeStore.ts`, `src/db/ChatDatabase.ts`

**Do:**
1. Add a provider identifier field to the settings type with the allowed values for the
   cloud Gemini provider, OpenRouter, and local Ollama. Add the same field to the node
   type so a node can record which provider produced it.
2. Add a database version bump with an upgrade step that assigns every existing settings
   row and node row a provider value inferred from what is currently configured.
3. Change the streaming entry point to select its provider from the explicit setting
   rather than from whether a key happens to be present.
4. Change the request builders to take the model name from the node being generated
   into, falling back to the default model only when the node has none.
5. Have the store pass the target node's provider and model into the streaming call.

**Done when:** with a Gemini key saved, selecting the Ollama provider routes to Ollama.

**Verify:** configure both a Gemini key and a local Ollama URL. Switch the provider
setting and confirm in the network panel that the request goes to the selected host in
each case.

**Do not:** implement the OpenRouter request client in this task; leave it as an
unreachable branch that reports a clear "not yet implemented" error.

---

### T2.7 — Persist streaming progress incrementally

**Files:** `src/store/useTreeStore.ts`

**Do:**
1. Add a throttled writer that flushes the in-progress response text of a streaming node
   to the database at most once or twice per second, without blocking token appends.
2. Trigger that writer from the token-append action.
3. On stream completion, cancel any pending throttled write and perform the final write
   synchronously so the last tokens cannot be lost to a race.
4. On stream error, write both the terminal status and whatever partial text has
   accumulated.

**Done when:** reloading during a stream preserves the text received before the reload.

**Verify:** start a long generation, wait a few seconds, reload the page, and confirm the
partial answer is present in the card after reload.

**Do not:** write on every single token. That will saturate IndexedDB and stall the
render loop.

---

### T2.8 — Store and surface stream errors

**Files:** `src/types/index.ts`, `src/db/ChatDatabase.ts`, `src/store/useTreeStore.ts`, `src/components/TurnNode.tsx`

**Do:**
1. Add an optional error message field to the node type, included in the same database
   version bump as T2.6 if that task has not yet shipped, otherwise in a new one.
2. On stream failure, persist the terminal status and a human-readable error message on
   the node, replacing the current console-only reporting.
3. Clear the stored error message whenever a node begins a new generation.
4. In the node card, when the status is the error state, render the stored message in a
   bounded, scrollable area with a distinct error treatment.

**Done when:** an invalid API key produces a card showing the provider's actual error
text, and that text survives a reload.

**Verify:** save a deliberately wrong key, send a prompt, read the message on the card,
reload, confirm it is still shown.

**Do not:** render the raw error into any element that interprets HTML.

---

### T2.9 — Recover zombie streaming nodes on load

**Files:** `src/store/useTreeStore.ts`

**Do:**
1. In the tree loading action, after reading nodes from the database, find every node
   whose stored status is the streaming state. No stream can be live immediately after a
   load, so all of them are stale.
2. Rewrite each such node to the error status with a stored message explaining that the
   generation was interrupted, preserving any partial response text.
3. Perform these rewrites in a single database transaction, then set the corrected nodes
   into memory.

**Done when:** no card can ever render as streaming immediately after a page load.

**Verify:** start a generation, reload mid-stream, and confirm the card shows the
interrupted-generation error with its partial text rather than a permanently pulsing
border.

**Do not:** silently discard the partial text.

---

### T2.10 — Cancel a running generation

**Files:** `src/store/useTreeStore.ts`, `src/components/TurnNode.tsx`

**Do:**
1. Keep a registry in the store mapping node id to the abort handle returned by the
   streaming call. This registry is transient and must not be persisted.
2. Add a cancel action that looks up a node's handle, invokes it, removes the entry, and
   moves the node to the idle status with its partial text persisted.
3. Remove the entry from the registry on both normal completion and error.
4. In the node card, while the status is streaming, render a cancel control in place of
   the send control.

**Done when:** clicking cancel stops token arrival within one frame and leaves readable
partial text on the card.

**Verify:** start a long generation, click cancel, confirm in the network panel that the
request is aborted, and confirm the partial text persists across a reload.

**Do not:** leave the abort handle in the registry after use; it will pin memory.

---

### T2.11 — Document local provider setup

**Files:** `README.md`

**Do:**
1. Add a short section explaining that a browser page cannot call a local Ollama server
   until Ollama is configured to allow the app's origin, and name the environment
   variable that controls this.
2. Give the exact value to use for the Vite dev server origin.
3. Note that the symptom of a missing configuration is a request that fails before any
   response arrives, not an error from the model.

**Done when:** a reader can get a local model streaming by following the section alone.

**Verify:** follow your own instructions from a shell where the variable is not set, and
confirm they resolve the failure.

**Do not:** instruct anyone to disable browser security features.

---

# Phase 3 — The Render Path

**Goal:** streaming into one node repaints that node, not the graph.

**Exit criteria:** with fifty nodes on the canvas and one node streaming, the other
forty-nine do not re-render, and the canvas holds a smooth frame rate.

---

### T3.1 — Build a render-cost harness

**Files:** one new development-only utility file under `src/lib/`, `src/App.tsx`

**Do:**
1. Create a utility that, when a development-only flag is on, counts renders per node
   card and exposes the tally on the window object.
2. Create a development-only action that seeds the active tree with fifty nodes in a
   branching shape, with realistic multi-paragraph response text.
3. Wire both behind an environment check so neither ships in a production build.

**Done when:** you can seed fifty nodes and read a per-node render tally from the
console.

**Verify:** seed the tree, reset the tally, stream one response, and record the counts.
Write the numbers into `docs/backlog.md` as the pre-fix baseline.

**Do not:** skip recording the baseline. The remaining Phase 3 tasks are graded against
it.

---

### T3.2 — Replace whole-store subscriptions with selectors

**Files:** `src/components/Canvas.tsx`, `src/components/TurnNode.tsx`

**Do:**
1. In the canvas, replace the unselected store subscription with narrow selectors that
   read only the node collection and only the specific actions used.
2. In the node card, replace the unselected store subscription with narrow selectors for
   only the actions it invokes. Actions are stable references, so subscribing to them
   must not cause re-renders.
3. Confirm no component anywhere calls the store hook without a selector.

**Done when:** no component re-renders because of a store field it never reads.

**Verify:** re-run the T3.1 measurement and confirm the counts dropped versus baseline.

**Do not:** move state out of the store into component state to dodge the problem.

---

### T3.3 — Decouple streaming text from node object identity

**Files:** `src/store/useTreeStore.ts`, `src/components/TurnNode.tsx`, `src/components/Canvas.tsx`

**Do:**
1. Add a separate store map, keyed by node id, holding only the live in-flight response
   text for nodes that are currently streaming.
2. Change the token-append action to write only into that map, leaving the main node
   objects and the main node map untouched during a stream.
3. On completion, cancellation, or error, write the final text into the node object once
   and remove the entry from the live map.
4. In the node card, read the live text for its own id via a selector that returns only
   that id's entry, so a card only re-renders when its own text changes.
5. Have the card display the live text when present and the stored response otherwise.

**Done when:** appending a token changes no object that the canvas's node array is
derived from.

**Verify:** re-run the T3.1 measurement. With one node streaming, every other node's
render count must stay at zero for the whole stream.

**Do not:** duplicate the finished response in both maps. Exactly one place owns the
text at any moment.

---

### T3.4 — Stabilise the derived node and edge arrays

**Files:** `src/components/Canvas.tsx`

**Do:**
1. Derive the edge array from a value that changes only when the parent-child structure
   changes, not from the whole node collection.
2. Ensure the object handed to each card as its data prop keeps a stable reference for as
   long as that node's own persisted fields are unchanged. Cache per node id and reuse
   the cached object when the source node object is unchanged.
3. Make sure adding or removing a node still updates both arrays correctly.

**Done when:** repositioning one node does not allocate new data objects for any other
node.

**Verify:** with the tally running, drag one node and confirm only that node's card
re-renders.

**Do not:** disable React Flow's change handling to achieve this.

---

### T3.5 — Fix the drag-versus-store sync

**Files:** `src/components/Canvas.tsx`

**Do:**
1. Replace the non-reactive drag flag guarding the store-to-local sync with an approach
   that does not drop updates: always accept incoming store changes, but for the node
   currently being dragged, preserve the local position rather than the stored one.
2. Ensure that when a drag ends, local and stored positions converge without a visible
   jump.
3. Confirm that a response streaming into a node still updates visibly while that node
   is being dragged.

**Done when:** dragging never discards a content update.

**Verify:** start a generation, drag that node while it streams, and confirm text keeps
appearing throughout the drag and the node does not snap on release.

**Do not:** remove the position-write debounce; it is doing useful work.

---

### T3.6 — Clean up canvas timers

**Files:** `src/components/Canvas.tsx`

**Do:**
1. Add an unmount cleanup that clears every outstanding position-write timer.
2. Before clearing, flush any pending position writes so an in-flight drag is not lost
   when a tree is switched.

**Done when:** unmounting the canvas leaves no pending timers.

**Verify:** drag a node and immediately trigger an unmount within the debounce window;
confirm the position is persisted and no warning about updating an unmounted component
appears.

**Do not:** lengthen the debounce to make the race less likely.

---

### T3.7 — Cap and virtualise long response text in cards

**Files:** `src/components/TurnNode.tsx`

**Do:**
1. Cap the text rendered inside a card to a bounded number of characters from the end of
   the response while streaming, so a very long generation cannot grow the DOM without
   limit.
2. When the response exceeds that cap, render a clear indicator that the card is showing
   a truncated view, along with a control that will open the full text. Phase 4 supplies
   the full-text view; until then the control may simply be disabled with a tooltip.

**Done when:** a ten-thousand-token response does not degrade canvas frame rate.

**Verify:** stream a deliberately long generation with the tally running and confirm
frame rate stays smooth and card DOM node count stays bounded.

**Do not:** truncate the stored text. Only the rendered view is capped.

---

### T3.8 — Lock in the render budget with a test

**Files:** one new test file next to `src/components/`

**Do:**
1. Write a test that mounts a small canvas with three nodes, appends tokens to one node
   through the store, and asserts that the other two cards rendered exactly once.
2. Update the backlog entry from T3.1 with the post-fix numbers next to the baseline.

**Done when:** the test fails if someone reintroduces an unselected store subscription.

**Verify:** `npm test`; then temporarily revert T3.2 in a scratch edit and confirm the
test fails, then restore.

**Do not:** assert on timing. Assert on render counts, which are deterministic.

---

# Phase 4 — The Research Surface

**Goal:** the thing on the canvas is actually readable and editable, and branches can
carry different personas.

**Exit criteria:** a real research session can be run end to end without touching
DevTools.

---

### T4.1 — Render markdown and code

**Files:** `package.json`, one new component file under `src/components/`, `src/components/TurnNode.tsx`

**Do:**
1. Add a markdown renderer and a syntax highlighting library as dependencies. Choose
   ones that sanitise by default or pair the renderer with a sanitiser.
2. Create a presentational component that takes a markdown string and renders headings,
   lists, tables, inline code, fenced code blocks with highlighting, links, and block
   quotes, styled for the dark slate and indigo palette.
3. Ensure links open in a new tab and carry the attributes that prevent the opened page
   from reaching back into this one.
4. Use this component for the assistant response in the node card, replacing the plain
   paragraph.
5. Add a copy-to-clipboard control on each fenced code block.

**Done when:** a response containing a heading, a table, and a fenced code block renders
correctly formatted and highlighted.

**Verify:** paste a markdown fixture containing all of those into a node's stored
response and confirm the rendering.

**Do not:** enable raw HTML pass-through in the renderer. Model output is untrusted
input.

---

### T4.2 — Resizable cards

**Files:** `src/types/index.ts`, `src/db/ChatDatabase.ts`, `src/components/TurnNode.tsx`, `src/components/Canvas.tsx`

**Do:**
1. Add width and height fields to the node type, with a database version bump that
   assigns the current fixed dimensions to existing rows.
2. Enable React Flow's node resize control on the card, constrained by sensible minimums.
3. Persist the resulting dimensions through the same debounced path used for positions.
4. Make the card's internal layout fill whatever size it is given, with the response
   region taking the remaining space and scrolling internally.

**Done when:** a resized card keeps its size across a reload.

**Verify:** resize a card, reload, confirm the size is retained.

**Do not:** let a card resize below the size where its action controls stop being
reachable.

---

### T4.3 — Full-text reader panel

**Files:** one new component file under `src/components/`, `src/App.tsx`

**Do:**
1. Create a side panel that opens for a selected node and shows the complete, untruncated
   user prompt and assistant response using the markdown component from T4.1.
2. Include a copy-entire-response control and a close control.
3. Wire the truncation indicator added in T3.7 to open this panel.
4. Wire double-clicking a card to open it as well.

**Done when:** the full text of any response is reachable in two interactions or fewer.

**Verify:** stream a long response, confirm the card truncates, open the panel, confirm
the full text is present.

**Do not:** render the panel inside the React Flow viewport; it must sit outside so it is
unaffected by zoom.

---

### T4.4 — Edit prompt and regenerate

**Files:** `src/components/TurnNode.tsx`, `src/store/useTreeStore.ts`

**Do:**
1. Add an edit control to the card that reveals the prompt textarea pre-filled with the
   existing prompt, for any node in the idle or error status.
2. Add a regenerate control that re-runs generation for the existing prompt without
   changing it.
3. Both paths must clear the existing response and any stored error before starting, and
   must go through the same generation entry point used by a first submission.
4. Disable both controls while a node is streaming.

**Done when:** a node that failed can be retried without being deleted.

**Verify:** cause a failure with a bad key, fix the key in settings, click regenerate on
the failed node, and confirm it streams successfully.

**Do not:** silently discard descendant nodes when a prompt is edited. Leave them in
place; T4.6 handles the staleness signal.

---

### T4.5 — Delete a node and its subtree

**Files:** `src/store/useTreeStore.ts`, `src/components/TurnNode.tsx`

**Do:**
1. Add a store action that collects a node and all of its descendants by walking the
   child lists downward.
2. In one database transaction, delete every collected node and remove the deleted root's
   id from its parent's child list.
3. Update the in-memory map in a single state write.
4. Add a delete control on the card that first shows a confirmation naming how many nodes
   will be removed.
5. Refuse to delete the tree's root node, and disable the control there with an
   explanatory tooltip.

**Done when:** deleting a node with children removes exactly that subtree and nothing
else.

**Verify:** build a three-level tree, delete a middle node, and confirm through IndexedDB
that only that node and its descendants are gone and the parent's child list is correct.

**Do not:** delete anything without the confirmation step.

---

### T4.6 — Mark descendants stale after an edit

**Files:** `src/types/index.ts`, `src/db/ChatDatabase.ts`, `src/store/useTreeStore.ts`, `src/components/TurnNode.tsx`

**Do:**
1. Add a boolean stale field to the node type with a database version bump defaulting
   existing rows to not stale.
2. When a node's prompt is edited or regenerated, walk its descendants and mark each one
   stale.
3. Clear a node's stale flag when it is itself regenerated.
4. Render stale cards with a muted visual treatment and a badge explaining that an
   ancestor changed after this answer was generated.

**Done when:** editing a root prompt visibly marks every downstream card as stale.

**Verify:** build a three-level chain, edit the root prompt, and confirm both descendants
show the stale badge; regenerate the middle one and confirm only its own badge clears.

**Do not:** auto-regenerate descendants. That would spend the user's tokens without
consent.

---

### T4.7 — System prompt override editing

**Files:** one new component file under `src/components/`, `src/components/TurnNode.tsx`

**Do:**
1. Create a small editor, opened from the card, for that node's system prompt override.
2. Show the currently inherited system prompt as read-only context above the input, so
   the user can see what they are overriding. Obtain it from the existing context
   resolution logic.
3. Support clearing the override to fall back to inheritance.
4. Ensure the existing amber shield badge appears when an override is set and disappears
   when it is cleared.
5. Mark descendants stale when an override changes, reusing T4.6.

**Done when:** two sibling branches can run different personas over identical ancestry.

**Verify:** create two siblings under one parent, give each a different override, send
the same prompt to both, and confirm the responses differ in the way the personas imply.

**Do not:** apply an override retroactively to already-generated responses.

---

### T4.8 — Collapse and expand subtrees

**Files:** `src/store/useTreeStore.ts`, `src/components/Canvas.tsx`, `src/components/TurnNode.tsx`

**Do:**
1. Add a store action toggling a node's collapsed flag and persisting it.
2. In the canvas, compute the set of nodes hidden by any collapsed ancestor and exclude
   them from both the node and edge arrays.
3. On a collapsed card, render a control showing the count of hidden descendants.
4. Ensure a hidden node that is streaming still completes and persists correctly even
   though it is not rendered.

**Done when:** collapsing a node hides its whole subtree and the count is accurate.

**Verify:** build a tree with a nested collapsed branch, collapse the outer node, and
confirm the count includes descendants at every depth, then expand and confirm the
previous inner collapsed state is preserved.

**Do not:** delete or unload hidden nodes from the store.

---

### T4.9 — Per-node model selector

**Files:** `src/components/TurnNode.tsx`

**Do:**
1. Turn the model badge in the card footer into a control that opens a small picker.
2. Populate it with the models configured for the node's provider, plus a free-text entry
   for a model name not in the list.
3. Persist the selection onto the node so the badge finally reflects what will actually
   be called, using the per-node routing built in T2.6.

**Done when:** two sibling nodes can be generated with two different models.

**Verify:** set two siblings to different models, generate both, and confirm in the
network panel that each request names the model shown on its own badge.

**Do not:** change a node's model while it is streaming.

---

# Phase 5 — Workspace & Scale

**Goal:** the tool holds up across many trees and large graphs, and the user's work is
portable.

**Exit criteria:** a two-hundred-node tree is navigable, and a full workspace can be
exported and restored on another machine.

---

### T5.1 — Auto-layout on branch creation

**Files:** `package.json`, one new file under `src/lib/`, `src/store/useTreeStore.ts`

**Do:**
1. Add the Dagre layout library as a dependency.
2. Create a module that takes the node and edge structure and returns computed
   coordinates for a top-down tree layout, with spacing tuned to the card dimensions.
3. On new child creation, position the child using this module rather than the current
   fixed offset from the parent.
4. Only reposition the new node in this task; leave existing nodes where the user put
   them.

**Done when:** creating several children from several different parents produces no
overlapping cards.

**Verify:** build a tree three levels deep with three children at each of two parents and
confirm visually that no cards overlap.

**Do not:** run the layout on every render.

---

### T5.2 — Manual re-layout command

**Files:** the header component, `src/store/useTreeStore.ts`

**Do:**
1. Add a header control that re-runs the layout module across the entire active tree and
   persists every resulting position in one transaction.
2. Show a confirmation first, warning that manual positioning will be discarded.
3. After applying, fit the viewport to the resulting graph.

**Done when:** a manually scrambled tree can be restored to a clean layout in one action.

**Verify:** drag several nodes into a mess, run the command, confirm a tidy tree and that
positions survive a reload.

**Do not:** make this automatic on load.

---

### T5.3 — Tree switcher

**Files:** one new component file under `src/components/`, the header component

**Do:**
1. Create a sidebar or dropdown listing all trees from the store, showing title and last
   updated time, most recent first.
2. Selecting a tree loads it and makes it active.
3. Include a control to create a new tree, prompting for a title.
4. Include rename and delete, with delete requiring confirmation and removing all of that
   tree's nodes in one transaction.

**Done when:** a user can maintain several independent research trees and switch freely.

**Verify:** create three trees, put distinct content in each, switch among them, reload,
and confirm the last active one is restored with correct content.

**Do not:** allow deleting the last remaining tree without immediately creating a fresh
empty one.

---

### T5.4 — Keep the tree's updated timestamp honest

**Files:** `src/store/useTreeStore.ts`

**Do:**
1. Identify every action that changes a tree's content: adding a node, deleting a node,
   editing a prompt, finishing a generation, and changing an override.
2. Update the active tree's updated timestamp from each of those paths.
3. Do not update it for viewport changes or node position changes alone.

**Done when:** the switcher's ordering reflects real editing activity.

**Verify:** edit an older tree and confirm it moves to the top of the switcher list.

**Do not:** write the timestamp on every token delta.

---

### T5.5 — Search across the active tree

**Files:** one new component file under `src/components/`, the header component

**Do:**
1. Add a search input to the header that filters over the prompts and responses of the
   active tree's nodes.
2. Render results as a list showing the matching node's prompt and a snippet of the match
   in context.
3. Selecting a result pans and zooms the canvas to that node and briefly highlights it.
4. Ensure a collapsed ancestor is expanded automatically when a hidden match is selected.

**Done when:** any node in a two-hundred-node tree is reachable in under five seconds.

**Verify:** seed a large tree with the T3.1 harness, search for a term present in exactly
one deep node, and confirm selection navigates to it.

**Do not:** search across trees that are not loaded.

---

### T5.6 — Export a tree

**Files:** one new file under `src/lib/`, the header component

**Do:**
1. Create a module that serialises one tree and all of its nodes into a single JSON
   document, including a schema version number and an export timestamp.
2. Exclude all secrets. The export must never contain an API key.
3. Add a header control that downloads the document with a filename derived from the tree
   title and the date.

**Done when:** an exported file contains every node with prompts, responses, positions,
overrides, and structure, and no keys.

**Verify:** export a tree, open the file, confirm node count matches and search the file
text for your key to confirm it is absent.

**Do not:** include the transient live-streaming text map or the abort registry.

---

### T5.7 — Import a tree

**Files:** the export module from T5.6, the header component

**Do:**
1. Add an import control that accepts a JSON file produced by the exporter.
2. Validate the schema version and reject an unrecognised one with a clear message.
3. Validate structural integrity before writing anything: every parent reference must
   resolve, child lists must be consistent, and exactly one node must have no parent.
4. Assign fresh identifiers throughout on import so an import can never collide with or
   overwrite an existing tree, remapping all parent and child references consistently.
5. Write the whole import in one transaction, then load the imported tree.

**Done when:** exporting a tree and importing it into a clean profile reproduces it
exactly.

**Verify:** export a three-level tree, clear all site data, import the file, and confirm
structure, text, positions, and overrides all match. Then import the same file twice into
one profile and confirm two independent trees result.

**Do not:** write any node if validation fails. Import is all or nothing.

---

### T5.8 — Context size awareness

**Files:** `src/components/TurnNode.tsx`, the reader panel from T4.3

**Do:**
1. Before generation, estimate the size of the resolved context payload using a simple
   character-based heuristic and show it near the send control.
2. After generation, display the actual reported input and output token counts, which are
   already stored on the node but shown nowhere.
3. When the estimated context exceeds a configurable threshold, show a warning that deep
   chains are approaching the model's limit.

**Done when:** a user can see, before spending tokens, roughly how much context a deep
node will send.

**Verify:** build a ten-deep chain with long responses and confirm the estimate grows
with depth and the warning appears past the threshold.

**Do not:** block generation on the warning.

---

### T5.9 — Canvas viewport persistence and keyboard navigation

**Files:** `src/types/index.ts`, `src/db/ChatDatabase.ts`, `src/components/Canvas.tsx`

**Do:**
1. Add viewport pan and zoom fields to the tree type with a database version bump.
2. Persist the viewport on a debounce as the user pans and zooms, and restore it when the
   tree loads instead of always fitting the whole graph.
3. Add keyboard navigation: move selection to parent, to first child, and between
   siblings, with the viewport following the selection.
4. Add a shortcut to branch from the selected node and one to open the reader panel.
5. Document every shortcut in the README.

**Done when:** reopening a tree returns the user to exactly where they left off.

**Verify:** pan to a deep corner, reload, and confirm the same view. Then navigate a
three-level tree using only the keyboard.

**Do not:** capture keystrokes while focus is inside a textarea or input.

---

## Part 3 — Cross-Cutting Rules

### Database migrations

Several tasks add fields. Every schema change requires a version bump with an explicit
upgrade step that backfills existing rows. Never assume a field exists on a row written
by an older version. Before landing any migration, verify it against a database created
by the previous version, not only against a fresh one.

The tasks that change the schema are T2.6, T2.8, T4.2, T4.6, and T5.9. If several land
in one session, combine them into a single version bump rather than stacking versions.

### Secrets

API keys may exist in exactly two places: the settings row in IndexedDB, and a request
header at call time. They must never appear in a URL, a log line, an error message, an
exported file, or any DOM attribute other than the value of their own masked input.

### Definition of done for a phase

A phase is complete only when every task in it is committed, `npm run check` passes, the
phase's exit criteria have been demonstrated by hand, and `docs/current_state_and_next_steps.md`
has been updated to describe what is now genuinely working. Do not mark a phase complete
on the strength of a passing compile — that error is what produced the current state.
