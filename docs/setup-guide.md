# Hydra Graph — Setup & Run Guide

A quick guide to configuring an LLM provider and running the app locally.

---

## 1. Run the app

**Prerequisites:** Node.js 18+ and npm.

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. On first load the app creates one research tree with a
single root node and writes a default settings row into IndexedDB.

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

Click the **gear icon** in the header bar. The modal has four fields:

| Field | Notes |
|---|---|
| **Gemini API key** | Masked; stored only in IndexedDB, sent only as a request header |
| **OpenRouter API key** | Field exists but **no client is wired yet** — selecting OpenRouter errors |
| **Ollama base URL** | Defaults to `http://localhost:11434` |
| **Default model** | The model name used for any node that doesn't override it |

Click **Save**. Values survive a page reload.

### How the provider is chosen

There is **no provider dropdown yet**. The provider is derived automatically when you save:

- A **Gemini API key is present** → provider is **`gemini`**
- Otherwise → provider is **`ollama`**

So to use Ollama, leave the Gemini key blank. To use Ollama *while keeping* a Gemini
key saved, override it manually: DevTools → Application → IndexedDB → `HydraGraphDB` →
`settings` → `global_settings` row → set `provider` to `"ollama"` → reload.

---

## 3. Set up Gemini (cloud)

1. Get a key from **https://aistudio.google.com/apikey**.
2. Settings → paste it into **Gemini API key**.
3. Set **Default model** to a current Gemini model, e.g. `gemini-2.5-flash` or
   `gemini-2.0-flash`.
4. **Save.**

The key is sent as the `x-goog-api-key` header (never in the URL) and is stored only
in IndexedDB.

Type a prompt in the root node and press **Send** — the response streams in
token-by-token.

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
   - Leave **Gemini API key** blank (so the provider derives to `ollama`).
   - **Ollama base URL** → `http://localhost:11434` (the default).
   - **Default model** → the exact model tag you pulled, e.g. `llama3.2`.
   - **Save.**

**Symptom of a missing `OLLAMA_ORIGINS`:** the generation fails *instantly* with a
network/CORS error in the browser console — not an error message from the model.

---

## 5. Per-branch model selection

Each node's footer shows a **model badge**. Click it to pick a different model for
that node (from a short per-provider list, or type a free-text model name). The
selection is saved on the node, so different branches can run different models over
the same upstream context. A node uses the **Default model** until you override it.

The badge cannot be changed while that node is streaming.

---

## 6. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Ollama request fails immediately, CORS error in console | `OLLAMA_ORIGINS` not set / wrong origin — see §4 |
| Gemini `400` / `404` | Wrong model name in Default model, or the key lacks access to that model |
| Gemini `403` / `API key not valid` | Bad or missing key — shown on the card as a red error panel |
| Card stuck with a pulsing cyan border after reload | Should not happen post-Phase 2 — a reload now converts an interrupted stream to an error state with the partial text kept |
| "OpenRouter client not yet implemented" | OpenRouter has no request client; use Gemini or Ollama |
| Blank canvas on first run | Check the console; clear site data for `localhost:5173` and reload to re-bootstrap |

To fully reset: DevTools → Application → Storage → **Clear site data** for
`http://localhost:5173`, then reload.
