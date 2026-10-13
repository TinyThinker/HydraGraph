# Phase 9 — Compare reports (idea E)

## Problem

- The report's quality depends on the writer model, and the user has no way to see that.
- The product already compares models on turns. The report is the one output it cannot
  compare.

## Outcome

- In the composer, pick up to three writer models. One click writes the same report
  (same leaves, brief, outline and rulings) with each.
- A compare view shows them side by side with cost per column.
- "Keep this one" marks the winner; the others can be deleted in one click.

## Data model

`TreeReport` gains `groupId?: string` (shared by reports written together) and
`kept?: boolean`.

## Tasks

### 9.1 Write with several models

- **Files:** `src/store/useReportStore.ts`, `src/types/index.ts`,
  `src/store/useReportStore.test.ts`
- **Change:** `generateMany(models[])`: one report record per model, same `groupId`,
  dispatched in parallel. `liveText` becomes a map keyed by report id (keep the single
  case working). Outline / ledger, if present, are shared inputs, not re-drafted. Fit is
  checked per model; a model that does not fit is skipped with a note.
- **Tests:** three models → three records, one group; one stream failing does not stop
  the others; too-small model skipped.
- **Done when:** several reports stream at once.

### 9.2 Pick models in the composer

- **Files:** `src/components/ReportComposer.tsx`, `src/components/ReportModelList.tsx` (new),
  `src/components/ReportComposer.test.tsx`
- **Change:** "+ Compare with another model" adds up to two more `ModelSelect` rows, with
  the fan-out tier spread as a one-click fill (reuse `lib/tierSpread.ts`). Cost estimate
  sums the models.
- **Tests:** up to three rows; estimate sums; tier fill.
- **Done when:** a multi-model write can be started from the UI.

### 9.3 Compare view for reports

- **Files:** `src/components/ReportCompareView.tsx` (new), `src/components/ReportPanel.tsx`,
  `src/components/ReportCompareView.test.tsx` (new)
- **Change:** full-screen overlay styled like `CompareView`: one column per report in the
  group (model, tokens, cost, rendered text with chips). Header line states the shared
  inputs ("Same 3 branches, same brief, same outline"). Escape closes.
- **Tests:** columns per group member; shared-inputs line.
- **Done when:** reports from one group can be read side by side.

### 9.4 Keep one

- **Files:** `src/components/ReportCompareView.tsx`, `src/store/useReportStore.ts`,
  `src/components/ReportCompareView.test.tsx`
- **Change:** "Keep this one" sets `kept` on that report; "Delete the others" removes the
  rest of the group (confirm). The report list shows kept reports first.
- **Tests:** keep + delete others leaves one report.
- **Done when:** the comparison ends in a decision.

### 9.5 Close out

- **Files:** `docs/ROADMAP.md`, `docs/CHANGELOG.md`, `docs/STATUS.md`
- **Manual:** cheap / mid / frontier writers on the demo selection; keep one.
- **Done when:** `npm run check` green; docs match.

## Risks

- Cost triples with three writers. The estimate must show the sum before sending.
- Three parallel long streams: check the token coalescer keeps the UI smooth with three
  `liveText` entries updating at once.
