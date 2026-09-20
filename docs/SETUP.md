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

Click the **gear icon** in the header bar. There are three controls, and the middle one
changes with the provider:

| Field | Notes |
|---|---|
| **Provider** | `OpenRouter` or `Ollama` — this is what routes the request |
| **OpenRouter API key** | Shown for OpenRouter. Masked, with a reveal toggle; stored only in IndexedDB, sent as an `Authorization: Bearer` header. Under **Advanced**: the OpenRouter base URL. Alongside it: a **Refresh prices** button and the model catalog's source + age |
| **Ollama URL** | Shown for Ollama. Defaults to `http://localhost:11434` |
| **Default model** | A searchable, priced picker over the live catalog. Free-typed ids are still accepted — the catalog feeds suggestions and pricing, not validation |

Click **Save**. Values survive a page reload, and the "no provider configured" banner
clears immediately.

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
3. Paste the key into **OpenRouter API key**.
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
   Ollama server unless `OLLAMA_ORIGINS` includes the app's origin:

   ```bash
   OLLAMA_ORIGINS=http://localhost:5173 ollama serve
   ```

   On macOS with Ollama running as a background service:

   ```bash
   launchctl setenv OLLAMA_ORIGINS "http://localhost:5173"
   # then restart Ollama
   ```

   If you use `npm run preview` instead of `npm run dev`, the origin is
   `http://localhost:4173` — set that instead (comma-separate for multiple).

3. In Settings:
   - **Provider** → `Ollama`.
   - **Ollama URL** → `http://localhost:11434` (the default).
   - **Default model** → the exact model tag you pulled, e.g. `llama3.2`.
   - **Save.**

**Symptom of a missing `OLLAMA_ORIGINS`:** the generation fails *instantly* with a
network/CORS error in the browser console — not an error message from the model.

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

## 6. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Ollama request fails immediately, CORS error in console | `OLLAMA_ORIGINS` not set / wrong origin — see §4 |
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
