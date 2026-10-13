# Phase 4 — Source links (idea C)

## Problem

- A synthesized report asks the reader to trust it. Nothing shows where a claim came from.
- "Branch 3" means nothing: branches have no names.
- The canvas and the report are two separate worlds.

## Outcome

- Every paragraph carries small source chips (`t5`, `t9`).
- Clicking a chip or a paragraph lights up those turns on the canvas and focuses the first.
- Paragraphs with no source are marked quietly. Paragraphs whose sources changed since
  writing are marked amber.

## Data model

`TreeReport` gains `tagMap?: Record<string, string>` (tag → node id) and
`tagDigests?: Record<string, string>` (tag → per-turn digest at write time). Reports from
before this phase have neither and render without links.

## Tasks

### 4.1 Keep the tag map

- **Files:** `src/lib/reportContext.ts`, `src/store/useReportStore.ts`,
  `src/lib/treeExport.ts`, `src/lib/reportContext.test.ts`
- **Change:** `buildReportPayload` returns the tag map it used. The store saves `tagMap`
  and `tagDigests` on the report. `remapImportedTree` remaps `tagMap` values (the Phase 1
  `leafIds` remap, extended).
- **Tests:** tag map matches the transcript; import remaps it.
- **Done when:** every saved report knows which node each tag means.

### 4.2 Ask for citations and parse them

- **Files:** `src/lib/reportBrief.ts`, `src/lib/reportCitations.ts` (new),
  `src/lib/reportCitations.test.ts` (new)
- **Change:** briefs (default, outline write, section rewrite) add: end each paragraph
  with the tags it relies on, like `[t3, t7]`. `parseCitations(markdown)` → paragraphs with
  `{ text, tags[] }`, tags stripped from the text. Unknown tags dropped.
- **Tests:** single and multiple tags; tags mid-paragraph; code blocks untouched; no tags.
- **Done when:** pure module.

### 4.3 Render chips

- **Files:** `src/components/ReportView.tsx`, `src/components/CitedParagraph.tsx` (new),
  `src/components/CitedParagraph.test.tsx` (new)
- **Change:** render paragraph by paragraph through `MarkdownContent`, chips at the end.
  No tags → a faint "no source" mark. Download and copy keep the tags as text, so the
  exported file stays traceable.
- **Tests:** chips render per paragraph; "no source" mark; copy output keeps tags.
- **Done when:** sources are visible on every paragraph.

### 4.4 Light up the canvas

- **Files:** `src/store/useReportStore.ts`, `src/components/TurnNode.tsx`,
  `src/components/CitedParagraph.tsx`, `src/components/reportHighlight.test.tsx` (new)
- **Change:** `highlightIds: Set<string>` in the report store. Clicking a chip or
  paragraph sets it and calls `useSelectionStore.selectAndFocus(first)`. Pill selector:
  `s.highlightIds.has(id)` → cyan ring. Cleared on Escape, on panel close, or on the next
  click.
- **Tests:** click sets highlight and focus; render tally: only the affected pills
  re-render.
- **Done when:** a paragraph and its turns can be seen side by side.

### 4.5 Stale paragraphs

- **Files:** `src/lib/reportCitations.ts`, `src/components/CitedParagraph.tsx`,
  `src/lib/reportCitations.test.ts`
- **Change:** a paragraph is stale when any of its tags' current turn digest differs from
  `tagDigests`, or the node is gone. Amber left border + "source changed" tooltip. The
  Phase 1 whole-report badge stays.
- **Tests:** regenerate one cited turn → only its paragraphs go amber.
- **Done when:** the user can see which parts of a report to recheck.

### 4.6 Close out

- **Files:** `docs/ROADMAP.md`, `docs/CHANGELOG.md`, `docs/STATUS.md`, `docs/ARCHITECTURE.md`
- **Manual:** click through every chip of a demo-tree report; regenerate a source turn;
  export/import keeps links.
- **Done when:** `npm run check` green; docs match.

## Risks

- Models cite loosely: wrong tag, or every tag. Spot-check on three models during 4.2 and
  tighten the brief. Do not claim the chips are verified; they are the model's claims.
- Paragraph-level rendering may change Markdown output (lists, tables span paragraphs).
  Treat a list or table as one block with its trailing tags.
