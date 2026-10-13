# Phase 2 — Too big: summarize first

## Problem

- Phase 1 blocks any selection that does not fit the model. Five long branches on a
  128k model, or a large tree on a small-window model, cannot produce a report.
- Summarizing loses detail. If it happens out of sight, the user cannot tell what the
  report was built from.

## Outcome

- A too-big selection runs in two steps: condense each branch, then write from the
  condensed versions.
- Before sending, the user sees that this will happen, how many extra calls, and the cost.
- After, the user can open each condensed branch and see what the report was built from.
- If even the condensed versions do not fit, the app says so and names models that would fit.

## Data model

`TreeReport` gains `steps?: ReportStep[]`:

```ts
interface ReportStep {
  segmentLabel: string     // "Shared trunk", "Branch A (t5–t9)", …
  turnTags: string[]       // tags covered, e.g. ['t5','t6','t7']
  summary: string
  model: string
  inputTokens?: number
  outputTokens?: number
}
```

## Tasks

### 2.1 Split the selection into segments

- **Files:** `src/lib/reportSegments.ts` (new), `src/lib/reportSegments.test.ts` (new)
- **Change:** `splitIntoSegments(turns, leafIds, nodes)` → shared trunk (turns every leaf
  shares) + one segment per branch below its fork point. Each segment carries its turn tags
  and an estimated size. A segment that alone exceeds the window is split in half by turn
  count until it fits.
- **Tests:** two branches with a trunk; one branch only (one segment); a nested fork
  (branch inside a branch) assigns each turn to exactly one segment; oversized segment splits.
- **Done when:** every selected turn lands in exactly one segment.

### 2.2 Condense step in the store

- **Files:** `src/store/useReportStore.ts`, `src/lib/reportBrief.ts`, `src/types/index.ts`,
  `src/store/useReportStore.test.ts`
- **Change:**
  - `SEGMENT_BRIEF`: condense this part of a conversation for a writer who will merge it
    with others; keep decisions, numbers, names, code identifiers, open questions and every
    disagreement; keep `[tN]` tags on each point; drop pleasantries and repetition.
  - `generate()` when 1.2 says it does not fit: run one condense call per segment, at most
    3 in parallel, with the same model. Progress in state: `{ done, total }`. Then build
    the final payload from the summaries (labelled by segment) and run the Phase 1 write.
  - A failed segment retries once, then fails the whole report with the segment named.
  - Steps are saved on the report with their tokens.
- **Tests:** too-big selection runs N condense calls then one write; one segment failing
  twice → error report naming it; steps saved with tokens.
- **Done when:** a selection larger than the window produces a report.

### 2.3 Tell the user before and after

- **Files:** `src/components/ReportComposer.tsx`, `src/components/ReportSteps.tsx` (new),
  `src/components/ReportView.tsx`, `src/components/ReportSteps.test.tsx` (new)
- **Change:**
  - Composer fit line for the too-big case: "Too big to send at once (~310k of 128k). Will
    condense 4 branches first: 5 calls, est. $0.11." Generate stays enabled.
  - While running: "Condensing 2 of 4…" then the normal stream.
  - View: "Built from condensed branches" with an expandable list (`ReportSteps`), each
    showing the segment label, turn tags, and the summary text.
- **Tests:** fit line copy; progress copy; steps list renders and expands.
- **Done when:** the user can always see whether a report was condensed and from what.

### 2.4 When even condensed does not fit

- **Files:** `src/lib/reportFit.ts`, `src/components/ReportComposer.tsx`,
  `src/lib/reportFit.test.ts`
- **Change:** estimate the condensed size as `segments × 1,500 tokens` (the condense brief
  asks for at most ~1,000 words). If that still does not fit, block and list up to three
  catalog models whose window fits, cheapest first, as one-click choices.
- **Tests:** suggestion list sorted by price, excludes models below the needed size.
- **Done when:** a too-big selection never fails silently or mid-stream.

### 2.5 Close out

- **Files:** `docs/ROADMAP.md`, `docs/CHANGELOG.md`, `docs/STATUS.md`
- **Manual:** OpenRouter with a deliberately small-window model and a selection over its
  window → condenses; the report cites turns from the first branch.
- **Done when:** `npm run check` green; docs match.

## Risks

- Condensing is where facts get lost or invented. The visible steps are the mitigation;
  do not hide them behind a setting.
- Cost multiplies. The pre-send estimate must include the condense calls.
