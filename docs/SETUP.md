# Hydra Graph — Setup & Run Guide

> **Where this fits.** Permanent how-to-run reference. For how the system is built see
> [`ARCHITECTURE.md`](ARCHITECTURE.md); for project state see [`STATUS.md`](STATUS.md).

A quick guide to running the app and configuring an LLM provider.

---

## 1. Run the app

**Prerequisites:** Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Open **http://localhost:5173**.

**You don't need a key to look around.** On a first load — an empty IndexedDB — the app
seeds the shipped **demo tree**: a 16-turn research session with canned responses, a
3-model fan-out, a 3-persona fan-out, and a cost receipt already showing real dollars.
Nothing is dispatched and no network call is required. Explore it like any tree: read
nodes, open the reader panel, compare siblings, export it, delete it.

Already have trees in this browser? The demo is not seeded over them — open the tree
switcher (the title in the header) → **Reset demo tree**. That also restores the demo
if you edited or deleted it; it rewrites the demo's own rows and never touches yours.

Other scripts:

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with HMR at `http://localhost:5173` |
| `npm run build` | Type-check + production build into `dist/` |
| `npm run preview` | Serve the production build (defaults to `http://localhost:4173`) |
| `npm test` | Run the Vitest suite once |
| `npm run check` | `tsc` + `oxlint` + tests — the pre-commit gate |

All data (trees, nodes, settings, API keys) lives in the browser's IndexedDB
(`HydraGraphDB`). Nothing is sent anywhere except the LLM request itself.

---

## 2. Open Settings

Click the **gear icon** in the header bar. A row at the top shows three steps —
① Provider ② Key (URL for Ollama) ③ Test — and ticks each as it is done. The steps are
guidance only: every field stays visible and **Save** always works. There are three
controls, and the middle one changes with the provider:

| Field | Notes |
|---|---|
| **Provider** | `OpenRouter` or `Ollama` — this is what routes the request |
| **OpenRouter API key** | Shown for OpenRouter. Masked, with a reveal toggle; stored only in IndexedDB, sent as an `Authorization: Bearer` header. Under **Advanced**: the OpenRouter base URL. Alongside it: a **Refresh prices** button and the model catalog's source + age |
| **Ollama URL** | Shown for Ollama. Defaults to `http://localhost:11434`. Below it, a "Requests to Ollama failing?" hint with the `OLLAMA_ORIGINS` fix — see §4 |
| **Test connection** | Under the credential field. Checks what is typed, before you save, and spends no tokens: OpenRouter `GET /key`, Ollama `GET /api/tags`. Says pass or fail in plain words |
| **Default model** | A searchable, priced picker over the live catalog. Free-typed ids are still accepted — the catalog feeds suggestions and pricing, not validation |

Click **Save**. Values survive a page reload, and the "no provider configured" banner
clears immediately.

**Where your data lives.** Trees and settings are stored in this browser's IndexedDB
only; Settings shows the space used and whether the browser agreed to keep it. Export
trees from the header (download icon) — the app nudges you after 6 turns on a tree. To
restore, use the upload icon, or "Returning? Import a backup." on the demo banner.

**GPT, Claude, Gemini and DeepSeek are reached through OpenRouter** as `vendor/model`
slugs (`openai/gpt-4o`, `anthropic/claude-3.7-sonnet`, `google/gemini-2.5-pro`,
`deepseek/deepseek-r1`). There is no separate native provider for any of them — the
native Gemini path was removed in v0.5.0.

### How the provider is chosen per turn

Resolution runs on every submit, most specific first:

1. the node's own override (reader panel → **Dispatch override**),
2. the tree's default,
3. the global **Provider** / **Default model** in Settings.

The resolved values are stamped back onto the turn, so a node records what actually ran.

---

## 3. Set up OpenRouter (cloud, many models)

1. Get a key from **https://openrouter.ai/keys**.
2. Settings → **Provider** → `OpenRouter`.
3. Paste the key into **OpenRouter API key**, then press **Test connection**. A bad
   key reads "OpenRouter rejected this key." A good one reads "Key accepted.", plus the
   credit left if the key has a limit.
4. Pick a **Default model** — e.g. `openai/gpt-4o-mini` (cheap),
   `anthropic/claude-3.5-sonnet` (mid), `deepseek/deepseek-r1` (cheap reasoning).
   The picker shows per-1M-token prices next to each id.
5. **Save.**

Requests go to `https://openrouter.ai/api/v1/chat/completions` with the key in an
`Authorization: Bearer …` header (never in the URL). Streaming and cancel work.

> **Known gap:** OpenRouter does not return token usage on these streams (the
> `usage: { include: true }` parameter is deprecated and has no effect), so **cost
> receipts for real OpenRouter turns currently read `$0.0000`** even though prices
> resolve correctly. The demo tree's receipt is unaffected — its token counts are
> derived from its canned text. Tracked in [`STATUS.md`](STATUS.md) under Carried debt.

---

## 4. Set up Ollama (local)

1. Install Ollama (https://ollama.ai) and pull a model:

   ```bash
   ollama pull llama3.2
   ```

2. **Start Ollama with the app's origin allowed.** A browser page cannot call a local
   Ollama server unless `OLLAMA_ORIGINS` includes the app's origin. Settings → Provider
   → `Ollama` shows a **"Requests to Ollama failing?"** hint with both commands below,
   already filled in with the origin shown in the hint (the page you are on). Copy them
   from there:

   ```bash
   OLLAMA_ORIGINS="<origin shown in the hint>" ollama serve
   ```

   On macOS with the Ollama app running as a background service:

   ```bash
   launchctl setenv OLLAMA_ORIGINS "<origin shown in the hint>"
   # then quit and reopen Ollama
   ```

   Common origins: `https://hydragraph.tinythinkerlabs.dev` (the deployed app),
   `http://localhost:5173` (`npm run dev`), `http://localhost:4173` (`npm run preview`).
   Comma-separate to allow several.

3. In Settings:
   - **Provider** → `Ollama`.
   - **Ollama URL** → `http://localhost:11434` (the default).
   - **Default model** → the exact model tag you pulled, e.g. `llama3.2`.
   - **Test connection.** A pass reads "N models available", or warns if the default
     model is not pulled yet (with the `ollama pull` command).
   - **Save.**

**Chrome's Local Network Access prompt (Chrome 142+).** When a public HTTPS site such
as the deployed app first reaches `localhost`, Chrome asks permission. Choose Allow. If
you blocked it, change it in the site settings (icon left of the address bar). Pressing
**Test connection** is a good way to get the prompt before your first chat turn.

**Symptom of a missing `OLLAMA_ORIGINS`:** the generation fails *instantly* with a
network/CORS error in the browser console — not an error message from the model. The
browser cannot tell this apart from "Ollama is not running" or "Chrome permission
blocked", so a failed test lists all three and opens the hint. A turn that fails this
way also shows **Check connection**, which opens Settings.

Ollama turns are priced at `$0.00` by design (local inference), so a receipt of zero
there is correct rather than the OpenRouter defect above.

> **Note:** Ollama counts as "configured" only once its URL is moved off the
> `http://localhost:11434` default — the app cannot tell an untested default from a
> real one. If you run Ollama at the default port, the provider banner and fan-out's
> price-spread button stay disabled until you save a URL (e.g. `http://127.0.0.1:11434`).

---

## 5. Per-node model and persona

Select a node and press `r` (or use the reader panel) → **Dispatch override**:

- **Provider** — `Inherit` or a specific provider for this turn.
- **Model** — the same searchable priced picker as Settings.
- **Persona (system prompt override)** — free text, with one-click presets
  (Performance Engineer · Security Auditor · Skeptic · Plain-language explainer).
  A persona **cascades to every descendant** until another one overrides it.

Changes apply on the **next Regenerate** (the ⟳ control in the panel header), not
retroactively. Neither can be changed while that node is streaming.

To ask several models the same question at once, use the **fan-out** button next to the
composer: one shared prompt, N branches from identical ancestry, each with its own
provider/model/persona, dispatched in parallel. "Fill: spread across price tiers"
auto-selects a cheap→frontier spread from the live catalog. Then select one of the
siblings and hit **Compare** in the header to read them side by side.

---

## 6. CI and AI PR review

Two GitHub Actions workflows live in `.github/workflows/`.

### CI (`ci.yml`) — always on

Runs `npm ci`, `npm run lint` and `npm run test` on every PR to `main` and every push to
`main`. It does not run `tsc -b`; the Cloudflare Pages build does that. Run the full
gate locally with `npm run check`.

### Branch protection on `main`

Set in GitHub → Settings → Branches (a GitHub setting, not in the repo). Rules:

- Require a pull request before merging. Required approvals: 0 (solo repo).
- Require status check **Lint & Test** (the `ci.yml` job name) and an up-to-date branch.
- Force pushes and deletions blocked.
- **Do not allow bypassing the above settings: on.** With it off, an admin push goes
  straight through and GitHub only prints `Bypassed rule violations`.

Rules for the check: do not add path filters to `ci.yml`, or a PR that skips it can never
merge. Do not make the AI review a required check; it is opt-in and advisory. To verify
the rule, push an empty commit to `main`. It must be rejected with `GH006`. In an
emergency, untick the bypass box, push, and tick it again.

### AI PR review (`ai-pr-review.yml`) — opt-in

Sends a PR's diff (first 60 KB; lockfiles, `dist/`, `build/`, `.min.`, `.map` and `.svg`
filtered out) to DeepSeek through OpenRouter. The logic is in
`.github/scripts/ai_review.py`; the prompt is in the workflow file. **Your diff leaves
GitHub and goes to OpenRouter and DeepSeek**, so do not use it on PRs that contain
anything private.

**What you see after a run**

- **Job summary** (Actions → the run → Summary): always written. Says `LGTM`,
  `findings posted` or `skipped`, plus model, diff size and token count. This is how you
  confirm a passing run happened.
- **One PR comment** from `github-actions[bot]`, marked `<!-- ai-pr-review -->`. Findings
  create it. Later pushes edit it in place, not add new ones. If a later push passes, the
  comment is edited to `✅ LGTM on <sha>`. With no findings ever, no comment exists.
- **Truncation note**: if the filtered diff is over 60 KB, the comment and summary say
  only the first 60 KB were reviewed.

**One-time setup**

1. Add the repo secret `OPENROUTER_API_KEY` (GitHub → Settings → Secrets and variables →
   Actions → Secrets).
2. Create the label: `gh label create ai-review --color 5319e7`

**Use it**

| Goal | How |
|---|---|
| Review one PR | Add the `ai-review` label. The review runs on label, then again on every push to that PR |
| Stop reviewing one PR | Remove the label |
| Turn it off everywhere | `gh variable set AI_REVIEW_ENABLED --body false` |
| Turn it back on | `gh variable set AI_REVIEW_ENABLED --body true` (or delete the variable) |
| Turn it off from the UI | Actions tab → *AI PR Review (DeepSeek)* → ⋯ → *Disable workflow* (only once the file is on `main`) |

**Rules**

- Draft PRs are skipped. Mark the PR ready first.
- PRs from forks get no secret, so the job fails there.
- The label is checked on every run: no label, no review, no cost.
- Comments are PR-level, not inline on file lines.
- A failed model call fails the job (exit 1). It does not block merging unless you add
  it as a required check, which you should not.
- To change what it looks for, edit `REVIEW_SYSTEM_PROMPT` in the workflow file. Output
  is either `LGTM` (no comment) or a list of `[Blocker]` / `[Warning]` items.
- It is a second opinion from a cheap model. Treat findings as leads to verify.

---

## 7. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Ollama request fails immediately, CORS error in console | `OLLAMA_ORIGINS` not set / wrong origin — see §4 |
| **Test connection** says it could not reach Ollama (network error) | One of three, and the browser can't say which: Ollama is not running; `OLLAMA_ORIGINS` does not include the origin shown in the hint; or Chrome's local-network permission was blocked (site settings, icon left of the address bar). See §4 |
| **Test connection** says it could not reach a custom OpenRouter base URL | The app's CSP only allows `openrouter.ai`. Clear **Advanced → OpenRouter base URL** |
| Cost receipt reads `$0.0000` after a real OpenRouter turn | Known gap, not your config — see the note in §3 |
| OpenRouter `400` | Model slug doesn't exist upstream, or your key lacks access to it. Ids are free-text by design, so a typo reaches the API |
| `401` / `403` | Bad or missing key for the selected provider — surfaces on the node as an error state with **Retry** |
| Requests go to the wrong provider | Check the node's **Dispatch override** first — it outranks the tree and global defaults |
| Node stuck streaming after a reload | Expected recovery: a reload converts an interrupted stream to an error state, keeping the partial text. Use **Retry** |
| Demo tree missing on first load | It seeds only into an empty database. Tree switcher → **Reset demo tree** |
| Blank canvas | Check the console; clear site data for `localhost:5173` and reload to re-bootstrap |

To fully reset: DevTools → Application → Storage → **Clear site data** for
`http://localhost:5173`, then reload. That drops every tree you have — export anything
you want to keep first (the ⬇ icon in the header).
