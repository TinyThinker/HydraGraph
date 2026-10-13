# Phase 5 — Demo report (idea G)

## Problem

- The landing page is the app with the demo tree preloaded. It shows divergence (fan-out,
  compare, receipt) but not the converge step.
- A stranger with no key cannot generate a report, so they would never see the feature.

## Outcome

- The demo tree ships with one finished report: built from three of its branches, written
  to an outline, with source chips that light up the demo's turns, and a priced line in
  the receipt.
- The demo banner offers "See the report".
- Nothing in the report code special-cases the demo. It is an ordinary `TreeReport` row,
  like the demo turns are ordinary node rows.

## Tasks

### 5.1 Write the canned report

- **Files:** `src/lib/demoReport.ts` (new), `src/lib/demoReport.test.ts` (new)
- **Change:** a report over the three persona branches under `demo-06`
  (leaves `demo-08` via the Skeptic, `demo-07b2` via the Security Auditor, `demo-07c` the
  Performance Engineer). They disagree by construction, which is what the report must show.
  Outline of 4–6 sections, at least one `conflict`, paragraphs ending in tags that match the tag map `buildReportPayload` produces
  for those leaves. Tokens from chars/4 over the real payload, like `demoTree.ts` does.
  Write it by hand from a real model output, then edit for quality: this is a showcase.
- **Tests:** every tag in the text exists in the tag map; every section has at least one
  cited paragraph; digest matches the demo turns (not stale on first load).
- **Done when:** the text reads as a real deliverable, not a transcript.

### 5.2 Seed it with the demo

- **Files:** `src/lib/demoTree.ts`, `src/store/useTreeStore.ts`, `src/firstRun.test.tsx`
- **Change:** `buildDemoTree` sets `tree.reports = [buildDemoReport(nodes)]`. `seedDemoTree`
  already writes the whole tree row. "Reset demo tree" resets the report too.
- **Tests:** first-run test: the demo tree has one report, not stale, priced.
- **Done when:** a cold boot has the report.

### 5.3 Point to it

- **Files:** `src/components/ProviderBanner.tsx`, `src/components/ProviderBanner.test.tsx`
- **Change:** in the demo explanation, a "See the report" link that opens the report
  panel on the demo report.
- **Tests:** the link renders only on the demo tree and opens the panel.
- **Done when:** a stranger reaches the report in one click.

### 5.4 Receipt check

- **Files:** `docs/ROADMAP.md` (Phase 3 demo-tree bullet), `src/lib/demoTree.test.ts`
- **Change:** the demo receipt figures in ROADMAP ($0.1794 vs $0.2545) gain a reports
  line. Update the numbers there and in the test.
- **Done when:** documented numbers match the app.

### 5.5 Close out

- **Files:** `docs/CHANGELOG.md`, `docs/STATUS.md`
- **Manual:** private window on the deployed URL, no key: banner → report → click chips.
- **Done when:** `npm run check` green; docs match.

## Risks

- A mediocre canned report is worse than none: it is the first impression. Have someone
  other than the author read it cold.
- If demo content changes later, the tag map test (5.1) catches drift.
