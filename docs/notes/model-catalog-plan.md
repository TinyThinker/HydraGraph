# OpenRouter-Only Provider Model + Live Price Catalog — Phased Plan

> **This file's home:** the first implementation session copies this to
> `docs/notes/model-catalog-plan.md` and commits it, so later sessions read it from
> the repo. Keep that copy as the working reference.

---

## Context

Choosing a model anywhere in the app means **typing the model id by hand** into a
free-text `<input>` (reader panel `NodeDispatchControls`, each `FanOutRow`,
Settings). A typo silently breaks the run. Worse, **pricing is a hand-maintained
flat table** (`src/lib/pricing.ts` `MODEL_PRICING`, ~10 entries) that will drift out
of date — and the product's whole pitch is **model arbitration with the real dollar
cost on screen**. Wrong prices = wrong cost = the core value prop is a lie.

### Direction chosen (from discussion)

- **Providers collapse to `openrouter` + `ollama`.** Native Gemini is removed. All
  hosted models (Gemini via `google/*`, DeepSeek V4 flash/pro, GPT, Claude, Llama,
  Mistral, …) route through **OpenRouter** with one key. Ollama stays for local /
  free / offline.
- **The model catalog and prices are fetched live from OpenRouter's
  `GET /api/v1/models`** (public, no auth needed to read; returns per-token
  `pricing.prompt` / `pricing.completion` for every model). This *is* the catalog —
  no hand-maintained table.
- **Fetch behaviour:** refetch on every app load when online; in-session TTL **1 h**;
  cached list never hard-expires (offline fallback); a committed **bundled snapshot**
  seeds first-run / offline / the no-key demo tree; a **"Refresh prices"** button in
  Settings forces an update and shows `fetchedAt` + source.
- Keep a **free-text / "custom" path** for Ollama models (not enumerable) and for
  any OpenRouter id the catalog fetch missed.
- Model choice stays an explicit **(provider, model) pair** — `providerOverride` +
  `modelUsed` on the node, `provider` + `model` on `FanOutVariant`. No field
  merging. UI shows `provider/model` via a `formatModelRef` helper.

**Outcome:** one live, self-updating price catalog; searchable model pickers
everywhere; a two-provider Settings screen with one credential field that follows
the selected provider; a one-click fan-out "spread across price tiers" fill. Lands
**ahead of the Phase 3 demo tree**, whose cost receipt depends on real prices.

---

## Constraints discovered (do not break)

- **`MODEL_PRICING` is imported outside `pricing.ts` only by `pricing.test.ts`.**
  `treeCost.ts` uses only `resolvePrice` + `turnCostUSD`. Components use only
  `turnCostUSD` / `formatUSD` (`CompareColumn`, `ReaderPanel`, `ChatMessage`,
  `CostReceipt`). All four calls are **synchronous** today.
- **`pricing.ts` is documented "pure, no store access."** Keep it testable: the
  price helpers take an **optional `catalog` argument** that defaults to
  `useCatalogStore.getState().models` when omitted. Tests pass a fixture; components
  call bare. Stays synchronous.
- **`resolvePrice` fuzzy behaviour** must survive for historical `modelUsed` values:
  exact → case-insensitive → longest catalog-id prefix. (OpenRouter ids are already
  `vendor/model`, so keep them whole.)
- **Pre-launch (v0.4.0, no external users).** Existing IndexedDB data is the dev's
  own test trees — the Gemini→OpenRouter migration may be **best-effort / lossy**
  (remap what maps, leave the rest; unpriced turns just show no cost). Do not
  over-engineer it.
- **`HeaderBar.tsx` (~lines 33-39)** computes the "no provider configured" banner
  from credential presence; `HeaderBar.test.tsx` asserts it clears on
  `updateSettings`. After the provider cut it checks `openRouterApiKey` +
  Ollama-URL-≠-default. Keep that readable.
- **Component prop contracts unchanged**: `SettingsModal` (`open`/`onClose`, mounted
  in `HeaderBar.tsx`) and `FanOutModal` (`open`/`onClose`, mounted in
  `ChatInputBar.tsx`) — no ripple to mount sites or `App.tsx`.
- **Test stack**: Vitest 4, jsdom, `@testing-library/react` v16, `fake-indexeddb/auto`
  (real Dexie on fake backend; `beforeEach: await db.delete(); await db.open()`).
  Zustand reset via `useXStore.setState({ ...full slice })`. `streamLLMResponse` is
  the mock boundary; **`fetch` is mocked** for catalog tests (`vi.stubGlobal('fetch', …)`).
  `npm run check` = tsc + oxlint + vitest (currently 258 tests).
- **Max 150 lines per component file; UI rendering separate from store logic** (CLAUDE.md).
- **CORS risk:** verify `openrouter.ai/api/v1/models` returns `Access-Control-Allow-Origin`
  for a browser fetch (expected — OpenRouter targets client-side use). If blocked:
  fall back to bundled snapshot + a manual "paste models JSON" refresh; note it and
  raise with the user.

---

## Target architecture

```
OpenRouter GET /api/v1/models ──► src/lib/openRouterCatalog.ts   (fetch + normalize)
                                        │
   src/lib/bundledCatalog.ts  ─────────►│  (committed snapshot, offline/first-run seed)
   (regen: scripts/refresh-catalog.mjs) │
                                        ▼
                            src/store/catalogStore.ts
              { models: CatalogModel[], fetchedAt, status, source }
              loadCatalog(force?)  — TTL 1h, IndexedDB cache, snapshot fallback
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
  src/lib/pricing.ts            src/components/ModelSelect.tsx    src/components/FanOutModal.tsx
  resolvePrice(m,p,catalog?)    (openrouter combobox / ollama text)  tierSpread fill
```

### `CatalogModel` (normalized shape)

```ts
export type ModelTier = 'cheap' | 'mid' | 'frontier'
export interface CatalogModel {
  id: string          // OpenRouter id, e.g. "deepseek/deepseek-v4-flash"
  label: string        // from `name`
  inputPerM: number    // pricing.prompt * 1e6
  outputPerM: number   // pricing.completion * 1e6
  tier: ModelTier      // derived from output price percentile within the fetched set
  contextWindow?: number
}
```

`LLMProvider` becomes `'openrouter' | 'ollama'`. Ollama models are **not** in the
catalog — priced at `{0,0}`, chosen via free text.

---

## Phases

Each phase = one session, ends with `npm run check` green and a commit on a
non-main branch (never push to main, never force-push). Tasks sized to **≤3 files**.

### Phase 1 — Remove Gemini; Dexie v5 migration

**Depends on:** nothing. **Blocks:** everything. Highest-risk phase — do it alone.

- **Task 1.0** — Copy this plan to `docs/notes/model-catalog-plan.md`; commit. *(1 file)*
- **Task 1.1** — `src/types/index.ts`: `LLMProvider = 'openrouter' | 'ollama'`; drop
  `geminiApiKey` from `AppSettings`, drop `gemini` from `ProviderModelMap` usage.
  `src/lib/streamingClient.ts`: delete `streamGemini` + its branch + the
  `x-goog-api-key` path. `src/store/settingsStore.ts`: `DEFAULT_SETTINGS.provider =
  'openrouter'`, drop gemini defaults, `setApiKey` loses the `'gemini'` arm. Fix
  fallout in `settingsStore.test.ts`, `streamingClient.test.ts`. *(≈3 files + 2 test files
  — if tight, split the test fixes into 1.1b)*
- **Task 1.2** — `src/db/ChatDatabase.ts`: add `this.version(5)` — (a) add a
  `catalog` store (`key`) for the cached model list; (b) `.upgrade`: settings row
  `provider:'gemini'→'openrouter'`, drop `geminiApiKey`, `defaultModels.gemini`→
  delete, remap `defaultModel` `gemini-2.5-flash→google/gemini-2.5-flash` etc.;
  nodes + `providerOverride` `'gemini'→'openrouter'`, best-effort remap `modelUsed`
  gemini ids → `google/*`. Add migration tests (seed a v4-shaped row, open, assert
  remap). *(2 files: `ChatDatabase.ts` + a migration test)*

**Verify:** `npm run check`; open the app against an existing DB → no `gemini`
provider anywhere, no console errors, existing trees still load.

### Phase 2 — Live catalog layer

**Depends on:** 1. **Blocks:** 3, 4, 6.

- **Task 2.1** — `src/lib/openRouterCatalog.ts`: `fetchOpenRouterModels(baseUrl):
  Promise<CatalogModel[]>` — GET `${baseUrl}/models`, map `data[]` →
  `CatalogModel`, derive `tier` from output-price percentiles, sort by price. Pure
  fetch + transform, no store. `src/lib/bundledCatalog.ts`: exported
  `BUNDLED_CATALOG: CatalogModel[]` (a real snapshot) + a header comment pointing at
  the regen script. `scripts/refresh-catalog.mjs`: node script that hits the API and
  rewrites `bundledCatalog.ts`. Tests for the normalizer with a captured fixture
  payload. *(3 files + 1 test)*
- **Task 2.2** — `src/store/catalogStore.ts` (new Zustand store):
  `{ models, fetchedAt, status: 'idle'|'loading'|'ok'|'error', source:
  'live'|'cache'|'bundled' }`; `loadCatalog(force?)` — skip if `!force && fetchedAt
  && Date.now()-fetchedAt < TTL_MS` (`TTL_MS = 60*60*1000`); else `status:'loading'`,
  fetch, on ok → set + `db.catalog.put({ key:'openrouter', models, fetchedAt })`, on
  fail → load `db.catalog` cache (`source:'cache'`) else `BUNDLED_CATALOG`
  (`source:'bundled'`), `status:'error'`. Call `loadCatalog()` from app bootstrap
  (`src/App.tsx` effect or wherever `loadSettings()` fires). Tests: TTL skip, fetch
  ok path, fetch-fail→cache, fetch-fail+no-cache→bundled (mock `fetch` + fake DB).
  *(2 files + 1 test; plus a 1-line call site — count `App.tsx`/bootstrap as the 3rd)*

**Verify:** `npm run check`; app load populates `useCatalogStore` from network;
kill network → reload → falls back to cache then bundled; `fetchedAt` advances.

### Phase 3 — Pricing off the live catalog

**Depends on:** 2. **Independent of:** 4, 5, 6.

- **Task 3.1** — `src/lib/pricing.ts`: delete the static `MODEL_PRICING` literal.
  `resolvePrice(model, provider?, catalog = useCatalogStore.getState().models)` —
  `provider==='ollama'` → `{0,0}`; else exact / case-insensitive / longest-prefix
  match over `catalog`. `turnCostUSD(node, catalog?)` threads it through. Keep
  `formatUSD` untouched. Keep a `MODEL_PRICING`-shaped export **derived from the
  bundled snapshot** only if `pricing.test.ts` still needs the name — otherwise
  update the test to build a fixture catalog. *(2 files: `pricing.ts` + `pricing.test.ts`)*
- **Task 3.2** — thread the optional catalog arg (or rely on the store default) at
  call sites: `src/lib/treeCost.ts` (+ `treeCost.test.ts` fixture),
  `src/components/CostReceipt.tsx`, `CompareColumn.tsx`, `ReaderPanel.tsx`,
  `ChatMessage.tsx`. Components can call bare (store default); just verify no
  render-loop from reading the store. *(group as ≤3 files per commit — e.g.
  treeCost+test, then the 4 components in one pass since each change is 1-2 lines)*

**Verify:** `npm run check`; cost receipt shows non-NaN numbers for live catalog
models and for a historical remapped `modelUsed`; Ollama turns show `$0.0000`.

### Phase 4 — `ModelSelect` combobox + wiring

**Depends on:** 2. **Independent of:** 3, 5, 6.

- **Task 4.1** — `src/components/ModelSelect.tsx` (+ test). Props `{ provider, value,
  onChange, id?, disabled?, ariaLabel? }`. `provider==='openrouter'` → an
  `<input list>` + `<datalist>` combobox over `useCatalogStore` models, each option
  labelled `"{label} · ${in}/${out} per 1M"`; free text still accepted.
  `provider==='ollama'` → plain text `<input>`. No store writes. <150 lines. Also
  export a tiny `providerOptions({ inherit?: boolean })` (from a 2-entry constant) to
  replace the duplicated arrays. *(2 files)*
- **Task 4.2** — wire it in: `src/components/NodeDispatchControls.tsx` (drop local
  `PROVIDERS` → `providerOptions({ inherit: true })`; model `<input>` →
  `<ModelSelect provider={node.providerOverride ?? settings.provider} …>`; keep
  commit-on-blur) and `src/components/FanOutRow.tsx` (same swaps; keep
  `aria-label="Variant N model"`; show `formatModelRef` as helper text). Update
  `NodeDispatchControls.test.tsx`; touch `FanOutModal.test.tsx` only if it drives
  that field. *(3 files: the two components + one test file — split the second test
  into 4.2b if needed)*

**Verify:** `npm run check`; reader-panel + fan-out model pickers show the live
list, accept a typed id, dispatch with the right pair.

### Phase 5 — Settings: two providers, one credential field

**Depends on:** 4 (for `ModelSelect` / `providerOptions`). **Independent of:** 3, 6.

- **Task 5.1** — `src/components/SettingsModal.tsx`: `<ProviderSelect>` now 2 entries
  (from `providerOptions()`); below it, **one** control switched on `draft.provider`
  — `openrouter` → `MaskedInput` "OpenRouter API key" + `Advanced` `<details>` with
  base URL + a **"Refresh prices"** button (`catalogStore.loadCatalog(true)`,
  showing `source` + relative `fetchedAt`); `ollama` → plain text "Ollama URL".
  Default-model field → `<ModelSelect provider={draft.provider} …>`. `draft` keeps
  both slots; Save writes both. Refactor `src/components/ProviderSelect.tsx` to use
  `providerOptions()`. Add `SettingsModal.test.tsx` (switch provider → field swaps +
  other slot preserved; Save persists; Refresh calls `loadCatalog(true)`). Touch
  `MaskedInput.tsx` only for a small `id`/`autoComplete` prop if needed.
  *(3 files: `SettingsModal.tsx`, `ProviderSelect.tsx`, `SettingsModal.test.tsx`)*

**Verify:** `npm run check`; `HeaderBar.test.tsx` green; manual: add OpenRouter key,
switch to Ollama and back → key still there; Refresh updates `fetchedAt`.

### Phase 6 — Fan-out "spread across price tiers" fill

**Depends on:** 2 (catalog) — realistically after 4. **Independent of:** 3, 5.

- **Task 6.1** — add `configuredProviders(settings): LLMProvider[]` to
  `src/store/settingsStore.ts` (`openrouter` if `openRouterApiKey`, `ollama` if
  URL ≠ default). Add `tierSpread(models, configured, n)` to
  `src/store/catalogStore.ts` (or a small `src/lib/tierSpread.ts`): if `openrouter`
  configured → pick `n` models walking the cheap→mid→frontier tiers of the live
  catalog; append one Ollama placeholder if `ollama` configured. In
  `src/components/FanOutModal.tsx` add a **"Fill: spread across price tiers"** button
  above the rows → `setVariants(tierSpread(...).map(→ {provider, model}))` clamped
  to `[MIN_VARIANTS, MAX_VARIANTS]`; disabled when `configuredProviders` empty.
  Update `FanOutModal.test.tsx`. *(3 files)*

**Verify:** `npm run check`; with an OpenRouter key set, Fill produces 3-4 variants
spanning cheap→frontier; Dispatch forks children with those pairs.

### Phase 7 — Roadmap / changelog / status

**Depends on:** the phases it documents being merged.

- **Task 7.1** — `docs/ROADMAP.md`: add a checked item at the **top of Phase 3**,
  before the demo-tree line —
  `- [ ] OpenRouter-only providers (Gemini removed) + live price catalog from
  OpenRouter /models (cached, 1h TTL, bundled fallback); searchable model pickers
  replace hand-typed ids in reader panel / fan-out / settings; single
  provider-linked credential field; fan-out price-tier spread.`
  Note the demo-tree receipt depends on it, and that the bundled snapshot is what
  the no-key demo uses. Append matching `docs/CHANGELOG.md` lines. Update
  `docs/STATUS.md` by hand to match. Update `docs/ARCHITECTURE.md` §5.2 (dispatch
  precedence) + wherever providers are enumerated. *(ROADMAP, CHANGELOG, ARCHITECTURE
  + STATUS, all hand-edited)*

---

## Rollout order & parallelism

```
Phase 1 ─► Phase 2 ─┬─► Phase 3
                    ├─► Phase 4 ─► Phase 5
                    └─► Phase 6   (best after 4)
Phase 7 last (or update ROADMAP incrementally per phase)
```

Each phase on its own branch, merged to `main` via the normal flow.

## End-to-end verification (after all phases)

1. `npm run check` — tsc + oxlint clean, all tests green (≥258 plus new
   `openRouterCatalog` / `catalogStore` / `ModelSelect` / `SettingsModal` /
   migration suites).
2. `npm run dev`:
   - First load online → `useCatalogStore.source === 'live'`, `fetchedAt` set;
     DevTools offline → reload → `'cache'`, then clear cache → `'bundled'`.
   - Settings: only OpenRouter + Ollama; exactly one credential field, follows the
     dropdown, both slots survive switching; default-model is a searchable priced
     picker; "Refresh prices" advances `fetchedAt`.
   - Reader panel + fan-out: searchable model picker over the live list; a typed
     custom id still works; `provider/model` shown per branch.
   - Fan-out "spread across price tiers" → 3-4 variants cheap→frontier; dispatch OK.
   - Cost receipt: real numbers, no NaN, for live models, a historical remapped
     `modelUsed`, and `$0.0000` for Ollama.
3. Old tree created before Phase 1 still opens, still shows costs where the model
   remapped cleanly.
4. Confirm `GET /api/v1/models` actually works from the browser (CORS). If not:
   bundled snapshot + manual refresh is the fallback — flag to the user.
