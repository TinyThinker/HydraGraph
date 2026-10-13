# Phase 7 — Passage shelf (idea D)

## Problem

- Whole branches carry everything: dead ends, corrections, filler. The good parts are
  often a few paragraphs spread across the tree.
- Big selections hit the context limit and need condensing (Phase 2), which loses detail.

## Outcome

- Highlight any passage in a turn and press "Add to shelf" (next to "Branch on this").
- The shelf is a per-tree list of passages: reorder, remove, jump to the source turn.
- The report composer can use the shelf as its source instead of branches. Small, exact
  context: rarely needs condensing.

## Data model

`ConversationTree` gains `shelf?: ShelfItem[]` (non-indexed, no migration):

```ts
interface ShelfItem { id: string; nodeId: string; text: string; addedAt: number }
```

`TreeReport` gains `source?: 'branches' | 'shelf'` (default `'branches'`).

## Tasks

### 7.1 Shelf on the tree row

- **Files:** `src/types/index.ts`, `src/store/useTreeStore.ts`,
  `src/store/useTreeStore.test.ts`
- **Change:** `addToShelf(treeId, nodeId, text)`, `removeFromShelf`, `moveShelfItem`.
  Memory first, then write in try/catch with `storageStatusStore`, like `saveReport`.
  Duplicate text from the same node is ignored.
- **Tests:** add, dedupe, remove, move; quota failure keeps memory.
- **Done when:** shelf persists across reload.

### 7.2 "Add to shelf" on a highlight

- **Files:** `src/components/SelectionBranchButton.tsx`,
  `src/components/SelectionBranchButton.test.tsx` (new)
- **Change:** a second button beside "Branch on this": "Add to shelf" (`Bookmark` icon).
  Brief "Added" confirmation. Works wherever `data-node-id` is set (chat, reader, compare).
- **Tests:** click adds the passage with the right node id; selection cleared.
- **Done when:** passages can be collected from any surface.

### 7.3 Shelf panel

- **Files:** `src/components/ShelfList.tsx` (new), `src/components/ReportPanel.tsx`,
  `src/components/ShelfList.test.tsx` (new)
- **Change:** a "Shelf (N)" tab in the report panel. Each item: the passage (clamped),
  source tag/summary (`stationSummary`), up / down / remove, click → `selectAndFocus(nodeId)`.
- **Tests:** list renders, reorder, remove, focus.
- **Done when:** the shelf can be curated.

### 7.4 Write from the shelf

- **Files:** `src/lib/reportContext.ts`, `src/store/useReportStore.ts`,
  `src/components/ReportComposer.tsx`, `src/lib/reportContext.test.ts`
- **Change:** `buildShelfPayload(items, nodes, brief)`: each passage tagged with its
  turn's tag and the turn's prompt as one-line context, in shelf order. Composer: source
  toggle "Branches | Shelf". Tag map and citations (Phase 4) work unchanged.
- **Tests:** payload order = shelf order; tags map to source nodes.
- **Done when:** a report can be written from the shelf alone.

### 7.5 Export and import carry the shelf

- **Files:** `src/lib/treeExport.ts`, `src/lib/treeExport.test.ts`
- **Change:** remap `shelf[].nodeId` in `remapImportedTree`; drop items whose node is gone.
- **Tests:** round trip.
- **Done when:** shelf survives export/import.

### 7.6 Close out

- **Files:** `docs/ROADMAP.md`, `docs/CHANGELOG.md`, `docs/STATUS.md`
- **Manual:** collect five passages from three branches; write from the shelf; chips
  point at the right turns.
- **Done when:** `npm run check` green; docs match.

## Risks

- A passage out of context can mislead the writer. The one-line prompt context in 7.4 is
  the minimum; consider including the passage's surrounding paragraph if quality suffers.
- `SelectionBranchButton` is mounted app-wide; keep the second button from crowding small
  selections (stack vertically under 200px width).
