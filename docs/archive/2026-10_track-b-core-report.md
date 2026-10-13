# Core report — Track B spec phase 1, implementation record

Date: 2026-10-13 · Branch: `feat/track-b-reports` (not merged) ·
Spec: `specs/roadmap-items-track-b-reports-2026-10-11/phase-1-core-report.md`

## In plain English

- You can now pick branches of a tree and have one model write a single report from them.
- Click the new Reports button in the header, then click turns on the canvas. Each click adds that turn and everything above it.
- The panel shows how big the selection is, whether it fits the chosen model, and a rough cost, before anything is sent.
- If it is too big, or you picked a local Ollama model, or there is no OpenRouter key, the app says so and sends nothing.
- The report streams in, then you can copy it, download it as a Markdown file, rewrite it, change the selection, or delete it.
- Reports are saved with the tree. They survive a reload and an export/import.
- If a turn behind the report changes later, the report shows an amber "Sources changed" warning.
- What reports cost shows as its own line in the cost receipt. It does not change the "saved" number.
- Still open: nobody has tried the default instructions on real models yet. The manual check on the live site has not run.

## Commits

| Task | Commit | What changed |
|---|---|---|
| 1.1 | `7c64f20` | `TreeReport` type and `ConversationTree.reports`. `lib/reportContext.ts`: `collectReportTurns`, `reportTags`, `buildReportPayload`, `reportSourceDigest` (FNV-1a over lengths). |
| 1.2 | `f629424` | `lib/reportFit.ts`: `estimateTokens`, `checkFit` (15% margin, 8k reserve), `contextWindowFor`. |
| 1.3 | `b5fe936` | `reportWriterStatus`: Ollama and a missing key are blocked, with fixed messages. |
| 1.4 | `9b4463a` | `useReportStore` selection, `ReportButton` in the header, tick badge and path outline on pills, Escape stops ticking. |
| 1.5 | `9e8d7aa` | `saveReport` / `deleteReport` on `useTreeStore`, memory first, quota to the storage banner. |
| 1.6 | `228ff4f` | `DEFAULT_BRIEF` + `reportTitle` in `lib/reportBrief.ts`. `generate` and `cancel` in the report store; `planReport` and `tooBigMessage` in `reportFit.ts`. |
| 1.7 | `6334396` | `ReportPanel` mounted next to `ReaderPanel`; `ReportComposer` with brief, model picker, fit line and Generate. Panel state in the store. |
| 1.8 | `a35c3d1` | `ReportView` (markdown, meta line, actions, stale badge, report list) and `lib/reportDownload.ts`. |
| 1.9 | `924b17b` | `reportsCostUSD` in `treeCost.ts` and a "Reports · N" receipt row. |
| 1.10 | `e9ff5a0` | `remapImportedTree` remaps report `leafIds`; drops leaves that don't map and malformed report entries. |
| 1.11 | `5a044f6` | ROADMAP, CHANGELOG, STATUS, ARCHITECTURE §5.7. Manual checks folded into `docs/notes/manual-checks.md`. |

## Where the build departed from the spec

- **`buildReportPayload(turns, brief)`** has no `systemPrompt` argument. The brief is the system prompt and persona overrides are named per turn, so the tree default had no use.
- **Header line format:** `[t2] · continues t1 · branch point (2 branches)`; the root reads `start`.
- **`planReport` and `fitLine` live in `reportFit.ts`**, so the store and the composer share one fit check, and the component file only exports components (oxlint `only-export-components`). `reportFit.ts` now imports `pricing.ts`.
- **`ReportButton.tsx` is a new file** (1.4). It holds the header button and the Escape listener, which keeps `HeaderBar` at 115 lines.
- **Panel and selection modes are tied together:** the canvas ticks only while the composer shows. `openPanel` opens on the newest report, or on the composer when the tree has none. Added `compose`, `openPanel`, `closePanel` to the store in 1.7 (the spec listed only the component files).
- **Regenerate rewrites the report in place** (same id, keeps `createdAt`) instead of adding a new one.
- **Cost estimate in the composer** assumes 2,000 output tokens. The real figure lands on the record.
- **Receipt test:** besides the `treeCost` unit tests, `CostReceipt.test.tsx` checks the row appears and the saved figure does not move.

## Open at the time of writing

- Manual check on the deployed URL (task 1.11), including tuning `DEFAULT_BRIEF` on two or three real models: `docs/notes/manual-checks.md` § C.
- The branch is not merged.
- Switching trees while the composer is open keeps the old tree's ticks. They match no turns in the new tree, so the count reads 0 and Generate stays disabled. No harm, but the ticks are not cleared.
