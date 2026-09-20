# Archive

Records of the past. **Nothing in here is edited after it lands** — it is history, not
documentation of the current system. For where the project is now, see
[`../STATUS.md`](../STATUS.md); for how it works, [`../ARCHITECTURE.md`](../ARCHITECTURE.md).

| Path | What it is |
|---|---|
| `2026-08_original-tasks.md` | The original Phase 1–4 "Execution Tasks Matrix". Superseded by the re-engineering plan, then by `ROADMAP.md`. |
| `2026-08_state-diagnosis.md` | The re-engineer-era "Current State & Next Steps" doc. Its Part 1 is the honest diagnosis that motivated the 5-phase re-engineering; the appended per-phase updates are point-in-time. Superseded by `STATUS.md`. |
| `2026-08_backlog-closed.md` | Performance backlog (P1–P3, all fixed) plus the early UX backlog (U1–U4, all resolved or made moot by the pill refactor) and the Phase 3 render-cost baseline. |
| `2026-08_re-engineering/` | The five-phase re-engineering effort on branch `re-engineer`: `plan.md`, `phase-1.md`…`phase-5.md`, `final-report.md`. |
| `2026-08_poc-enhancements/` | The dual-pane / subway-layout track on branch `poc_enhancements_1`: `PHASE_PROGRESS.md` and `spec-phase-1.md`…`spec-phase-3.md`. |
| `2026-09_read-hook-diagnosis.md` | Why the AST-trimmer `PreToolUse` read hook produced almost no metrics: `matcher: "Read"` never fires while reads are routed through Bash. Includes a measured counterfactual (75% token saving on 9/15 files). **Its "never fired" conclusion is superseded** — see next row. |
| `2026-09_read-hook-trimmer-analysis.md` | Follow-up: the hook *did* fire 6 times (metrics rows exist) but never actually trimmed anything, and has a real defect — it drops `offset`/`limit` on every read, turning windowed reads into full-file reads. Recommends raising the budget and restoring `Read` as the default path. |
