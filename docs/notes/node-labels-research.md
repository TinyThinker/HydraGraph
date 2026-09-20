# Canvas Node Labels & Hover Detail — Research

> **Where this fits.** This is the *reasoning* behind making a station pill readable:
> why the current label is unreadable, what the pill can carry without changing its
> geometry, and whether a generated summary is worth a model call. No checklist here.
> If this work is adopted, boxes go in [`../ROADMAP.md`](../ROADMAP.md); this note is
> updated only when the findings themselves change.

**Revision:** 1 — 2026-09-12
**Assessed against:** branch `feat/branch-on-selection-and-streaming-perf` at `fc82dc7`
**Measured, not estimated:** contrast ratios are computed with the WCAG 2.1
relative-luminance formula from the literal Tailwind slate values in
`TurnNode.tsx` + `pathHighlight.ts`. Character budgets are derived from the pill
geometry in `nodeDimensions.ts` and corroborated against a real screenshot.
React Flow behaviour (`NodeToolbar`, `onNodeMouseEnter`) was read from the installed
`@xyflow/react@12.11.2` build, not from docs. ⚠️ marks anything *not* verified:
per-token prices come from the hand-maintained `bundledCatalog.ts` snapshot, and
`Intl.Segmenter`'s browser floor is from memory.

---

## 1. Verdict

**The pill is not too small. Its text is truncated twice, and 61% of the pill is
empty.** Two thirds of the complaint is fixable with no model call, no schema change,
and no new dependency.

| Layer | What it is | Size | Model call? | Schema change? |
|---|---|---|---|---|
| **L1 — Spend the space** | two-line label, real char budget, legible when dimmed | ~40 lines | no | no |
| **L2 — Hover card** | `NodeToolbar` peek that stays legible at any zoom | ~70 lines | no | no |
| **L3 — Real titles** | one `label` field, written by the user *or* a summarizer | ~250 lines | optional | **no migration** |

**Recommendation: ship L1 + L2 now.** They are gated on nothing, they cost no tokens
and no latency, and between them they answer both halves of the request ("say what's
happening" and "hovering should expand a little bit more").

**L3 is worth doing but not first**, and when it lands it should ship *manual rename
before* auto-summarization — a user-typed branch name is better than any generated one
and needs no provider, no key, and no round trip. See §5.1.

---

## 2. What is actually wrong — five defects, not one

| # | Defect | Evidence |
|---|---|---|
| 1 | **The label is truncated twice.** `stationSummary` allows 48 chars; the pill can display 19–29. CSS `truncate` silently re-cuts 40–60% of what the function returned. | `src/lib/stationSummary.ts:3-4`, `src/components/TurnNode.tsx:77` |
| 2 | **Fan-out siblings get identical labels.** Every child is dispatched with the *same* `userPrompt` by construction, so `stationSummary` returns the same string N times. | `src/store/useTreeStore.ts:490-510` |
| 3 | **Quote-seeded branches label themselves with the parent's words.** Branch-from-selection seeds the composer with a `> `-quoted passage; `stationSummary` strips the leading `>` and shows the *quote*, not the question. | `src/lib/quotePrompt.ts:48-54`, `src/lib/stationSummary.ts:26` |
| 4 | **Off-path pill labels fail WCAG AA at 3.09:1**, and the role label sits at 1.51:1 — effectively invisible. | `src/lib/pathHighlight.ts:50` |
| 5 | **There is no hover affordance at all.** The only way to see more is a double-click into the reader panel. The pill has no `title`, no tooltip, no toolbar. | `src/components/TurnNode.tsx:62,77` |

### 2.1 The double truncation, with the arithmetic

`NODE_WIDTH = 240`, `px-3` padding, `gap-2` between children:

| Consumed by | px |
|---|---|
| Pill width | 240 |
| `px-3` both sides | −24 |
| Role icon (16) + gap (8) | −24 |
| Collapse chevron (`p-1` + 14px icon = 22) + gap (8) | −30 |
| Branch badge (`px-1.5` + 10px icon + count ≈ 32) + gap (8) | −40 |
| **Text width available** | **192 (leaf) → 122 (has badge + chevron)** |

At `text-xs` (12px) in the default UI sans stack, mean advance is ≈6.2px/char →
**≈29 characters on a leaf, ≈19 on a branching node.** The screenshot corroborates it
exactly: the leaf pills show `Pillar 5: The Guarded Boundary ` (30 chars) and the
branching pill shows `what are the load b` (19 chars).

So the 48-char budget in `stationSummary` is fiction. Roughly half of every label it
produces is thrown away by the browser, and the user never learns that a longer label
existed.

### 2.2 The pill is 61% vertical whitespace

`NODE_HEIGHT = 72`. The content is two `leading-tight` rows:

```
text-[10px] role label  ≈ 12.5px
text-xs     summary     ≈ 15.0px
                        ────────
                        ≈ 27.5px of 72px used  →  44px unused
```

A second summary line costs 15px and still leaves ~29px of slack. **A two-line label
needs no geometry change, no layout-constant change, and no re-layout** — `H_GAP` /
`V_GAP` in `autoLayout.ts` are untouched because `NODE_HEIGHT` does not move.

### 2.3 Fan-out — the headline feature — renders N indistinguishable pills

`fanOutAndSubmit` creates the children with `userPrompt: ''`, then calls
`submitPrompt(id, userPrompt)` for each with the *same* prompt
(`useTreeStore.ts:510`). After that, every sibling holds a byte-identical
`userPrompt`, and their `assistantResponse` values differ only in wording — so
`stationSummary` returns the same label for all of them, whichever field it reads.

This is the important one, because **no summarizer can fix it.** The prompt is
identical on purpose — that *is* the experiment. The only fact that distinguishes
fan-out siblings is the **model** (and the persona, once §5 of the persona note
lands). So the fix is not better summarization; it is putting
`formatModelRef(node.providerOverride, node.modelUsed)` on the pill's second line
whenever siblings share a prompt. `formatModelRef` already exists
(`src/lib/formatModelRef.ts`) and is already used in the dispatch controls.

### 2.4 Quote-seeded branches describe the parent, not the question

`formatQuoteSeed` produces `> <passage>\n\n` and the caret lands underneath, so the
composer's *first* line is the parent's prose. `stationSummary`'s cleanup regex
strips exactly one leading run of markdown markers (`#`, `>`, `-`, `*`, backtick,
whitespace), so the pill shows the quoted passage's opening words.

This is visible in the screenshot: five sibling branches all labelled `Pillar N: …` —
those are the *response's* headings, not what the user asked about each one. The
question the user actually typed is on line 3 of the prompt and never reaches the pill.

**Fix, no summarizer needed:** when the prompt starts with a blockquote block, skip the
quoted lines and summarize the first non-quoted line; fall back to the quote only when
the rest is empty (the prompt is still streaming, or the user never typed past the
seed). That is ~10 lines in `stationSummary` and a handful of test cases.

### 2.5 Off-path labels fail contrast

`pillDimClassName` applies `opacity-40 saturate-50` to the whole React Flow wrapper, so
both the pill background and its text composite against the slate-950 canvas:

| Text | Undimmed | @ `opacity-40` (today) | @ `opacity-60` | @ `opacity-70` |
|---|---|---|---|---|
| Summary (`text-slate-200`) | 14.48:1 | **3.09:1** ❌ | 5.74:1 ✅ | 7.46:1 ✅ |
| Role label (`text-slate-500`) | **3.75:1** ❌ | **1.51:1** ❌ | 2.06:1 ❌ | — |

Two separate problems:

1. **Dimming is too aggressive.** `opacity-40` → `opacity-70` restores the summary to
   7.46:1 while keeping `saturate-50`, so the off-path signal survives (and the edges
   are dimmed independently — `INACTIVE_EDGE_STYLE`, opacity 0.35 — which carries most
   of the wayfinding weight anyway).
2. **The role label fails AA even undimmed** at `text-slate-500`/3.75:1. `slate-400`
   gives 6.96:1. It cannot be made to pass *while* dimmed at any usable opacity, which
   is the honest argument for treating it as decorative: the role icon conveys the same
   information and the accessible text lives in the reader panel.

The thorough version of fix (1) is to dim the chrome and not the text — keep
`pillDimClassName` as a marker class on the wrapper and let `TurnNode` style border /
background / icon through a `group-[.hg-dim]` variant, leaving the label at full
opacity. It reads better but costs a CSS-variant round of work; `opacity-70` is the
one-token change that clears AA today.

---

## 3. Layer 1 — spend the space the pill already has

Four changes, none of which changes the store, the layout engine, or the schema.

**3.1 Two lines, with a composition rule.** `line-clamp-2` on the summary row and a
char budget that matches reality (≈2 × 29 = 58, cap at 64 rather than 48 so the clamp
does the trimming and the function stops lying).

**3.2 Line two is a disambiguator, not more prose.** The second line answers "why is
this one different from its sibling", which is a different question from "what is this
about". Priority order:

| Condition | Line 2 shows |
|---|---|
| `providerOverride` set, or `modelUsed` ≠ the inherited default | `formatModelRef(providerOverride, modelUsed)` |
| `systemPromptOverride` set | the persona label (once the persona library lands) |
| Otherwise | the summary's overflow, via `line-clamp-2` |

**Use the per-node override, not a sibling scan.** The tempting condition is "do my
siblings share my prompt", and it is the wrong one. It needs the parent's
`childrenIds` plus every sibling's `userPrompt`, so it can only be answered from the
node map — either via a new `useTreeStore` selector that re-runs for all 200 pills on
every store commit (including each streaming frame, since `liveText` lives in the same
store), or by injecting a derived flag into the React Flow wrapper, which breaks the
`cached.data === n` identity cache in `useCanvasGraph.ts:47` that the render budget
depends on.

The override condition is O(1), reads only `data`, and is true for fan-out children by
construction — `fanOutAndSubmit` writes each variant's model into `modelUsed` and its
provider into `providerOverride` (`src/store/useTreeStore.ts:501-502`). It is also the
*better* rule: the model ref is worth showing exactly when the model is not the
default, fan-out or not.

**3.3 Skip the quote seed** when summarizing (§2.4).

**3.4 Raise the dim floor** to `opacity-70` and the role label to `slate-400` (§2.5).

Together these are additive to `stationSummary` — a pure function with an existing
test file (`src/lib/stationSummary.test.ts`, 7 cases). Every new rule above is
expressible as another pure case in that file, which is the cheapest possible place for
this work to live.

---

## 4. Layer 2 — the hover card

The request is *"hovering should expand a little bit more"*, and there is a right
primitive for it already in the bundle.

### 4.1 Why not the `title` attribute

It is one line of code and it is the wrong answer: a ~1s OS-controlled delay, no
styling, no markdown, no multi-field layout, and it does not work on touch. It is
worth adding to the **role label** as a free accessibility win, not as the answer to
this request.

### 4.2 `NodeToolbar` — verified properties

Read from the installed build, not the docs:

- **It renders at constant screen size.** `getNodeToolbarTransform(nodeRect, {x, y,
  zoom}, …)` converts the node's flow rect to screen pixels and positions the toolbar
  in screen space with a percentage shift. The card's own content is never multiplied
  by `zoom` — so at `minZoom` 0.2, where the 12px pill label renders at 2.4px and is
  unreadable, the hover card is still full-size and legible. This is the single
  strongest argument for it over any in-pill expansion.
- **The node box does not clip it.** `NodeToolbarPortal` portals into
  `.react-flow__renderer` — the parent of the transformed `.react-flow__viewport`
  pane — so a card taller than the 72px pill overflows cleanly instead of being cut
  off at the node's edge. ⚠️ It *is* still bounded by the React Flow container, which
  in this app is only the left half of the screen (`SplitLayout`), so a pill near the
  pane's right edge needs the `position` / `align` props flipped or the card is cut at
  the canvas boundary. Worth a bounds check against `useReactFlow().flowToScreenPosition()`
  rather than a fixed `Position.Top`.
- **`isVisible` overrides the selection default**, so it can be driven by hover rather
  than by selection.
- **It is already exported** by `@xyflow/react@12.11.2` — no new dependency.

### 4.3 Mount exactly one instance, in `Canvas` — not inside `TurnNode`

A mounted `NodeToolbar` calls `useStore(storeSelector, shallow)` for `{x, y, zoom}`,
and the hooks run *before* its `isActive` early return. So a hidden instance still
subscribes: one per node means **200 components re-rendering on every pan and zoom
frame.** That is exactly the class of regression `renderBudget.test.tsx` exists to
catch.

The shape that avoids it:

- one `<NodeToolbar nodeId={hoveredId} isVisible>` rendered in `Canvas`, mounted only
  when `hoveredId !== null` (the `nodeId` prop is supported, so `useNodeId()` context
  is not needed);
- a tiny Zustand store mirroring `useReaderPanel` exactly — `{ nodeId, open, close }`
  (`src/components/useReaderPanel.ts` is the template, 13 lines);
- `onNodeMouseEnter` / `onNodeMouseLeave` on the `ReactFlow` element itself (both
  props exist in this version — `types/component-props.d.ts:55,59`), so `TurnNode`
  gains no hover state and its render count is untouched.

### 4.4 What the card should carry

The card's job is *"know what's happening"*, so it is a peek, not a reader. Roughly
200×`auto` px:

role · model ref · the first ~200 chars of the prompt · the first ~300 chars of the
response (or live text while streaming) · token counts + `formatUSD` when present ·
the stale sentence when `stale`. All of it is already derivable from `data` plus
`liveText`; `turnCostUSD` and `formatUSD` exist in `src/lib/pricing.ts`.

Two behavioural requirements:

- **~120ms open delay, ~80ms close delay**, or panning across a tree strobes cards.
- **Do not break the double-click reader.** `openReader` on double-click stays; the
  card is a peek and should say so (a `Double-click for full text` footer line).

### 4.5 Keyboard and touch are not covered by hover

Hover is mouse-only. The keyboard path already exists — `r` / `R` opens the reader
panel for the selected node (`src/components/CanvasViewport.tsx:105-106`) — so the
honest statement is that the card is a *mouse convenience* over an affordance that is
already keyboard-reachable, not a new capability that only mice get. No new keybinding
is needed.

### 4.6 Optional: zoom-responsive detail, done in CSS

Below ~0.5 zoom the pill text is illegible no matter how good the label is. The
tempting fix — `useStore(s => s.transform[2])` inside `TurnNode` — is the same
200-re-renders-per-frame trap as §4.3. Do it with **one** subscription instead:
`useOnViewportChange` in `Canvas`, throttled, writing `data-hg-zoom="far" | "near"` on
the React Flow container, and let Tailwind arbitrary variants switch the label. Zero
React re-renders for the pills.

---

## 5. Layer 3 — real titles

### 5.1 One field, two writers — and the user writes better ones

```ts
// src/types/index.ts — additions to TurnNode
label?: string                    // the displayed title, whoever wrote it
labelSource?: 'user' | 'auto'     // provenance, for invalidation + UI only
```

The same field serves a **manual rename** and a **generated summary**, and manual
rename should ship first. It is strictly cheaper (no provider, no key, no latency, no
failure mode), it is strictly better (the user knows what the branch is *for*, which no
summarizer can infer), and it is the feature people actually ask for once they have
twenty branches. The summarizer is then a *default* for nodes the user never named.

Display rule, resolved in one helper so every surface agrees:

| Condition | Pill shows |
|---|---|
| `label` set, `labelSource === 'user'` | the label, verbatim, never overwritten |
| `label` set, `labelSource === 'auto'` | the label |
| `label` absent | `stationSummary(node)` — the L1 extractive path |

The fallback is what makes this safe to ship incrementally: existing rows and rows
whose summarization failed simply render today's behaviour.

### 5.2 No Dexie migration is needed — and that is a real finding

Dexie's `version(n).stores({ nodes: 'id, treeId, parentId, timestamp' })` declares
**indexes**, not a column set. IndexedDB rows are schemaless documents, so adding two
optional non-indexed properties to `TurnNode` requires **no version bump and no
`upgrade()` block**. Existing rows read back with `label === undefined`, which §5.1's
fallback already handles.

This matters for sequencing: the persona library takes **v6** (it adds a `personas`
*table*) and the tools work takes **v7** (it adds `steps[]` with a backfill). Labels
take **neither** — they can land before, between, or after those without touching the
migration chain. The only reason to spend a version here would be to *backfill* labels
onto historical nodes, and lazy fallback is better than a migration that fires hundreds
of model calls on first open.

Export/import comes for free and behaves *better* than `personaId`:
`buildExportDoc` spreads whole rows (`src/lib/treeExport.ts:16-23`), so the field
travels; and because it is self-contained text rather than a reference into a mutable
library, `remapImportedTree` (`src/lib/treeExport.ts:170`) should **keep** it rather than null
it out.
`TREE_EXPORT_SCHEMA_VERSION` stays `1`.

### 5.3 Extractive first — free, offline, deterministic

Before any model call, note how far pure string work gets. `Intl.Segmenter` is
available with `granularity: 'sentence'` (verified locally on Node 26; ⚠️ browser floor
is Firefox 125 / Safari 14.1 / Chrome 87 from memory — check before depending on it),
so proper sentence segmentation needs no dependency:

```js
[...new Intl.Segmenter('en', { granularity: 'sentence' }).segment(text)]
// → ['Pillar 1: The Canonical Memory. ', 'The tool is CLAUDE.md …. ', …]
```

Rules that are worth having whether or not L3's model path ever ships:

1. Skip the quote seed (§2.4) — biggest single win, and it is an L1 item anyway.
2. Prefer the first **interrogative or imperative** sentence of the prompt over the
   literal first sentence. "Given the above, how does X behave?" should title as the
   question.
3. Strip markdown inline syntax, not just leading markers — `**bold**`, `` `code` ``,
   link brackets.
4. Segment on sentences rather than 7 words, then trim to the char budget.

This is deterministic, testable in `stationSummary.test.ts`, works with no key, works
in the no-key demo tree, and works for Ollama-only users. **It cannot do abstraction** —
it will never turn a 900-word answer into "recommends B, with caveats". That is the
only thing the model path buys.

### 5.4 The model path — shape, cost, and when it runs

A titling call is a plain non-streaming OpenAI-compatible completion against the
existing OpenRouter base URL. The current client cannot do it: `streamLLMResponse`
is streaming-only and its callbacks are shaped for the token pipeline
(`src/lib/streamingClient.ts:3-24`). This wants a separate ~40-line
`summarizeTurn()` — `stream: false`, `max_tokens: 24`, a fixed system prompt, and the
prompt plus the first ~1500 chars of the response as input. ⚠️ Shape follows the
existing request bodies in `streamingClient.ts`; not re-verified against a live call.

Cost at ~625 input / ~12 output tokens per node, from the bundled snapshot
(`bundledCatalog.ts`, hand-checked 2026-09, ⚠️ not re-verified live):

| Model | Per node | 200-node tree | 1000 nodes |
|---|---|---|---|
| `meta-llama/llama-3.1-8b-instruct` | $1.3e-5 | $0.0026 | $0.013 |
| `mistralai/mistral-nemo` | $2.0e-5 | $0.0039 | $0.020 |
| `google/gemini-2.0-flash-001` | $6.7e-5 | $0.0135 | $0.067 |
| `openai/gpt-4o-mini` | $1.0e-4 | $0.0202 | $0.101 |

**Money is not the objection.** A whole 200-node tree titles for a quarter of a cent on
a cheap model. The real objections are:

- **A second round trip per turn**, on the user's key, that they did not ask for. It
  must be opt-in in Settings, and off in the no-key demo tree.
- **The cost receipt must stay honest.** Titling tokens are real spend. They either get
  their own line in `CostReceipt` or they are excluded from the node's
  `inputTokens`/`outputTokens` *and* disclosed — silently folding them into the turn's
  numbers would make the receipt lie, and the receipt is the product's proof.
- **Provider asymmetry.** Ollama-only users get no cheap remote model; `tierSpread`'s
  Ollama branch returns a `{ provider: 'ollama', model: '' }` placeholder precisely
  because local models cannot be enumerated (`src/lib/tierSpread.ts:39`). For them the
  extractive path of §5.3 *is* the feature.
- **It must never block or touch the stream.** Fire it after `finalizeNode` resolves,
  from a queue with a concurrency cap, and swallow every failure into the §5.1
  fallback. A titling error must not set `status: 'error'` — that ring means "your
  answer failed", and it would be lying.

### 5.5 The label must never enter the context payload

`resolveContextPayload` rebuilds the entire message array from ancestry on every
dispatch, reading only `userPrompt` and `assistantResponse`
(`src/lib/contextEngine.ts:30-39`). A new field on `TurnNode` is therefore invisible to
it *by default* — which is the correct behaviour and the property to lock down.

The reason is the same one the persona note gives for storing persona text rather than
ids: the tree's claim is that it is a record of what was actually sent. A
model-generated paraphrase that leaked into a later turn's context would mean the model
at turn 30 is reasoning over a cheap model's summary of turn 3 while the UI insists the
full chain was inherited. **One regression test** — assert `resolveContextPayload`'s
output is byte-identical with and without `label` populated — is the whole guard.

### 5.6 Invalidation

| Event | `labelSource: 'auto'` | `labelSource: 'user'` |
|---|---|---|
| `submitPrompt` re-dispatches the node (retry / regenerate) | clear, re-summarize | keep |
| Ancestor changed → `stale: true` | keep (this node's own text did not change) | keep |
| Prompt edited (carried-debt item) | clear, re-summarize | keep |
| Import | keep | keep |

The `stale` row is the one worth stating explicitly: staleness is about *ancestry*, not
about this node's content, so an auto label stays valid. Clearing it there would fire a
cascade of titling calls down the subtree every time someone retries a turn near the
root.

### 5.7 Failure modes to design against

| Mode | Mitigation |
|---|---|
| Model returns a sentence, a preamble, or quotes ("Here's a title: …") | Hard-trim to the char budget, strip wrapping quotes, reject anything over ~2× budget and fall back |
| Model returns something in the wrong language | Nothing cheap. Accept it; the user can rename (§5.1) |
| Titling lands after the user renamed the node | `labelSource === 'user'` wins; the write must re-read the node, not blind-`update` |
| Titling lands after the node was deleted | `updateNode` already no-ops on a missing id (`useTreeStore.ts:284-286`) |
| 200 nodes imported at once | Never title on import; lazy fallback covers it |

---

## 6. Sequencing

What this note argues should happen, in order:

1. **L1 (§3)** — `stationSummary` rules + `line-clamp-2` + the dim/contrast fix.
   Pure-function work with an existing test file. Fixes defects 1, 3, 4 and (via the
   model-ref second line) 2.
2. **L2 (§4)** — the single-instance hover card. Fixes defect 5, and is the piece that
   makes a 200-node tree navigable at low zoom.
3. **L3 manual rename (§5.1, §5.2)** — the `label` field, a rename affordance, no
   migration.
4. **L3 auto-summarization (§5.3 → §5.4)** — extractive rules first; the model call
   only if people are still squinting at pills after 1–3, and only opt-in.

Steps 1–2 are not gated on Stop-4 evidence — they are legibility and accessibility
defects in a shipped surface, not new capability. Step 4 is exactly the kind of thing
Stop-4 should decide.

---

## 7. Considered and rejected

- **Bigger pills / variable-height pills.** `NODE_WIDTH`/`NODE_HEIGHT` are consumed by
  both the React Flow wrapper and `d3-hierarchy`'s `nodeSize` (`autoLayout.ts:41`), so
  growing them spreads the whole tree and undoes the subway-map density. And it is
  unnecessary: §2.2 shows the current pill has 44px of unused height.
- **Bringing back manual resize.** Deleted deliberately in Task 3.1; `TurnNode.width` /
  `height` are already vestigial and slated for removal. Re-introducing per-node size
  re-introduces the layout non-determinism that deterministic layout exists to remove.
- **Markdown rendering on the pill.** `MarkdownContent` re-parse cost is the reason the
  chat pane needed throttling in the first place (v0.5.1 carried-debt item, 40 parses
  per 40 tokens). 200 pills parsing markdown is the same bug at 200× scale. Pills get
  plain text, always.
- **Summarizing on every streamed token.** Equivalent to N model calls per turn. The
  label is a property of a *finished* turn.
- **A separate `summaries` Dexie table.** A 1:1 optional field on a row that is already
  loaded does not want a join. §5.2's no-migration property disappears the moment this
  becomes a table.
