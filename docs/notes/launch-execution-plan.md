# Launch Execution Plan — deploy, key hardening, landing page

> **Read this first, execute one phase per session.** This file is self-contained on
> purpose: everything needed to *do* the work is here, so no session needs to re-derive
> decisions or re-audit the codebase. The "why" lives in
> [`launch-priorities.md`](launch-priorities.md) and
> [`storage-and-key-plan.md`](storage-and-key-plan.md) — read those only if a decision
> below seems wrong.
>
> Written 2026-09-20. Baseline: `main` @ `ad7b043`, 368 tests / 51 files, `npm run check` green.

---

## How to run this plan

One phase per session, starting from a clean tree. Paste the prompt for the phase you
are on — nothing else from earlier conversations is needed.

**Phase A — deploy:**

```
Read docs/notes/launch-execution-plan.md and execute Phase A.

The decisions in that file are settled — follow them, don't re-derive
or re-investigate. Stop when Phase A's "done when" is met, then report
what you did and give me the Cloudflare click-path.
```

**Phase B — key hardening:**

```
Read docs/notes/launch-execution-plan.md and execute Phase B.

The decisions in that file are settled — follow them, don't re-derive
or re-investigate. Stop when Phase B's "done when" is met and report.
```

**Phase C — the hub.** Runs in a *different* repository, so start that session there:

```
Read the Phase C section of docs/notes/launch-execution-plan.md in the
HydraGraph repo — plus its "Decisions already made" table and step A8,
which the hub inherits — then build the hub here per that spec.

The decisions in that file are settled — follow them, don't re-derive
or re-investigate. Stop when Phase C's "done when" is met and report.
```

If a session finishes early or gets blocked, record what happened under **Progress** at
the bottom of this file before stopping. That note is what the next session reads first.

---

## Decisions already made — do not re-open

These were settled after a full source audit. Re-litigating them is the main way a
session wastes context.

| Decision | Settled as |
|---|---|
| Host | **Cloudflare Pages**, connected to `github.com/TinyThinker/HydraGraph`. User already has a Cloudflare account |
| Domain | **`tinythinkerlabs.dev`**, purchased 2026-09-20 through Cloudflare Registrar, so DNS is already in the user's Cloudflare account. The whole `.dev` TLD is HSTS-preloaded — browsers force HTTPS, there is no http variant to worry about |
| URL layout | **The app lives at the root of its own subdomain: `hydragraph.tinythinkerlabs.dev/`.** No Vite multi-page build, no `/app/` subpath, no `base` setting |
| Where projects get explained | **On the hub at `tinythinkerlabs.dev`**, not on each project's subdomain. One place to maintain copy, and every project's URL is stable forever |
| Future projects | **Subdomain per project** (`<project>.tinythinkerlabs.dev`), never subpaths — subpaths share a browser origin, so one project's compromised dependency could read another's IndexedDB |
| API key storage | **Persist by default.** An OpenRouter key cannot be retrieved after creation, so refusing to store it costs the user more than it protects them |
| Key protection strategy | **Blast radius, not secrecy** — a dedicated key with a spend limit. Not encryption |
| Encryption / passphrase / WebAuthn | **Out of scope.** Gated on real user demand |
| Backend | **No.** Evaluated at length and rejected — it closes half the threat table and opens a worse half |
| Session-only key storage | **Rejected.** Would force key re-creation for anyone who didn't save it elsewhere |
| Cloudflare Web Analytics | **Off**, decided 2026-09-21 after the beacon turned up as the live site's only CSP violation. Not a threat call — Cloudflare is already the host, and the beacon is cookieless. It's consistency: the plan says no third-party script, `script-src 'self'` is worth more as an absolute than as a list with exceptions, and server-side zone analytics already answers "is anyone visiting" for a `noindex` site shared with a few people. **There is no dashboard toggle for this on Pages** — the mechanism is `Cache-Control: no-transform`; see A8. Applies to Phase C's hub too |

## Do not do

- Do not add `rehype-raw` to `MarkdownContent.tsx`. It is the one change that reopens
  script injection from model output, which is currently closed by default escaping.
- Do not re-audit the security posture. It was done on 2026-09-20; results are in
  [`storage-and-key-plan.md`](storage-and-key-plan.md).
- Do not add analytics, telemetry, or any third-party script. A CSP of `script-src
  'self'` is about to make them fail anyway.
- Do not build a connection test, OAuth PKCE, or the three-step key wizard. Separate
  ROADMAP item, not in this plan.
- Do not touch `treeCost.ts` — the counterfactual arithmetic is known-biased and
  deliberately deferred.

---

# Phase A — Deploy

**Goal:** a live HTTPS URL serving the app, with a CSP that has been verified against
the real production build.

**Estimated:** ~1.5h. **Session boundary:** yes — stop and commit after A6.

### A1 — Nothing to restructure

The app deploys at the root of its own subdomain, so `index.html`, `vite.config.ts`
and the build output all stay exactly as they are. No multi-page build, no `base`.

*(An earlier draft of this plan called for a Vite multi-page split, to fit a landing
page and the app onto one host. Buying the domain removed the need — the hub at the
apex explains the projects, each subdomain is just its app. Recorded here so the change
is not mistaken for an oversight.)*

### A2 — `public/_headers`

Create `public/_headers`. Vite copies `public/` into `dist/` verbatim, which is where
Cloudflare looks for it.

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://openrouter.ai http://localhost:* http://127.0.0.1:*; base-uri 'self'; form-action 'none'; frame-ancestors 'none'
  X-Robots-Tag: noindex
  Referrer-Policy: no-referrer
```

Why each of the risky ones:

- `connect-src` — the point of the exercise. Limits where a compromised dependency can
  send the API key. `localhost` / `127.0.0.1` on any port covers Ollama.
- `style-src 'unsafe-inline'` — **required.** React writes inline style attributes
  (e.g. `SplitLayout.tsx:48`). Removing it breaks layout.
- `img-src data:` — keep; data URIs are used for icons.
- `X-Robots-Tag: noindex` — the app is being shared privately with a few people, not
  published.

### A3 — Verify the build against the real headers

**This is the step that must not be skipped.** A too-strict CSP fails in ways that look
like application bugs.

```bash
npm run build
npx serve dist -l 4173          # or any static server that honours _headers
```

If the chosen server ignores `_headers`, serve `dist/` behind a tiny script that sets
the CSP manually — the header must be applied for this check to mean anything.

Then, in a **fresh browser profile** (so IndexedDB is empty), confirm:

- [x] `/` loads the app
- [x] The demo tree seeds on first visit — 16 turns, 4 forks
- [x] The cost receipt reads **$0.1794 vs $0.2545 linear, 29% saved** *(offline. With
      the live catalog it reads $0.1803 vs $0.2557, ~30% — live prices for the five
      still-listed models differ slightly from the snapshot. See the note below.)*
- [x] The model catalog fetch to `openrouter.ai/api/v1/models` succeeds (200)
- [x] **Zero CSP violations in the console** — nothing loosened

Any violation: fix the CSP, do not fix it by deleting the directive. Record what was
loosened and why, here in this file.

**Ran 2026-09-20.** Headless Chrome over CDP, fresh profile, against `dist/` served by a
static server that applies `dist/_headers` verbatim (`vite preview` ignores the file, so
it cannot be used for this check). Zero CSP violations, zero console output, zero failed
requests. The CSP as written in A2 shipped unchanged.

**One real bug surfaced by running against the live catalog** (not a CSP problem, and it
would have shipped to the live URL): the receipt collapsed to *"$0.0229 vs ~$0.0194 · no
saving to show yet · 11 turns excluded — unknown model pricing."* Cause: OpenRouter has
**delisted `anthropic/claude-3.5-sonnet` and `anthropic/claude-3.7-sonnet`**, and the
live catalog *replaces* `BUNDLED_CATALOG` wholesale, so 11 of the demo's 16 turns lost
their price the moment the fetch landed. Every test passed throughout — `demoTree.test.ts`
prices against `BUNDLED_CATALOG` explicitly, so it cannot see this. Fixed in
`pricing.ts`: `resolvePrice` now falls back to the bundled snapshot when the live catalog
has no entry, since a turn's cost is history and the last-known price is the right basis
for it. Pricing only — the model picker still offers the live list, so nothing offers a
retired model to send to. `treeCost.ts` untouched.

### A4 — Version stamp

So a bug report from a friend identifies which build they're on.

- In `vite.config.ts`, `define` a `__BUILD_SHA__` global. Read
  `process.env.CF_PAGES_COMMIT_SHA` (Cloudflare sets it during the build) and fall back
  to `git rev-parse --short HEAD` locally. Wrap the fallback in try/catch — the build
  must not fail if git is unavailable.
- Render it small and muted, bottom corner of the app. Not on the landing page.

### A5 — Run the gate

```bash
npm run check    # tsc -b && oxlint && vitest run
```

Must be green. Baseline is 368 tests / 51 files — a drop means something broke.

### A6 — Commit

Conventional commit, e.g. `feat(deploy): static build with CSP, noindex, and build stamp`.

### A7 — Cloudflare setup (the user does this)

Write the exact click-path into the response, not into this file. Settings needed:

- Connect `github.com/TinyThinker/HydraGraph`
- Build command: `npm run build`
- Output directory: `dist`
- Production branch: `main`

Then attach the custom domain **`hydragraph.tinythinkerlabs.dev`** under the Pages project's
*Custom domains* tab. Because the domain is registered with Cloudflare, the DNS record
is created automatically — no manual CNAME, no nameserver change, and the certificate
issues on its own within a few minutes.

After it deploys, verify the live URL in a fresh profile against the same A3 checklist,
and confirm the CSP header is actually present (`curl -I https://hydragraph.tinythinkerlabs.dev`).

**Done 2026-09-21.** The subdomain is **`hydragraph`**, not `hydra` — the earlier drafts
of this file said `hydra` and have been corrected throughout. `curl -I` returns 200 with
`content-security-policy`, `x-robots-tag: noindex` and `referrer-policy: no-referrer` all
present. Re-ran the A3 checklist headless against the live URL: demo seeds cold (16 turns,
4 forks), receipt reads **$0.1803 vs ~$0.2557, ~30% saved, 0 excluded**, catalog fetch
returns 200, build stamp reads the deployed commit.

**One violation, and it is the CSP working:** Cloudflare Pages auto-injects its Web
Analytics beacon (`static.cloudflareinsights.com/beacon.min.js`), which `script-src
'self'` blocks. Declined rather than allowed — see the decisions table. Fixed in A8; the
dashboard is *not* where this gets turned off.

### A8 — Stop the injected analytics beacon (`Cache-Control: no-transform`)

The live site's only CSP violation was a Web Analytics beacon that Cloudflare injects
**at the edge**, into the HTML response, after Pages has served it. The origin never
emits the tag, so nothing in the build can remove it.

**The dashboard is a dead end here.** Web Analytics has to be *added* for a site before
the "JS snippet injection" toggle exists at all (`Analytics & Logs → Web Analytics →
Manage Site → Advanced Options`), so a project that was never opted in shows nothing to
switch off — you would have to opt in in order to opt out. On Pages specifically there
is a reported case of injection continuing with no UI toggle anywhere. Do not send a
future session hunting through the dash for a switch that isn't there.

**What actually works,** per Cloudflare's own Web Analytics FAQ: a response carrying
`Cache-Control: public, no-transform` tells the proxy it may not rewrite the payload, so
the beacon is never injected. Added to `public/_headers`:

```
  Cache-Control: public, max-age=0, must-revalidate, no-transform
```

`max-age=0, must-revalidate` is exactly what Pages already returned for both HTML and
hashed assets, so caching behaviour is unchanged — `no-transform` is the only new part.
It also switches off Cloudflare's other edge rewrites: Rocket Loader and Email
Obfuscation, neither of which this app wants, and Polish, which is a Pro-plan feature
and therefore not running here at all.

Applied to `/*` on purpose, not just `/`: the SPA fallback serves `index.html` for any
path, and an HTML response on any of them is injectable.

*(No `#` comment in `_headers` explaining this. Cloudflare documents comment support, but
a parse failure there would silently drop the CSP from a live site, and the file is small
enough that the risk isn't worth the convenience. This section is the explanation.)*

**Verified on the live response 2026-09-21:** the beacon tag is absent from the HTML,
`cache-control: public, max-age=0, must-revalidate, no-transform` is on the response, and
a headless re-run of A3 reports zero CSP violations, zero console output, zero failed
requests. It worked exactly as documented.

**The commands** — `no-transform` blocking injection is Cloudflare proxy behaviour, not
something this repo can prove locally, so re-run these after any header change:

```bash
curl -s https://hydragraph.tinythinkerlabs.dev | grep -i cloudflareinsights   # want: no output
curl -sI https://hydragraph.tinythinkerlabs.dev | grep -i -E 'cache-control|content-security'
```

Then re-run the A3 checklist headless; the console should be silent.

### Phase A is done when

`https://hydragraph.tinythinkerlabs.dev` serves the app, the demo seeds cold, `curl -I` shows
the CSP and `X-Robots-Tag`, and the console is clean.

---

# Phase B — Key hardening

**Goal:** nobody pastes an unrestricted key without being told what to do, and anyone
can wipe the key on demand.

**Estimated:** ~1.5h. **Session boundary:** yes.

### Context a fresh session needs

- `SettingsModal.tsx` is **126 lines**. `CLAUDE.md` caps components at **150**. The
  copy below will exceed it — extract first, don't discover this at the end.
- `SettingsCredentialField.tsx` is 111 lines. Also near the cap. Do not grow it.
- The key is read in exactly two places: `streamingClient.ts:44` (auth header) and
  `settingsStore.ts:28` (`configuredProviders`, which drives the banner). **Do not
  change the read path.**
- `MaskedInput` already renders `type="password"` by default
  (`SettingsCredentialField.tsx:43`, `showKey` starts `false`). No change needed.

### B1 — Extract a `KeyGuidance` component

New file, rendered by `SettingsModal` beneath the credential field, only when the
selected provider is `openrouter`. Keeps both existing files under the line cap.

### B2 — The three pieces of copy

All in `KeyGuidance`:

1. **Save it** — "OpenRouter shows this key only once. Save it in your password manager
   before continuing." *Prevents the likeliest bad outcome: a lost key and a pile of
   orphaned ones.*
2. **Scope it** — "Use a dedicated key with a spend limit for this app." Link to
   OpenRouter's key settings. *This is the actual security control — it caps the damage
   of every threat at once.*
3. **Test app warning** — plain statement that this is an early build shared for
   testing, the key is stored in this browser, and trees live only on this machine.

Keep all three short. Technical friends need the facts, not paragraphs.

### B3 — Show the destination host

`openRouterBaseUrl` is user-editable (`SettingsModal.tsx:86`) and decides where the key
is transmitted (`streamingClient.ts:36`, `:44`), with nothing in the UI naming the
destination. That is a real defect (V7).

Display the host the key will be sent to. When it is not `openrouter.ai`, mark it
clearly as non-default.

### B4 — Forget key

- New action in `settingsStore.ts` that clears only `openRouterApiKey` — model it on
  `resetSettings` (`:113`), but narrower. Must persist the clear to Dexie, not just
  set in-memory state.
- Button in `KeyGuidance`, shown only when a key is set.
- After clearing, the provider banner should reappear on its own — `configuredProviders`
  already derives from the key, so this should need no extra wiring. Verify it does.

### B5 — Tests

Match the repo's existing style (see `SettingsModal.test.tsx`). Cover: guidance renders
for openrouter and not for ollama; Forget key clears the stored key and restores the
banner; the non-default host warning appears only when the base URL is changed.

### Phase B is done when

`npm run check` is green, test count is above 368, and a cold Settings modal shows all
three pieces of copy plus a working Forget key button.

---

# Phase C — The hub at `tinythinkerlabs.dev`

**Goal:** a small landing page at the apex that introduces Tiny Thinker Labs and sends
people into Hydra Graph. This is the page that explains the project — the app's own
subdomain stays pure app.

**Estimated:** ~2–3h. **Session boundary:** yes. Lowest priority — slipping this costs
nothing, because `hydragraph.tinythinkerlabs.dev` already works on its own.

### Where it lives

**A separate repository and a separate Cloudflare project.** It is not part of
this repo — it has no shared code, no shared build, and no reason to redeploy when
Hydra Graph changes. Attach the apex `tinythinkerlabs.dev` to that project.

*(Written as "a separate Pages project". It shipped as an assets-only **Worker**:
Pages is the legacy flow and the dashboard now steers new projects to Workers with
static assets. `_headers` is supported there and was verified — see the Progress
entry. The app itself stays on Pages; there was no reason to migrate a working
deploy.)*

### Constraints

- **Plain HTML and CSS.** No React, no framework, no build step. One static file.
- Give it its own `_headers` with a CSP. The hub makes no API calls at all, so its
  `connect-src` should be `'none'` — far stricter than the app's.
- **Ship `no-transform` in that same `_headers` from the first deploy.** This is a new
  Cloudflare Pages project, so it gets the same edge-injected Web Analytics beacon the
  app did, and a hub whose CSP is `script-src 'self'` with `connect-src 'none'` will
  block it exactly the same way. Don't rediscover this — A8 has the full write-up, and
  the short version is that **no dashboard toggle exists** for a project that was never
  opted into Web Analytics. The line to ship:

  ```
  Cache-Control: public, max-age=0, must-revalidate, no-transform
  ```

  Verify it the same way, against the live hub:
  `curl -s https://tinythinkerlabs.dev | grep -i cloudflareinsights` — want no output.

  `no-transform` also disables Cloudflare's other edge rewrites, Polish among them —
  but **Polish is Pro-and-above, so on the Free plan nothing is being given up.** It
  only becomes a question if this account is ever upgraded *and* the hub carries a
  heavy screenshot. Even then: compress at build time, don't drop the directive.
- Dark theme, slate/indigo, matching the app so the two feel related.
- Built to hold more projects later. One project card today, room for the next.

### Content

A line on what Tiny Thinker Labs is, then a card for Hydra Graph. Lead with what the
demo shows rather than a feature list: comparing several models at turn 30 of a real
problem, on identical inherited context, with the cost. Say plainly that it needs no API
key to explore, and that it is an early build. The primary action is one click to
`hydragraph.tinythinkerlabs.dev`.

### Decide before publishing

The app currently ships `X-Robots-Tag: noindex` (Phase A). If the hub is meant to be
found, the hub should be indexable while the app stays noindex — or drop noindex on
both. Make that an explicit choice, not a leftover.

### Phase C is done when

`https://tinythinkerlabs.dev` renders the hub, its link reaches the app, and its own CSP
produces no console violations.

---

## Deferred — not in this plan

Tracked in [`ROADMAP.md`](../ROADMAP.md); listed here so no session mistakes them for
in-scope work.

| Item | Where |
|---|---|
| `navigator.storage.persist()` + export nudge | [`storage-and-key-plan.md`](storage-and-key-plan.md) Part 1 |
| File System Access autosave | Same, Tier 2 |
| OAuth PKCE (would supersede most of Phase B) | Same, Part 2 item 7 |
| Connection test / three-step key setup | ROADMAP Phase 3 |
| Record OpenRouter `usage.cost` | ROADMAP carried debt |
| Counterfactual arithmetic | ROADMAP carried debt |

## When a phase finishes

Per [`docs/README.md`](../README.md): tick the box in `ROADMAP.md`, add a line to
`CHANGELOG.md`, update `STATUS.md` by hand. Then update the phase's status in this
file so the next session knows where to start.

## Progress

- [x] **Phase A (A1–A6) — done 2026-09-20.** `public/_headers` with the CSP, noindex and
      `Referrer-Policy`; `__BUILD_SHA__` stamped by `vite.config.ts` and rendered by
      `BuildStamp.tsx`; A3 verified headless against the real headers (see A3's note —
      it caught the delisted-model pricing bug); `npm run check` green at 369 tests /
      51 files.
      **A7 is the user's:** Cloudflare Pages project + custom domain, then re-verify the
      live URL against the A3 checklist. Phase A's "done when" is not met until that
      lands.
- [x] **Phase A7/A8 — done 2026-09-21.** `https://hydragraph.tinythinkerlabs.dev` is
      live and passing the full A3 checklist: CSP, `noindex` and `Referrer-Policy` on
      the response, demo seeding cold at 16 turns / 4 forks, receipt at $0.1803 vs
      ~$0.2557, catalog fetch 200, **zero CSP violations and a silent console**. The
      last holdout was Cloudflare's edge-injected analytics beacon, stopped by
      `Cache-Control: no-transform` (A8) after the dashboard turned out to have no
      toggle for it. **Phase A is closed. Phase B is next.**
- [x] **Phase B — done 2026-09-21.** `KeyGuidance.tsx` (new) carries all three pieces of
      copy, the destination-host line, and "Forget key"; `forgetApiKey` in
      `settingsStore` deletes the key from the Dexie row. The banner returning with no
      extra wiring (B4) was verified, not assumed — a test forgets the key with
      `ProviderBanner` mounted and watches it reappear. `npm run check` green at **378
      tests / 52 files**; `SettingsModal` 142 lines, `SettingsCredentialField` 120.
      Verified in the browser as well as the test DOM. One thing the screenshot caught
      that the tests could not: the guidance first rendered as a *sibling* of the
      credential field, which put "Refresh prices" between the key input and the advice
      about the key. It now passes through a `guidance` slot on
      `SettingsCredentialField`, rendered straight after the input, with a DOM-order
      test pinning it there.
      **Phase C is next, and it runs in a different repo.**
- [x] **Phase C (build) — done 2026-09-21, in `TinyThinker/tinythinkerlabs-hub`.** New
      repo at `~/dev/projects/tinythinkerlabs-hub`, first commit `5bdbf1b`. One
      `index.html` (markup + CSS in the file, zero `<script>` tags), `_headers`,
      `favicon.svg`, `README.md`. CSP is stricter than the app's — `script-src 'none'`,
      `connect-src 'none'` — and `no-transform` shipped from the first commit per A8
      rather than being rediscovered. Verified headless against a local server that
      applies `_headers` verbatim: zero CSP violations, silent console, zero failed
      requests, `scrollWidth == clientWidth` at 390 px.
      **Indexing decided, not left over:** hub indexable (canonical, description, Open
      Graph, no `X-Robots-Tag`), app stays `noindex`. Rationale in the hub's README —
      short version, the app is a client-rendered SPA whose crawlable HTML is an empty
      `<div>`, so `noindex` costs it almost nothing, while the static hub is the real
      crawl target *and* the page carrying the early-build caveat. Removing `noindex`
      later leaves no residue.
      **Deploys as a Worker, not Pages** (`db6fce0`). Pages is the legacy flow and the
      dashboard now routes new projects through Workers-with-static-assets, whose wizard
      prefills `npx wrangler deploy` — which needs a wrangler config the repo didn't
      have, so the first build would have failed. Site files moved to `public/`;
      `wrangler.jsonc` points `assets.directory` at it and **deliberately omits `main`**.
      That omission is load-bearing: Cloudflare does not apply `_headers` to responses
      generated by Worker code, so an assets-only Worker is what keeps the CSP on every
      response. Adding a `main` entrypoint later silently drops the CSP from whatever
      that code serves.
      Re-verified against `wrangler dev` (which serves assets the way production does,
      unlike a generic static server that ignores `_headers` entirely): all four headers
      present on `/` **and** `/favicon.svg`, unknown paths return a real 404,
      `not_found_handling` left at default — not `single-page-application`, since this is
      one page. Headless run still clean.
- [x] **Phase C — LIVE at `https://tinythinkerlabs.dev`, 2026-09-21. Phase C is closed,
      and with it the whole launch execution plan.** Verified against the live apex:
      - `HTTP/2 200`, and all four headers on the response — the CSP verbatim
        (`script-src 'none'`, `connect-src 'none'`), `referrer-policy`,
        `x-content-type-options`, and `cache-control: public, max-age=0,
        must-revalidate, no-transform`.
      - **No analytics beacon.** `curl -s https://tinythinkerlabs.dev | grep -i
        cloudflareinsights` returns nothing. `no-transform` shipped from the first
        commit did its job on Workers exactly as it did on Pages — the A8 lesson
        carried, and nothing had to be rediscovered.
      - Headless: **silent console, zero CSP violations, zero failed requests**,
        `scripts: 0` in the DOM, no overflow at 390 px.
      - The link reaches the app: CTA resolves to
        `https://hydragraph.tinythinkerlabs.dev/`, which still returns 200.
      - Indexing is as decided: **no `X-Robots-Tag` on the hub**, `x-robots-tag:
        noindex` still on the app.
      - Unknown paths return a real 404; `/favicon.svg` serves `image/svg+xml` with the
        same headers.

      **One gap, not blocking:** `www.tinythinkerlabs.dev` does not resolve (curl gets
      no connection). The apex works, which is what everything points at, but people do
      type `www`. Fix is a redirect rule in Cloudflare, not a code change — see ROADMAP
      carried debt.
