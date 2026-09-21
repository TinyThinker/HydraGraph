# Local Storage Policy — tree durability and key handling

> **Where this fits.** Tier 2 rationale behind the Phase 3 "where data lives" box in
> [`ROADMAP.md`](../ROADMAP.md), which was originally one checkbox and is split here
> into two. Written 2026-09-20. Every claim about current behaviour was verified
> against source, with file and line cited.
>
> **Revised 2026-09-21.** Part 2 shipped. Part 1 was re-audited and re-ordered: quota
> exhaustion and eviction separated, the app confirmed *not* Chrome-only, the tier
> ladder corrected (Safari has the highest loss risk and was getting the least help),
> Tier 0.5 added, two defects recorded, and BYO-cloud (Drive / OneDrive) evaluated and
> declined for now.

## The premise

Trees and the API key currently share one storage policy: the same Dexie database, the
same lifetime, the same eviction fate. They should not. Their requirements are
opposites.

| | Trees / nodes | API key |
|---|---|---|
| **Wants** | To survive everything | To be exposed as little as possible |
| **Worst case** | A 40-turn session silently disappears | Someone who is not the user reads it |
| **Recoverable?** | Only from an export the user made | **No** — OpenRouter shows a key once |
| **Today** | Evictable IndexedDB, `persist()` never called | Plaintext in the same DB, forever |

Splitting the policy is the whole point of this document. Part 1 makes trees harder to
lose. Part 2 makes the key harder to misuse — deliberately *not* harder to keep, for a
reason explained there.

---

# Part 1 — Tree durability

## What is true now

- Trees and nodes live in Dexie (`HydraGraphDB` → `nodes`, `trees`), which is
  IndexedDB, which is **best-effort storage**. Browsers may evict it under disk
  pressure.
- `navigator.storage.persist()` is **never called** — zero hits in `src/`. The app has
  never asked to be exempt from eviction.
- `navigator.storage.estimate()` is never called either, so neither the app nor the
  user knows how close to a quota they are.
- The only durability mechanism is manual export: `downloadTreeExport`
  (`treeExport.ts:40`), wired to the header's download button (`HeaderBar.tsx:51`).
- Nothing warns the user that any of the above is the case.

The result: the app's data can vanish without warning, and the user has been given no
reason to think it might.

## Two failures, not one — verified 2026-09-21

"Running out of storage" is two different events with opposite consequences, and
conflating them sends the design in the wrong direction.

### Quota exhaustion — the write fails, the data survives

IndexedDB throws `QuotaExceededError` and Dexie aborts the transaction atomically.
Trees already on disk are untouched; what is lost is the turn being written.

It is also close to unreachable here. The demo transcript is 16 turns in a 40 KB source
file — roughly 2.5 KB per turn — so a 200-node tree is well under a megabyte, against a
Chrome quota of roughly 60% of free disk. Reaching it would take on the order of a
million turns. **The exception is a private window**, where the quota is deliberately
tiny.

### Eviction — the data is deleted

This is the one that loses trees, and quota pressure is only one of its triggers.

| Trigger | Browser | Defended by |
|---|---|---|
| Disk pressure, least-recently-used origin evicted | Chrome / Edge | `persist()` |
| ~7 days without a first-party visit | Safari | **Nothing.** Export only |
| User clears site data | All | Nothing, correctly |
| Private window closes | All | Nothing, by design |

`persist()` answers the first row only. Safari's rule is a *timer*, not a pressure
response — no disk shortage required — and `persist()` does not reliably override it.

## The app is not Chrome-only — audited 2026-09-21

Worth stating plainly, because the tier structure below reads as though it were.
Nothing in `src/` is Chrome-gated:

- SSE streaming via `getReader()` + `TextDecoder` (`streamingClient.ts:62`, `:148`)
- `navigator.clipboard`, guarded with an early return (`ReaderPanel.tsx:57`,
  `CodeBlock.tsx:19`)
- IndexedDB through Dexie
- No `showSaveFilePicker`, no `structuredClone`, no service worker, and no
  `browserslist` or Vite `target` override

And the durability round trip already works everywhere: **export *and* import both
ship** — `downloadTreeExport` (`treeExport.ts:40`), `parseImportDoc` (`:55`),
`remapImportedTree` (`:170`), wired through `ImportButton.tsx`, with a versioned schema
(`TREE_EXPORT_SCHEMA_VERSION`) and id remapping on the way in. A file download and a
file input are the two most portable primitives on the web.

**Be precise about what "works everywhere" means**, because it is easy to overclaim.
Three distinct capabilities, only the first two of which are universal:

| Capability | Browsers | What the app gets |
|---|---|---|
| Trigger a download | All | A filename *suggestion*. No handle, no path, no way to update the file later |
| Read a user-picked file (`<input type="file">`) | All | One file, user-initiated, per click |
| Write to a chosen path repeatedly (`showSaveFilePicker` + a persisted handle) | **Chrome / Edge only** | Pick once, autosave indefinitely |

`downloadTreeExport` is firmly in row 1 — `Blob` → `createObjectURL` → synthetic
`<a download>` → `click()` → `revokeObjectURL` (`treeExport.ts:40-52`). The object URL
is revoked immediately; nothing persists. Every export is a **new** timestamped file.

Safari and Firefox do support OPFS (`navigator.storage.getDirectory()`), but that is
origin-private storage — invisible in the user's filesystem and evictable on the same
timer. It is not a durability mechanism.

So Tier 2 is **not a missing capability so much as a missing automation**: the *outcome*
(a JSON file on disk the user controls) is reachable in every browser, but on
Safari/Firefox it costs a deliberate click **per save, in perpetuity, and depends on the
user remembering**. After twenty turns that is one current file on Chrome versus N stale
files — or zero — elsewhere.

That is a real gap, and it is precisely why Tier 0's nudge and Tier 0.5's restore carry
the weight on those browsers: if the save is manual, the app's job is to ask at the
right moment and to recover gracefully when the answer was no. See Sequencing.

## The ladder is built upside down

| | Risk of loss | What the original tier plan gave it |
|---|---|---|
| **Safari** | Highest — a 7-day timer | Nothing beyond what ships today |
| **Firefox** | Medium — eviction under pressure | `persist()`, via a prompt users decline |
| **Chrome / Edge** | Lowest — engagement-based, usually granted | `persist()` **and** autosave |

The browser most likely to lose data gets the least help. Correcting that inversion is
the main change in this revision.

It also collides with Phase 4, whose single metric is *"track who came back a second
time."* On Safari, a returner past day 7 opens an empty app and reads it as a broken
product — so that metric would be measuring Apple's ITP policy rather than retention.

## Two defects found while auditing this

- **`persistError` answers a failed write with another write.** `useTreeStore.ts:397`
  handles a stream/persist failure by calling `db.nodes.update` (`:405`). If the
  original failure was quota, that write fails too — and the call at `:436` does not
  await it, so it surfaces as an unhandled rejection. The error handler breaks in
  precisely the case it exists for.
- **Quota failures are never named as quota.** Three write paths, three behaviours: the
  throttled stream flush logs to `console.error` (`:73`) and is silent to the user;
  stream failures are reported as stream errors (`:446`); only tree creation surfaces
  anything (`:720`, `{ ok: false, error }`). A `QuotaExceededError` should say "storage
  is full, export now", not "generation failed".

## The plan — three tiers

### Tier 0 — the floor (all browsers, exists today)

Manual export stays the universal fallback. It works everywhere, including the browsers
where Tiers 1 and 2 do not. What it lacks is a prompt, which is the nudge below.

**This is the cross-browser durability product, not a stopgap under the "real" tiers.**
Export *and* import already ship and already round-trip on every browser; Tier 2 only
automates a mechanism that works today. Tier 0 therefore ships **before** Tier 2, not
after — the revision of 2026-09-21.

**Add:** an export nudge that fires once per tree, when the tree is not the demo
(`isDemoTree`, `lib/demoTree.ts`) and has crossed a real-work threshold — around 8
turns with recorded tokens, meaning real money was spent. Dismissal state goes in an
optional `AppSettings` field, which needs no migration (same trick `providerOverride`
used).

Never fires on the demo tree. Someone exploring canned content has nothing to lose, and
a nudge there reads as a dark pattern.

**Make the urgency browser-aware.** Same mechanism, different copy, because the risk
genuinely differs by an order of magnitude:

| Detected | Line |
|---|---|
| No `showSaveFilePicker` **and** `persist()` not granted (≈ Safari) | "This browser clears site data after about a week of not visiting. Keep a copy." |
| `persist()` granted (≈ Chrome / Firefox after accept) | A quieter line — storage is durable but not backed up |
| `estimate()` reports a tiny quota (≈ private window) | "Private window — everything here is discarded when you close it." Say it up front |

Detect by **feature and outcome, never by user-agent string**. UA sniffing is wrong
within a release or two and is unfalsifiable in tests; `persist()`'s return value and
the presence of an API are both directly assertable.

### Tier 0.5 — restore on empty (all browsers, ~2 h)

If IndexedDB comes up empty but the user has been here before (any surviving
`AppSettings` row, or a returning-visitor flag), do not present a blank canvas. Offer
the import path directly: *"No trees found. Restore from an export?"*

This is the single highest-value item for the Safari path and it needs no new
capability — `ImportButton` and `parseImportDoc` already exist. It converts eviction
from silent data loss into a two-click recovery for anyone who took the Tier 0 nudge,
and it is the difference between "the app lost my work" and "the app helped me get it
back."

### Tier 1 — stop being evictable (all browsers, ~1 hour)

Call `navigator.storage.persist()` once, on the first write to a non-demo tree — not on
boot. Firefox prompts the user, and a prompt that appears before the user has made
anything is a prompt they decline. Asking after their first real turn means asking
about something they now have a reason to keep.

Fire-and-forget: it returns a boolean, it can be denied, and nothing in the app should
depend on the answer. Pair it with `navigator.storage.estimate()` so the honest line
can state real numbers instead of adjectives.

**Grant behaviour differs by browser**, and the difference is the whole reason Tier 2
exists:

| Browser | `persist()` outcome |
|---|---|
| Chrome / Edge | Granted silently based on engagement signals — bookmarks, install, repeat visits |
| Firefox | Prompts the user; granted if they accept |
| Safari | May report granted, but the 7-day rule below still applies |

### Tier 2 — a real file on disk (Chrome / Edge, ~1 day)

The File System Access API gives the user a real file, in a location they chose, that
the app autosaves into. This is the only mechanism here that survives a site-data clear,
a profile reset, or eviction *without the user doing anything*.

**Demoted below Tier 0 on 2026-09-21.** It is a convenience layered on the export path,
not a capability other browsers lack — the same file, saved automatically instead of on
a click. Shipping it before the cross-browser nudge would spend a day making the
lowest-risk browser safer while the highest-risk one got nothing.

**It is also, for free, the BYO-cloud story.** `showSaveFilePicker()` lets the user pick
*any* folder, including a synced Google Drive / OneDrive / Dropbox folder on desktop. So
does the plain download the app already produces, if their Downloads folder syncs — as
many do. The user gets cloud-backed trees with zero OAuth scopes, zero new hosts in the
CSP, and zero new privacy claims from us. See "BYO-cloud" below for why the API-based
version is not worth its price.

**This is not sync and it is not a backend.** There is no server, no account, no network
call. It is a local file, the same as the export the app already writes — just kept
current automatically instead of on demand. The "no backend" rule in
[`mvp-strategy.md`](mvp-strategy.md) is not in tension with it.

**The flow:**

1. After the user's first substantial non-demo tree, offer it once:
   *"Keep a copy of this tree on disk?"* Opt-in, dismissible, never automatic.
2. `showSaveFilePicker()` — the user picks the location and filename. The app suggests
   `exportFilename(tree)`, which already exists (`treeExport.ts:29`).
3. Store the returned handle in IndexedDB. File handles are structured-cloneable, which
   is precisely what makes this work across visits — the handle survives a reload; a
   blob URL would not.
4. On every committed tree change, write the file — debounced, and **never during an
   active stream**. Serialize with the existing `buildExportDoc` / `serializeExportDoc`
   (`treeExport.ts:16`, `:25`). Writing on turn finalize rather than on every token
   keeps it off the hot path entirely.
5. On a later visit: `queryPermission({ mode: 'readwrite' })`. If `granted`, resume
   silently. If `prompt`, show a one-click "Resume saving to `<filename>`" — a browser
   permission prompt must be triggered by a user gesture, so this cannot be automatic.
6. Show state in the header: *"Saved to metrics-design.json · 12s ago"*, or a clear
   "Not saving to disk" when it is off. An autosave the user cannot see is an autosave
   they cannot trust.

**Partial-write corruption is handled by the platform.** `createWritable()` writes to a
swap file and commits atomically on `close()`. A crash mid-write leaves the previous
good file intact. This does not need to be built.

## Trade-offs

| Decision | Gains | Costs |
|---|---|---|
| `persist()` after first real write, not on boot | Firefox users see the prompt when it means something | A tree created and abandoned in the first session is still evictable |
| File handles, opt-in | Real durability; user picks the location; no surprise file writes | Chrome/Edge only; a dialog most users will decline the first time |
| Debounced write on finalize | Never competes with streaming for the main thread | Up to one turn of work can be lost on a hard crash |
| Whole-document rewrite each save | Reuses the export path exactly; no second serializer to keep correct | O(tree) per save. Fine at 200 nodes; revisit if trees get far larger |
| Autosave status in the header | The user can tell whether they are protected | More header surface, already at 117/150 lines — needs its own component |

## Where this still fails

- **Safari.** No File System Access, and script-writable storage is cleared after
  roughly seven days without interaction with the origin. `persist()` does not reliably
  override it. On Safari, manual export is genuinely the only durability story — which
  is why Tier 0 is not optional, and why Tier 0.5 (restore on empty) matters more here
  than anywhere else. **Safari's timer cannot be beaten from inside the browser.** It
  can only be made visible before it fires and recoverable after. That is the whole
  design goal; anything framed as "preventing" it is overpromising.
- **Private / incognito windows.** Storage is discarded at session end by design.
  Detectable via `estimate()` returning a tiny quota; worth saying plainly rather than
  letting the user find out.
- **The user deletes or moves the file.** The handle goes stale; the app must degrade to
  "not saving" visibly rather than failing silently.
- **Permission revoked between visits.** Recoverable, but only with a click. Silent
  resumption is not possible by design.

---

## Is browser-local a bad product? Do we need a desktop app?

Asked directly on 2026-09-21, after the Chrome-only finding above landed harder than it
should have. Recorded so the answer does not have to be re-derived at midnight.

**No, and no.** The reasoning, in order of how much it should change your mind:

### The loss profile is inverted from the fear

Safari's rule is seven days of **no visits**. So the timer selects for exactly the wrong
intuition about who gets hurt:

| User | Visit pattern | Tree value | Outcome |
|---|---|---|---|
| Using it as intended — turn 30 of a real problem | Every few days | High | **Timer never fires** |
| Tried it, liked it, busy fortnight | Gap > 7 days | Low–medium | Loses an exploration |
| Tried it once, never returned | Never | ~Zero | Loses nothing they wanted |

The users with the most to lose visit often enough to keep resetting the clock. The one
who gets bitten is a lapsed triallist whose tree was mostly demo poking — and today they
return to a freshly seeded demo tree (`App.tsx` → `seedDemoTree`, idempotent), which
reads as a fresh install rather than a crash. Not nothing, but not "the app eats work".

### The precedent

Excalidraw is browser-local, IndexedDB, no account, and carries this exact exposure. So
does tldraw. Both are widely loved. What separates them from a genuinely bad local-first
app is not the storage model — it is whether the user was told, and whether they can get
their work back.

### What would actually make it bad

1. ~~Browser storage can be evicted~~ — a property of the platform, not a defect.
2. **The user was not told.** True today. ← the real sin
3. **There is no way back.** True today. ←

(2) and (3) are Tier 0 and Tier 0.5, about a day of work. That does not remove the risk;
it converts *silent data loss* into *a stated characteristic with a recovery path*. That
conversion is the whole difference.

### Why a desktop app is the wrong trade

[`ROADMAP.md`](../ROADMAP.md) Phase 3 states the advantage being spent: *"Nobody installs
anything, ever."* Going desktop costs the Phase 4 strategy (a link converts far better
than a download from an unknown indie developer), code signing and notarization, an
update channel, per-platform builds, and the one-click demo — to address a failure mode
affecting a minority of a minority.

**It also stays available.** Tauri can wrap this same web app whenever evidence calls for
it. This is a door that does not close, not a fork in the road, and the evidence belongs
to Phase 4. Do not treat it as urgent.

### The cheap middle path — verify before believing

**Installed web app ("Add to Dock" on macOS, "Add to Home Screen" on iOS).** Installed
web apps plausibly get storage treated differently from a browser tab, and may be exempt
from the seven-day purge. A web app manifest is a few lines and needs **no service
worker** — which matters, since a service worker would complicate the CSP.

If it holds, this is the Safari durability story for near-zero cost. **Apple has changed
this behaviour more than once — verify against current behaviour before writing it into
the UI or claiming it to users.** ~20 minutes. Tracked in ROADMAP carried debt.

---

## BYO-cloud — Google Drive / OneDrive as the user's own backend

Evaluated 2026-09-21. **Technically viable, deliberately not scheduled.** Recorded here
so it is not re-derived, and because the reasoning is not the obvious one.

### It would work, and it does not need a backend

Both providers support the OAuth 2.0 **authorization-code flow with PKCE**, which exists
specifically so a public client with no server secret can authenticate. The redirect
returns to our own static page. Concretely:

| | Google Drive | OneDrive |
|---|---|---|
| Auth | OAuth 2.0 + PKCE | OAuth 2.0 + PKCE (MSAL, an npm package — bundles under `script-src 'self'`) |
| Narrow scope | `drive.file` — only files the app created or the user picked | `Files.ReadWrite.AppFolder` — an app-private folder |
| API | Drive REST v3 | Microsoft Graph |
| Server secret | None | None |

The narrow scopes matter: neither grants read access to the user's existing files. The
app would see only the trees it wrote. Serialization reuses `buildExportDoc` /
`serializeExportDoc` exactly as Tier 2 does — it is the same document, sent over HTTPS
instead of written to a handle.

**Verify before committing** (claims that drift and were not re-checked): whether
Google's consent screen shows an unverified-app interstitial for `drive.file` alone,
and whether their token endpoint's CORS policy permits the browser-side exchange
without the Google Identity Services script — pulling in that script would violate the
`script-src 'self'` we declined the Cloudflare beacon to keep.

### The honest framing: it breaks "no third party", not "no backend"

This is the part worth being precise about, because the instinct that it is "still
local, the user controls it" is **half right**.

| | Local file (Tier 2) | User's Drive / OneDrive | Our backend |
|---|---|---|---|
| Who holds the bytes | User's disk | **Google / Microsoft** | Us |
| Who controls access | User | User — revocable, deletable | Us |
| Can *we* read it | No | **No** | Yes |
| Survives a site-data clear | Yes | Yes | Yes |
| Marginal cost to us | $0 | $0 | $$ |
| New party in the trust story | None | **One** | None (we are the party) |

So it is genuinely *not* sync-as-a-service, and it does not put us on the hook for
storage costs or user data. But the claim "your conversations never leave your machine"
would stop being true, and that claim is load-bearing for this product's positioning.
The replacement — "your trees go to your Google Drive, if you switch it on" — is still
honest and still good. It is just a claim that requires precision to state, and privacy
copy is exactly where slightly-wrong costs trust disproportionately.

Transparency would demand: naming the destination before the consent screen, naming the
scope in plain words, showing the connection state persistently, and a disconnect
control that also offers to delete what was uploaded. That is real surface, not a
checkbox.

### Why it is not scheduled

1. **Storage is cheap; the expectation it creates is not.** Once a tree is in Drive,
   *"open it on my laptop"* is the immediately obvious next request — and that is
   multi-device sync, which needs conflict resolution over a branching DAG. Users will
   not distinguish BYO-storage from sync, and the roadmap's
   [`What to refuse`](../ROADMAP.md) list names **sync** as the one request that turns a
   free static page into a service. This is the cheapest-looking door into the most
   expensive room.
2. **It widens the CSP.** `connect-src` is currently OpenRouter plus localhost, and it
   is the primary mitigation for V1–V3 below — an XSS that cannot reach a destination
   cannot exfiltrate a key. Adding Google and Microsoft origins weakens that control for
   every user, including the ones who never turn the feature on.
3. **It buys little the free path does not.** The problem to solve is Safari durability,
   and Tier 0 + Tier 0.5 solve it for zero new hosts, zero OAuth registration and zero
   new privacy claims. Meanwhile a user who *wants* their trees in Drive can already put
   them there — via a synced folder in `showSaveFilePicker()`, or simply a synced
   Downloads folder.
4. **It is unfalsifiable pre-launch.** Nobody has asked. This is precisely a Phase 4
   decision, and the same "hold until asked twice" rule that governs sync applies.

### If it is ever revisited

Take it as a **Track C** item, after Phase 4 evidence, and only if users ask for
cross-device access specifically — not merely for backup, which Tier 0/0.5 already
cover. Do Drive first (larger audience, narrower scope), keep it strictly opt-in, and
ship it as *backup*, not sync: one-way upload with an explicit restore, no background
reconciliation, no last-writer-wins. If the request is genuinely for sync, the honest
answers are read-only share links (already Track C) or declining.

---

# Part 2 — Key security

## The constraint that shapes everything

**An OpenRouter key cannot be retrieved after creation.** It is shown once. This single
fact inverts the intuitive security default.

A session-only key — one the app refuses to persist — sounds safer. In practice, for a
user who did not save it elsewhere, it means creating a *new* key on every visit and
leaving a trail of orphaned keys behind. The recovery cost is unbounded and falls
entirely on the user.

So: **persist the key by default.** The protection comes from bounding the damage and
giving the user control, not from refusing to store a credential they cannot get back.

An earlier draft of this plan recommended the opposite. It was wrong.

## What "session" means, since the word is ambiguous

| Meaning | Key dies on | Re-entry frequency |
|---|---|---|
| Page session (memory only) | Reload, tab close, crash | Many times a day |
| `sessionStorage` | Tab close; survives reload | Once per tab |
| Unlock-scoped (encrypted, unlocked into memory) | Idle timeout or explicit lock | Once per unlock |
| Persisted | Never | Never |

Page-session is wrong for this app specifically: `App.tsx:29-41` reopens the last tree
on load, so returning by reload is *designed-for* behaviour. A key policy that punishes
the app's own intended flow is a bad policy.

## The plan

1. **Warn at the point of entry.** Directly above the key field:
   *"OpenRouter shows this key only once — save it in your password manager before
   continuing."* One sentence, no code, and it prevents the single most likely bad
   outcome. **Highest value item in this document.**
2. **Cap the blast radius.** Beside it: *"Use a dedicated key with a spend limit for
   this app."* This bounds the damage of every threat below simultaneously, and makes
   the key cheap to revoke. Worth more in practice than encrypting it would be.
3. **Persist by default**, as argued above. No behaviour change; the change is that it
   is now a stated decision rather than an unexamined one.
4. **Add an explicit "Forget key" control** next to the field. Users get session-only
   behaviour by choice — before a screen share, on a borrowed laptop — without it being
   imposed on everyone. `resetSettings` (`settingsStore.ts:113`) is the model; this
   needs a narrower version that clears only the credential.
5. **Show the destination host.** `openRouterBaseUrl` is user-editable
   (`SettingsModal.tsx:86`) and the key is sent to whatever it names
   (`streamingClient.ts:36`, `:44`). Display the exact host the key will be sent to,
   and warn when it is not the default. See vulnerability V7.
6. **Add a Content-Security-Policy.** `index.html` has none today. See V1.
7. **Evaluate OAuth PKCE** as the primary path, with paste as fallback. If OpenRouter's
   flow works as documented, the app provisions its own scoped key via a browser
   redirect — no server secret, no paste, and re-authorizing is a click. That dissolves
   the non-retrievability constraint entirely. **Verify against current OpenRouter docs
   before committing.**
8. **Passphrase or WebAuthn unlock — gated, not now.** Real protection for V4/V5/V8,
   at the cost of an unlock step every session. Worth building if Phase 4 produces users
   who ask. Not worth imposing on everyone before then.

## Where we are protected — verified in source

| Protection | Evidence |
|---|---|
| LLM output cannot inject script | `MarkdownContent.tsx` uses `react-markdown` v10 with `remark-gfm` + `rehype-highlight` only. **No `rehype-raw`**, and `dangerouslySetInnerHTML` / `innerHTML` appear nowhere in `src/`. Raw HTML in model output is escaped, not rendered. v10 also strips dangerous URL schemes before a custom `a` component sees the href |
| Key is sent to exactly one place | `streamingClient.ts:44` — the only `Authorization` header in the codebase |
| The price catalog is fetched anonymously | `openRouterCatalog.ts:84` — `GET /api/v1/models` with `Accept` only, no credential |
| Exports contain no credential | `buildExportDoc` (`treeExport.ts:16`) spreads `tree` + `nodes`; the settings row is not in the document |
| Key is masked by default in the UI | `SettingsCredentialField.tsx:43` — `showKey` initialises `false`; `MaskedInput` renders `type="password"` until toggled |
| No key in `localStorage` / `sessionStorage` | Zero hits for either across `src/` |
| No telemetry, analytics, or backend | No fetch destination outside the configured provider and openrouter.ai's catalog |
| Small supply-chain surface | 10 direct runtime dependencies |

## Where we are vulnerable

Severity = damage if it occurs. Likelihood = probability for *this* app and audience.
Risk is the combination.

| # | Vulnerability | Severity | Likelihood | Risk | Mitigation |
|---|---|---|---|---|---|
| **V1** | XSS on the origin exfiltrates the key | Critical | **Low** — the usual vector (rendering model output) is closed by default escaping, and there is no `innerHTML` anywhere | **Low–Moderate** | Add a CSP with a tight `connect-src`, so even successful injection has nowhere to send the key. Make "never add `rehype-raw`" a written rule in `CLAUDE.md` |
| **V2** | A compromised npm dependency does the same | Critical | Low | **Moderate** | Lockfile is committed; 10 direct deps. CSP limits exfiltration destinations. Review dependency additions that touch rendering or network |
| **V3** | Compromised static host serves modified JS | Critical | Very low | **Low** | Reputable host, 2FA on the account. Not otherwise defensible by the app |
| **V4** | A browser extension with host permissions reads IndexedDB | High | **Moderate** — power users run many extensions | **Moderate–High** | **None available to the app.** Extensions with host access can read any origin's storage. Encryption helps only while locked. This is the honest limit of browser-local security |
| **V5** | Local access — shared machine, borrowed laptop, devtools | High | Low–Moderate | **Moderate** | "Forget key" control; passphrase unlock if gated work ships. Scoped key caps the damage |
| **V6** | Key visible during a screen share or demo | High | **Moderate** — this app exists to be demoed | **Moderate** | Already masked by default ✓. "Forget key" before demos. Never log the key anywhere |
| **V7** | Key sent to an attacker's endpoint via a modified `openRouterBaseUrl` | Critical | Low — needs social engineering or a bad paste | **Moderate** | Show the destination host next to the key field; warn clearly when it is not the default. Currently the field accepts any URL with no indication of what it means |
| **V8** | Disk forensics, profile backup, or browser-profile sync | Moderate–High | Low | **Low–Moderate** | Passphrase encryption (gated). Scoped key with a spend limit bounds the loss |

### The two that matter most

**V4 (extensions) is the highest residual risk and it has no fix.** Any browser-local
app that holds a credential is readable by an extension the user has granted host
access to. Encrypting at rest does not help, because the app must decrypt to use it.
This is not a flaw in the design — it is the ceiling of what browser-local storage can
promise, and it should be stated plainly rather than papered over.

**V7 is the cheapest real fix on the list.** A user-editable field that silently
determines where a credential is transmitted, with no display of the destination, is a
genuine defect. It costs a few lines to show the host and warn on a non-default value.

### The conclusion this leads to

Since V1–V4 all end in "the key is readable by sufficiently privileged code," secrecy
cannot be the primary control. **Blast radius is.** A dedicated key with a spend limit
converts every critical-severity row above into a bounded, revocable, visible loss.
That is why item 2 of the plan is a line of copy rather than a cryptographic system —
not because cryptography is worthless, but because it protects a strictly smaller set
of rows at strictly higher cost.

## Trade-offs

| Decision | Gains | Costs |
|---|---|---|
| Persist by default | No lost keys, no orphaned keys, no friction | Key is at rest on disk, exposed to V4/V5/V8 |
| Blast radius over encryption | Bounds every threat at once; one line of copy | Depends on the user actually creating a scoped key |
| "Forget key" instead of forced session-only | Users who need it get it; others are not punished | Only protects those who remember to use it |
| Passphrase unlock deferred | No unlock step imposed before there is demand | V5/V8 stay open in the meantime |
| CSP | Turns most XSS-class compromise from "key stolen" into "script blocked" | Must be maintained as the app's network surface changes |
| OAuth PKCE if viable | Removes the paste, the storage question, and non-retrievability together | Unverified; adds a redirect flow; OpenRouter-specific |

---

## Sequencing

> Revised 2026-09-21. The key half shipped; the tree half was re-ordered so the
> highest-risk browser is served first. Tier 2 moved out of "shortly after".

**Shipped 2026-09-21** (launch plan Phase B): the entry warning, the scoped-key line,
"Forget key", the destination-host display, and the CSP — which landed with the deploy
(`public/_headers`, `connect-src` limited to OpenRouter and localhost), ahead of its
"cheap and unscheduled" slot below.

**Before launch** — the remaining Phase 3 "where data lives" box, ~1d total:

| Order | Item | Cost | Why here |
|---|---|---|---|
| 1 | Tier 1 — `persist()` on first real write + `estimate()` | ~1 h | Cheapest real protection; feeds the honest line real numbers |
| 2 | Tier 0 — export nudge, **browser-aware urgency** | ~3 h | The only durability story Safari has |
| 3 | Tier 0.5 — restore on empty | ~2 h | Turns eviction into a two-click recovery |
| 4 | Name `QuotaExceededError` as quota on the write paths | ~1 h | Today it reads as a generation failure |
| 5 | Fix `persistError`'s write-to-report-a-write-failure | ~0.5 h | Handler breaks in the case it exists for |

Items 4 and 5 are the defects recorded above. They are small, they are in the same
files, and doing them here avoids a second pass through `useTreeStore`.

**After launch, unscheduled** (~1d): File System Access autosave, opt-in, Chrome/Edge.
Demoted from "shortly after" — it is convenience on a working mechanism, and it
incidentally covers BYO-cloud via a synced folder.

**Gated on Phase 4 demand**: passphrase / WebAuthn unlock; BYO-cloud (Drive / OneDrive)
as a Track C item, and only for cross-device access rather than backup. OAuth PKCE for
the *key* moves up the moment it is verified to work — it is the only item that improves
security *and* usability at the same time.
