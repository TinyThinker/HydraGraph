# Agent Execution Guidelines: Spatial Conversation Tree Architecture

## Documentation Map — read before starting work

| Question | File |
|---|---|
| Where is the project now? | `docs/STATUS.md` (hand-maintained snapshot; keep it in sync, don't let it drift) |
| What's next? | `docs/ROADMAP.md` (source of truth; earliest unchecked `- [ ]` in the earliest open phase) |
| What shipped? | `docs/CHANGELOG.md` |
| How is it built? | `docs/ARCHITECTURE.md` |
| How to run it? | `docs/SETUP.md` |
| Where does a new doc go? | `docs/README.md` (the filing rules) |

**When you finish a unit of work:** tick the box in `docs/ROADMAP.md`, add a line to
`docs/CHANGELOG.md`, then update `docs/STATUS.md` by hand to match (version, last
commit, active blockers, next actions). Do not create "phase progress", "current
state", or "tasks" files — that role is STATUS.md + ROADMAP.md. Records of completed
work / diagnoses are born in `docs/archive/` and never edited after.

## Code Style & Architecture Constraints
- Framework: React 19 + Vite 8 + TypeScript 6 (Strict Mode).
- Canvas Engine: @xyflow/react (React Flow v12).
- State Management: Zustand 5 (Store mutating actions must be immutable).
- Database: Dexie.js (IndexedDB). Always use async/await for Dexie transactions.
- Styling: Tailwind CSS (Dark theme slate/indigo palette).

## Immutability & State Updates
- NEVER mutate state objects directly (e.g., `node.content += chunk`).
- ALWAYS use functional Zustand updates with new object references to prevent React Flow re-render locks.

## Component Modularization Rules
- Max 150 lines per component file.
- Separate UI component rendering from store logic.
