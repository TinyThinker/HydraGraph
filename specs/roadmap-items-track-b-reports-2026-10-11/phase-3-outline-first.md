# Phase 3 — Outline first (idea A)

## Problem

- Phase 1 writes the whole report in one shot. If the structure is wrong, the only fix
  is a full regenerate at full cost.
- One-shot long writing is usually flat. A model writes better against a structure it
  was given.

## Outcome

- Step 1: a cheap call proposes an outline. Each section has a title, a one-line intent,
  the turns it draws on, and any disagreement it must address.
- The user reorders, renames, deletes or adds sections, then approves.
- Step 2: the report is written to that outline.
- Any single section can be rewritten without touching the rest.

## Data model

`TreeReport` gains `outline?: ReportSection[]` and `status` gains `'outlined'`:

```ts
interface ReportSection {
  id: string
  title: string
  intent: string           // what this section must establish
  turnTags: string[]       // sources the model proposed
  conflict?: string        // a disagreement this section must address, if any
}
```

## Tasks

### 3.1 Outline format and parser

- **Files:** `src/lib/reportOutline.ts` (new), `src/lib/reportOutline.test.ts` (new)
- **Change:** ask for the outline as a fenced JSON array of
  `{ title, intent, sources: string[], conflict?: string }`. `parseOutline(text)` finds the
  first JSON block, validates it, fills ids, drops unknown tags. Falls back to parsing a
  markdown list (`## Title — intent [t3, t5]`) if JSON is missing.
- **Tests:** valid JSON; JSON wrapped in prose; markdown fallback; garbage → clear error.
- **Done when:** pure module.

### 3.2 Draft the outline

- **Files:** `src/store/useReportStore.ts`, `src/lib/reportBrief.ts`,
  `src/types/index.ts`, `src/store/useReportStore.test.ts`
- **Change:** `draftOutline({ brief, provider, model })`: same transcript (or condensed
  steps from Phase 2), `OUTLINE_BRIEF` = the user's brief + "propose 3–8 sections; flag
  every place the branches disagree as a `conflict` on the section that must address it".
  Not streamed to the UI (it is short); saved as a report with `status: 'outlined'`.
- **Tests:** saves an outlined report; parse failure → error report with the raw text kept.
- **Done when:** an outline can be produced and persisted.

### 3.3 Edit the outline

- **Files:** `src/components/ReportOutlineEditor.tsx` (new),
  `src/components/ReportOutlineSection.tsx` (new), `src/components/ReportPanel.tsx`,
  `src/components/ReportOutlineEditor.test.tsx` (new)
- **Change:** list of sections. Each: editable title and intent, source tags as chips,
  conflict shown in amber, up / down / delete buttons. "Add section" at the bottom.
  "Write report" at the end. Edits save to the report record (debounced).
- **Tests:** reorder, delete, add, edit persist; conflicts render amber.
- **Done when:** the user can shape the structure before paying for the full write.

### 3.4 Write to the outline

- **Files:** `src/store/useReportStore.ts`, `src/lib/reportContext.ts`,
  `src/store/useReportStore.test.ts`
- **Change:** `writeFromOutline(reportId)`: payload = transcript + the approved outline,
  with the instruction to use exactly these sections, in this order, as `##` headings, and
  address each listed conflict in its section. Streams like Phase 1.
- **Tests:** the payload includes every section in order; output saved with
  `status: 'idle'`.
- **Done when:** the written report follows the edited outline.

### 3.5 Rewrite one section

- **Files:** `src/lib/reportSections.ts` (new), `src/store/useReportStore.ts`,
  `src/components/ReportView.tsx`, `src/lib/reportSections.test.ts` (new)
- **Change:** `splitByHeadings(markdown)` / `replaceSection(markdown, index, newText)`.
  View shows a small "Rewrite" on hover per `##` section, with an optional note
  ("shorter", "add the cost numbers"). Payload: transcript + outline + the sections before
  and after for continuity + the note. Only that section streams and is replaced.
- **Tests:** split / replace round trip keeps other sections byte-identical; heading-less
  text is one section.
- **Done when:** fixing one section costs one section.

### 3.6 Close out

- **Files:** `docs/ROADMAP.md`, `docs/CHANGELOG.md`, `docs/STATUS.md`
- **Manual:** demo tree, outline → delete one section, move one → write; rewrite one
  section with a note.
- **Done when:** `npm run check` green; docs match.

## Risks

- Models vary at returning clean JSON. The markdown fallback in 3.1 is not optional.
- Two steps feel slower. Keep "Skip outline, write directly" in the composer (the Phase 1
  path) so the fast path stays.
