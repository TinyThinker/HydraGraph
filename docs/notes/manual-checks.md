# Manual checks (owner: Fernando)

Checks an agent cannot run: they need real browsers, a real key and a local Ollama, on
the deployed URL `https://hydragraph.tinythinkerlabs.dev`. Each section names the
ROADMAP box it closes. When a section is done: tick its box, add a CHANGELOG line, write
the results into `STATUS.md`, and delete the section here. Delete the file when it is
empty.

**Sections A and B** close the two open Phase 3 boxes. The code merged to `main` in
PR #8 (2026-10-11) and is live. Source: `specs/roadmap-items-phase3-front-door-2026-10-11/`,
tasks 2.8 and 3.7.

## A. Tree durability (spec task 2.8)

**Chrome and Safari**

1. Complete 6 turns in a real tree.
2. Open Settings. The data line reads either "Browser agreed to keep this data." or
   "Not protected — export regularly." **Record Safari's result in STATUS.md** — it may
   be "Not protected" every time; that is expected.
3. Confirm the export nudge appears.
4. Export. Confirm the nudge clears.
5. Change a second tree. Confirm it still nudges.
6. Clear site data. Reload. Import the backup from the "Import a backup" link on the
   demo banner. Confirm the tree comes back.

**Firefox**

7. Confirm the persistence prompt appears after turn 3, and only once.

**Private window (any browser)**

8. Force a quota error (fill storage from the console). Confirm the storage banner shows
   and no turn is left stuck generating.

**Any browser, small viewport**

9. With storage error, provider and nudge banners all showing: order is storage →
   provider → nudge, and the header still fits.

## B. Key setup (spec task 3.7)

On `https://hydragraph.tinythinkerlabs.dev`, in **Chrome and Safari**:

1. OpenRouter, good key → Test connection passes.
2. OpenRouter, bad key → "OpenRouter rejected this key."
3. Ollama running **without** `OLLAMA_ORIGINS` → test fails; the hint explains it.
4. Ollama running **with** `OLLAMA_ORIGINS` set to the deployed origin → test passes.

**Chrome only**

5. Local Network Access: allow it → Ollama test passes. Block it → test fails with the
   hint. **Copy the prompt's exact wording**; match the hint's copy to it if it differs.

**Safari only**

6. **Record in STATUS.md what Safari does for HTTPS → `http://localhost`.** If it
   blocks the request, add a mixed-content line to the Ollama hint (spec 3.4).

**Failed turn**

7. Send a turn with a bad key. Confirm "Check connection" appears on the failed turn
   and runs the same test.

## C. Track B reports, spec phase 1 (task 1.11)

Runs after `feat/track-b-reports` merges and deploys. Needs an OpenRouter key with a
little credit. Source: `specs/roadmap-items-track-b-reports-2026-10-11/phase-1-core-report.md`.

1. Open the demo tree. Header → Reports button (file icon). Tick three branches on the
   canvas; their paths light up.
2. Generate. The report streams in, then shows model · tokens · cost · date.
3. **Judge the default brief:** one argument, not branch by branch; disagreements named;
   `[tN]` citations. Try two or three writer models. Tune `DEFAULT_BRIEF`
   (`src/lib/reportBrief.ts`) if it reads like a dump.
4. Reload. The report is still there.
5. Export the tree, import it. Open the imported copy's report: no amber badge.
6. Regenerate one source turn. The report shows "Sources changed since this was written".
7. Pick a small-window model (8k–32k) with a big selection. Generate is disabled and the
   line says "Too big for this model" before anything is sent.
8. Cost receipt ($ button) shows a "Reports · N" row; the saved figure did not change.

