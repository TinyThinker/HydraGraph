# Editable Persona Library — Design Note

> **Where this fits.** This is the *reasoning and phased design* for making personas
> user-editable and giving each tree its own default. The actionable checklist lives in
> [`../ROADMAP.md`](../ROADMAP.md) (Track A already carries "persona presets"); tick
> boxes there, not here. Updated only when the design itself changes.

**Revision:** 1 — 2026-09-12
**Assessed against:** branch `feat/branch-on-selection-and-streaming-perf` at `fc82dc7`
**Direction confirmed with the user:** global persona library **plus** a per-tree
default persona.

---

## 1. Context — what is actually wrong

The complaint is that personas "are not flexible and don't work for everyone." Reading
the code, that is four distinct defects, not one.

| # | Defect | Evidence |
|---|---|---|
| 1 | The persona list is a **hardcoded module constant** — four entries, all software-engineering flavoured (Performance Engineer, Security Auditor, Skeptic, Plain-language explainer). No add, edit, or delete anywhere in the app. | `src/lib/personaPresets.ts:11` |
| 2 | Fan-out offers a **preset-only `<select>`**. A custom persona is *impossible* there. `NodeDispatchControls` has a free textarea; `FanOutRow` does not. | `src/components/FanOutRow.tsx:49-65` |
| 3 | Presets are identified by **exact prompt-string equality**. Edit one character of a preset and the dropdown silently falls back to "No persona". | `src/components/FanOutRow.tsx:23` |
| 4 | `tree.defaultSystemPrompt` is written once at tree creation as the literal `'You are a helpful AI research assistant.'` and **has no UI anywhere in the app**. Every tree is a research assistant forever. | `src/store/useTreeStore.ts:227` |

### 1.1 Why #2 matters most

Comparing personas side by side on identical inherited context is the product's stated
positioning. Fan-out is the surface built for exactly that — and it is the one place a
user cannot express a persona of their own. A lawyer, a marketer, or a teacher opening
fan-out today gets a four-item dropdown of engineering personas and no escape hatch.

The asymmetry has a cause worth naming: there is **no shared persona component**. One
call site grew a textarea, the other grew a select, and they drifted. Section 5 makes
that the fix rather than patching each site.

### 1.2 Why #4 reframes the request

A per-tree persona field **already exists** in the schema and is already honoured by
the dispatch cascade — `resolveContextPayload` takes `globalDefaultSystemPrompt` and
`submitPrompt` passes `tree.defaultSystemPrompt` into it
(`src/store/useTreeStore.ts:353,387`). It is unreachable, not missing.

So "personas on a project" is mostly *surfacing a capability that is already wired*,
which is why it is cheap. It also means the library and the project-level persona are
complementary rather than competing: **the library is reusable text; the tree default
is which text this project starts from.**

---

## 2. Direction chosen

- **One global persona library.** New Dexie `personas` table. Editable in Settings,
  available from every tree. Write a persona once, reuse it everywhere.
- **Per-tree default persona.** `tree.defaultSystemPrompt` becomes editable, with the
  library as the source of ready-made text.
- **Both node-level and fan-out-level persona selection go through one shared
  component**, with a free-text escape at every level.

Rejected: per-tree-only libraries (you would re-create "Security Auditor" in every new
tree, and per-tree copies drift). Rejected: global-only (leaves #4 unfixed, so every
project still starts from the same hardcoded sentence).

---

## 3. The central decision — text is authoritative, the id is only a label

This is the decision everything else follows from, so it is stated before the schema.

**Nodes and trees keep storing the resolved prompt *text*.** A `personaId` is added
alongside it purely as provenance for the UI. The library is never consulted at
dispatch time.

Three independent reasons:

1. **The cascade reads text.** `resolveContextPayload` walks the ancestry chain and
   takes the nearest non-empty `systemPromptOverride`
   (`src/lib/contextEngine.ts:22`). Indirecting that through a mutable global library
   would make a 40-turn-old branch's meaning depend on what the library says *today* —
   editing a persona would retroactively change what every past turn was asked.
2. **The product's claim is that a tree is a record of what was actually sent.**
   Deep-context arbitration only means anything if the context is provable. If deleting
   a persona rewrote history, the compare view and the cost receipt would both be
   lying about runs that already happened.
3. **Export / import would break.** `buildExportDoc` spreads whole rows
   (`src/lib/treeExport.ts:16-23`) and `remapImportedTree` spreads `...doc.tree` and
   `...n` verbatim (`treeExport.ts`), so a persona id travels to a machine whose
   library does not contain it. Text travels correctly; an id dangles.

### 3.1 Display rule (this is the fix for defect #3)

Given a node's `systemPromptOverride` text and optional `personaId`:

| Condition | UI shows |
|---|---|
| `personaId` resolves **and** library prompt `===` node text | the persona's label |
| `personaId` resolves but text has diverged | `"<label> (edited)"` |
| `personaId` absent or unresolvable, text non-empty | `"Custom"` |
| text empty | `"No persona"` |

String equality survives as a *staleness check*, never as the identity mechanism. That
is the difference from today, where equality **is** the identity mechanism and one
edited character erases the label.

### 3.2 Import must not carry a dangling id

`remapImportedTree` (`src/lib/treeExport.ts`) is the single place to null out
`tree.defaultPersonaId` and every `node.personaId` on import. Text is preserved, so
imported trees render as `"Custom"` — correct, since the exporting machine's library is
not present. No new export schema version is needed: `TREE_EXPORT_SCHEMA_VERSION` stays
`1` because the added fields are optional and are dropped on the way in.

---

## 4. Schema — Dexie v6

```ts
// src/types/index.ts
export interface Persona {
  id: string
  label: string
  prompt: string
  /** Seeded by the v6 migration. Editable and deletable like any other row;
   *  the flag exists only so "Restore defaults" knows what to re-create. */
  builtIn?: boolean
  createdAt: number
}

// TurnNode        + personaId?: string          // provenance label only
// ConversationTree + defaultPersonaId?: string  // provenance label only
//                    defaultSystemPrompt stays the authoritative text
```

```ts
// src/db/ChatDatabase.ts
this.version(6).stores({
  nodes: 'id, treeId, parentId, timestamp',
  trees: 'id, createdAt, updatedAt',
  settings: 'id',
  catalog: 'key',
  personas: 'id, label, createdAt',
})
```

Migration steps, in order:

1. **Seed** the four current `PERSONA_PRESETS` as rows with stable hand-written ids
   (`builtin-performance-engineer`, …), `builtIn: true`, and staggered `createdAt` so
   the existing display order is preserved.
2. **Backfill `node.personaId`** by exact-text match against the seeded prompts.
   One-time and cheap; without it every pre-existing turn would read `"Custom"` even
   though it came from a preset.
3. **Backfill `tree.defaultPersonaId`** the same way where `defaultSystemPrompt`
   matches a seed (most trees will match nothing, which is correct).
4. **Fold in carried debt:** drop `TurnNode.width` / `height`. `ROADMAP.md` says
   "drop them at the next schema bump" — this is that bump, and there will not be a
   cheaper one.

### 4.1 Version-number collision to settle first

[`notes/tooling-research.md`](tooling-research.md) §7 also proposes **v6**, for
`TurnNode.steps[]`. Only one can have it. Personas is scheduled and tools is not, so:

- **v6 = personas + width/height drop** (this note)
- **v7 = `TurnNode.steps[]`** if the tools work is ever adopted

`tooling-research.md` should be amended to say v7 when this lands.

---

## 5. Components and stores

`CLAUDE.md` caps component files at 150 lines. Current sizes force extraction rather
than inline growth, which is convenient — it is also the right shape.

| File | Now | Change |
|---|---|---|
| `src/store/personaStore.ts` | — | **new.** `load / create / update / remove / restoreDefaults`, following the `settingsStore` / `catalogStore` pattern. Immutable updates, Dexie-backed. |
| `src/components/PersonaSelect.tsx` | — | **new.** The shared picker: a `<select>` over the library, a `Custom…` option that reveals a textarea, and the §3.1 display rule. One component, used by both call sites. |
| `src/components/PersonaManager.tsx` | — | **new.** The Settings CRUD list (add / rename / edit prompt / delete / restore defaults). Must not be inline in `SettingsModal` (126 lines already). |
| `src/components/NodeDispatchControls.tsx` | 116 | replace the bespoke textarea + preset-button block with `PersonaSelect`. Should get *shorter*. |
| `src/components/FanOutRow.tsx` | 83 | replace the preset-only `<select>` with `PersonaSelect`. **Fixes #2 and #3 together.** |
| `src/components/SettingsModal.tsx` | 126 | one new section that renders `PersonaManager`. |
| `src/components/TreePersonaField.tsx` | — | **new.** The per-tree default persona control (#4). |
| `src/lib/personaPresets.ts` | 33 | becomes seed data for the migration only — no longer read by any component. |

`src/services/llm.ts` and `src/lib/contextEngine.ts` need **no changes**: they already
work in text, which §3 keeps as the authoritative form. `FanOutVariant` gains an
optional `personaId` for the label, alongside the existing `systemPromptOverride`.

### 5.1 Where the per-tree control goes

The tree title lives in `TreeSwitcher` / `TreeSwitcherRow`, and rename already works
through `renameTree`. Recommendation: a **tree section in the existing Settings modal,
keyed to the active tree** — it is where a "default" naturally belongs, it reuses the
modal's chrome, and it avoids growing the switcher popover into a settings surface.
New store action `setTreeDefaultPersona(treeId, { prompt, personaId })`, writing
`defaultSystemPrompt` and `defaultPersonaId` together.

`createTree` (`useTreeStore.ts:227`) keeps its current hardcoded fallback string. A
"persona for new trees" global setting is deliberately *not* in scope — one more
precedence level to explain, for a value the tree control can change in two clicks.

---

## 6. Phases

**Phase 1 — schema + store.** Dexie v6 per §4 (seed, both backfills, width/height
drop), `Persona` type, `personaStore.ts`. No UI yet. Migration test in the style of
`ChatDatabase.migration.test.ts`.

**Phase 2 — the shared picker.** `PersonaSelect.tsx` with the §3.1 display rule; wire
it into `NodeDispatchControls` and `FanOutRow`. **This is the phase that fixes the
user's actual complaint in fan-out** and should not be deferred behind the CRUD UI.

**Phase 3 — Settings ▸ Personas.** `PersonaManager.tsx` + a section in
`SettingsModal`. Add / rename / edit / delete / restore defaults.

**Phase 4 — per-tree default.** `TreePersonaField.tsx` +
`setTreeDefaultPersona`. Closes #4.

**Phase 5 — docs.** Tick Track A's "persona presets" in `ROADMAP.md`, prepend a
`CHANGELOG.md` line, update `STATUS.md` by hand. Amend `tooling-research.md` §7 to say v7.

Phases 2–4 are independent once Phase 1 lands and can go in any order; 2 first is
recommended because it is the reported pain.

---

## 7. Verification

Headless tests, matching existing conventions:

- **Migration:** v5 → v6 seeds exactly four personas; a node whose
  `systemPromptOverride` equals a preset gets the matching `personaId`; a node with
  custom text gets none; `width` / `height` are gone.
- **Display rule (§3.1):** each of the four table rows renders the expected label,
  including `"(edited)"` when the library prompt is changed after the fact.
- **History is immutable:** editing a persona, then deleting it, changes **no** node's
  `systemPromptOverride` and no tree's `defaultSystemPrompt`.
- **Fan-out free text:** a custom persona typed into a `FanOutRow` reaches
  `fanOutAndSubmit` as `systemPromptOverride` — the regression that defect #2 is.
- **Import:** a doc carrying `personaId` / `defaultPersonaId` imports with those
  fields cleared and all prompt text intact.
- **Cascade unchanged:** existing `contextEngine.test.ts` expectations still pass
  untouched — the proof that §3 kept dispatch out of this.

Manual: create a persona, use it in a fan-out of three, confirm the compare view labels
each column, then edit the persona and confirm the three existing columns still show
the old text with `"(edited)"`.

---

## 8. Out of scope

- Persona sharing, export, or a marketplace.
- Per-persona model pinning (a persona that always runs on one model). Plausible, but
  it collides with the dispatch cascade in `services/llm.ts` and deserves its own note.
- Persona version history.
- A global "persona for new trees" setting (§5.1).

### 8.1 Natural follow-on

Fan-out can auto-fill **models** across price tiers (`tierSpread`, the "Fill: spread
across price tiers" button) but personas must be set one row at a time by hand. Once a
library exists, a **"Fill: one persona per row"** button is the exact sibling of the
existing control and makes persona arbitration as cheap as model arbitration. Small,
and squarely on the product's positioning — but it needs the library first, so it is
not part of this plan.
