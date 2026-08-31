# Current State & Next Steps

This document describes the repository honestly, sorting every capability into one of three buckets derived from the diagnosis in `docs/plans/re-engineer.md`.

## A. Verified Working End to End

What a human has actually run start to finish and seen work:

- **Dexie/IndexedDB schema and data model** — the shape is correct and persists reliably
- **Ancestry-traversal logic** (`src/lib/contextEngine.ts`, `resolveContextPayload`) — correct root-to-leaf ordering, sibling isolation, cascading system-prompt override resolution
- **Production build** — `npm run build` compiles clean
- **Test runner and framework** — Vitest with jsdom and fake-indexeddb is now in place; pure-logic tests are being added for the context engine and store
- **Stack documentation** — corrected to the installed versions: React 19, Zustand 5, TypeScript 6, Vite 8

## B. Implemented But Never Exercised

Code exists and compiles, but no human has run the full path end to end. All of these are unreachable because there is no settings UI to enter an API key:

- **Gemini SSE streaming client** (`src/lib/streamingClient.ts`) — native fetch-based reader for Google Generative AI streaming protocol
- **Ollama SSE streaming client** (`src/lib/streamingClient.ts`) — native fetch-based reader for Ollama streaming
- **Token-delta streaming into node cards with optimistic store updates** — tokens accumulate in memory and render as they arrive
- **Branch creation and per-branch context isolation** — child sees only its ancestor chain, not siblings; the ancestry resolver is correct but was never exercised in a real session
- **Session restore on reload** — loads the previous active tree and its nodes from IndexedDB; currently works only by accident of load ordering, not by design
- **Node drag with local React Flow state and debounced position persistence** — drag feels local, but positions are debounced to the database
- **`memo()` on TurnNode** — present but completely ineffective (see Known Defects)

## C. Absent

Specified in `docs/architecture_design.md` but not implemented:

- **Settings UI and API-key entry** (backlog U1) — the blocker for end-to-end testing
- **Header bar** (backlog U2) — tree title, new-tree button, settings gear
- **Node edit, retry, regenerate, delete** (backlog U3)
- **Markdown and code-block rendering** — responses render as a single plain paragraph in a 320px card
- **Collapse/expand of subtrees** — `isCollapsed` field is written and read by nothing
- **System-prompt override editing UI** — amber badge renders; no UI can set the field
- **Auto-layout (dagre)** — children use a fixed offset and collide on any tree wider or deeper than a demo
- **Tree switcher, tree title, search, export, import**
- **Cancel/abort control for running generation** — abort function is discarded
- **Durable streaming state and zombie-node recovery** — see Known Defects
- **Stream-error surfacing** — errors go to console.error only
- **Per-node model selection actually influencing the request** — `modelUsed` displayed but never read
- **Explicit provider routing** — currently a coin flip (Gemini if a key exists, else Ollama)
- **OpenRouter client** — field exists in types/schema/defaults, no implementation

---

## Known Defects

**Whole-canvas re-render on every streamed token.** Canvas subscribes to the entire store with no selector. Every token delta re-renders the canvas, which recomputes the React Flow node array from the store map, allocating a new object for every node including the `data` prop. `memo()` compares by reference, so the new `data` reference defeats memoization. TurnNode also subscribes to the whole store, so it re-renders on every token regardless of props. Streaming one response repaints the entire graph at token frequency.

**Streaming state is not durable.** Tokens accumulate only in memory. The database is written once at `finalizeNode`, after the stream completes. Consequences: reload mid-stream and the partial response is gone while the node's stored row still says `status: 'streaming'` — rendering as a pulsing cyan card forever with no recovery. On stream error, the status is set in memory only; the row keeps `streaming` and the error text goes to `console.error` and is never shown.

**Stream parsing silently drops data at chunk boundaries.** Both Gemini and Ollama readers decode each network chunk in isolation and split on newlines with no buffer between reads. Any protocol frame that straddles two reads is malformed when parsed, and both parsers swallow parse failures in empty catch blocks. Tokens go missing mid-response with no error. Multi-byte characters split across a read boundary are corrupted — emoji, accented characters, and CJK text will mangle. Gemini extraction also reads only the first part of each chunk, so multi-part chunks lose content.

**API key is sent in URL query string.** The key lands in browser history and referrer logs. It should be in a request header.

**Ollama browser calls undocumented.** Browser requests fail until `OLLAMA_ORIGINS` is configured. This is not documented, so local-model support appears broken on first contact.

**Canvas position-debounce timers never cleared on unmount.** Timers continue firing after the component is gone.

**Store-to-canvas sync gated on non-reactive ref.** The effect uses a ref flag to drop store updates during a drag, rather than deferring them. Responses streaming into a node being dragged stop visibly updating.

**First-run boot race under React 19 StrictMode.** The bootstrap effect has an empty dependency array and no guard against re-entry. Both invocations can observe no active tree before either commits one, creating two trees and two root nodes on a fresh install.

**Node is a one-shot dead end.** TurnNode renders its input textarea only while `userPrompt` is empty. Once a prompt is submitted the input is gone. There is no edit, retry, regenerate, or delete — making a single bad API key permanently brick every node the user touched.

**Settings row fragile on first load.** `loadSettings` falls back to defaults in memory only and never writes them. `loadTree` persists the active tree with an update call, which silently does nothing if the row does not exist. The row only materializes as an incidental side effect of the first `createTree`. Session restore works today by accident of ordering.

---

## Next

See `docs/plans/re-engineer.md` for the active engineering plan, organized into five phases with concrete implementation tasks and verification steps.
