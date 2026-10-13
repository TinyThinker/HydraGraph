# Phase 8 — Continue from report (idea F)

## Problem

- A report is a dead end. "Expand section 3" or "now plan the rollout" means copying the
  report into a new conversation by hand.
- Continuing inside the source tree would need a multi-parent node, which this spec rejects.

## Outcome

- "Continue from this report" creates a new tree whose root turn holds the report.
- The next turn inherits it as context through the normal context engine. Converge, then
  diverge again.
- The new tree remembers where it came from and links back.

## Tasks

### 8.1 Create a tree from a report

- **Files:** `src/types/index.ts`, `src/store/useTreeStore.ts`,
  `src/store/useTreeStore.test.ts`
- **Change:** `ConversationTree.fromReport?: { treeId: string; reportId: string; title: string }`.
  `createTreeFromReport(treeId, reportId)`: new tree titled after the report; root turn
  `userPrompt` = "Here is a report from an earlier session. Use it as the starting point.",
  `assistantResponse` = report text (tags stripped), `modelUsed` = the report's model,
  no tokens (it was not generated here, so it is not priced twice). Tree default
  provider / model copied from the source tree. Opens the new tree.
- **Tests:** new tree has one root turn with the report text; `fromReport` set; source
  tree untouched; a follow-up prompt's context includes the report
  (`resolveContextPayload`).
- **Done when:** a report can seed a new tree.

### 8.2 Button and back-link

- **Files:** `src/components/ReportView.tsx`, `src/components/FromReportBanner.tsx` (new),
  `src/components/HeaderBar.tsx`, `src/components/FromReportBanner.test.tsx` (new)
- **Change:** "Continue from this report" in the report view's actions. In the new tree,
  a thin banner: "Started from '<report title>' in <tree title>" with "Open source" (loads
  the source tree and opens the report). Hidden if the source tree was deleted.
- **Tests:** banner shows only when `fromReport` is set and the source exists; link opens
  the right tree and report.
- **Done when:** the loop closes and reopens without losing the thread.

### 8.3 Close out

- **Files:** `docs/ROADMAP.md`, `docs/CHANGELOG.md`, `docs/STATUS.md`
- **Manual:** continue from the demo report; ask a follow-up; open source.
- **Done when:** `npm run check` green; docs match.

## Risks

- A long report as the root turn makes every turn in the new tree expensive. Show the
  report's token size on the button ("~6k tokens carried into every turn").
- The root turn is a synthetic user/assistant pair. `stationSummary` must label it
  sensibly ("From report: <title>"), or the pill reads like the boilerplate prompt.
