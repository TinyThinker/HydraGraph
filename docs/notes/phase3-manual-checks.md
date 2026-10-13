# Phase 3 manual checks (owner: Fernando)

The code for both open Phase 3 boxes merged to `main` in PR #8 (2026-10-11) and is live
at `https://hydragraph.tinythinkerlabs.dev`. These two boxes stay open until the checks
below run by hand. An agent cannot run them: they need real browsers, a real key and a
local Ollama.

Source: `specs/roadmap-items-phase3-front-door-2026-10-11/`, tasks 2.8 and 3.7.

When both are done: tick the two Phase 3 boxes in `ROADMAP.md`, add a CHANGELOG line,
write the results into `STATUS.md`, and move this file to
`docs/archive/2026-10_phase3-manual-checks.md`.

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
