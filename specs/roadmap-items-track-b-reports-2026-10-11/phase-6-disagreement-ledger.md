# Phase 6 — Disagreement ledger (idea B)

## Problem

- The product's pitch is that you arbitrate between models. After Phases 1–3 the model
  still decides which side of a disagreement a report lands on, or leaves it open.
- Conflicts are flagged on outline sections (Phase 3) but the user cannot rule on them.

## Outcome

- Before the outline, an optional step lists every place the selected branches disagree.
  Each entry shows the topic and each branch's position with its sources.
- The user rules on each: pick a position, keep both, or drop the topic.
- The outline and the write treat rulings as decided: the chosen position is the report's
  conclusion; others appear as alternatives considered, or not at all if dropped.

## Data model

`TreeReport` gains `ledger?: LedgerEntry[]` and `status` gains `'ledger'`:

```ts
interface LedgerEntry {
  id: string
  topic: string
  positions: { label: string; claim: string; turnTags: string[] }[]
  ruling?: { kind: 'pick'; index: number } | { kind: 'both' } | { kind: 'drop' }
  note?: string            // the user's reason, passed to the writer
}
```

## Tasks

### 6.1 Ledger format and parser

- **Files:** `src/lib/reportLedger.ts` (new), `src/lib/reportLedger.test.ts` (new)
- **Change:** fenced JSON array of `{ topic, positions: [{ label, claim, sources }] }`.
  `parseLedger(text)` validates, fills ids, drops unknown tags, drops entries with fewer
  than two positions. `rulingsToInstructions(ledger)` turns rulings into plain sentences
  for the outline and write prompts.
- **Tests:** valid; prose-wrapped; single-position entry dropped; instructions text per
  ruling kind.
- **Done when:** pure module.

### 6.2 Extract the ledger

- **Files:** `src/store/useReportStore.ts`, `src/lib/reportBrief.ts`, `src/types/index.ts`,
  `src/store/useReportStore.test.ts`
- **Change:** `draftLedger(...)`: `LEDGER_BRIEF` = list only real disagreements between
  branches (different answers to the same question), not differences in emphasis; quote
  each position briefly; cite tags. Saved with `status: 'ledger'`. Zero entries → skip
  straight to the outline with a note "No disagreements found".
- **Tests:** saves ledger; empty ledger advances to outline.
- **Done when:** a ledger can be produced and persisted.

### 6.3 Rule on each conflict

- **Files:** `src/components/ReportLedger.tsx` (new), `src/components/LedgerEntryCard.tsx`
  (new), `src/components/ReportPanel.tsx`, `src/components/ReportLedger.test.tsx` (new)
- **Change:** one card per entry: topic, positions side by side with source chips (reuse
  Phase 4 chips and canvas highlight if present), radio row (each position / Keep both /
  Drop), optional note. "Continue to outline" enabled when every entry has a ruling.
- **Tests:** continue disabled until all ruled; rulings persist.
- **Done when:** the user decides every conflict.

### 6.4 Feed rulings forward

- **Files:** `src/store/useReportStore.ts`, `src/lib/reportContext.ts`,
  `src/store/useReportStore.test.ts`
- **Change:** `draftOutline` and `writeFromOutline` include `rulingsToInstructions`. A
  `conflict` the user ruled on is no longer flagged amber in the outline editor.
- **Tests:** outline and write payloads include the rulings.
- **Done when:** the written report reflects every ruling.

### 6.5 Close out

- **Files:** `docs/ROADMAP.md`, `docs/CHANGELOG.md`, `docs/STATUS.md`
- **Manual:** demo persona branches → ledger shows the Skeptic vs Performance conflict;
  pick one; report concludes accordingly and mentions the other as considered.
- **Done when:** `npm run check` green; docs match.

## Risks

- Over-reporting: models list every difference in wording as a conflict. The brief and
  the two-position rule in 6.1 are the guard; tune on the demo tree.
- It adds a third step. Make the ledger optional in the composer ("Find disagreements
  first"), on by default only when the selection has a fan-out.
