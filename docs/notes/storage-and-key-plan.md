# Local Storage Policy — tree durability and key handling

> **Where this fits.** Tier 2 rationale behind the Phase 3 "where data lives" box in
> [`ROADMAP.md`](../ROADMAP.md), which was originally one checkbox and is split here
> into two. Written 2026-09-20. Every claim about current behaviour was verified
> against source, with file and line cited.

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

## The plan — three tiers

### Tier 0 — the floor (all browsers, exists today)

Manual export stays the universal fallback. It works everywhere, including the browsers
where Tiers 1 and 2 do not. What it lacks is a prompt, which is the nudge below.

**Add:** an export nudge that fires once per tree, when the tree is not the demo
(`isDemoTree`, `lib/demoTree.ts`) and has crossed a real-work threshold — around 8
turns with recorded tokens, meaning real money was spent. Dismissal state goes in an
optional `AppSettings` field, which needs no migration (same trick `providerOverride`
used).

Never fires on the demo tree. Someone exploring canned content has nothing to lose, and
a nudge there reads as a dark pattern.

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
a profile reset, or eviction.

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
  is why Tier 0 is not optional.
- **Private / incognito windows.** Storage is discarded at session end by design.
  Detectable via `estimate()` returning a tiny quota; worth saying plainly rather than
  letting the user find out.
- **The user deletes or moves the file.** The handle goes stale; the app must degrade to
  "not saving" visibly rather than failing silently.
- **Permission revoked between visits.** Recoverable, but only with a click. Silent
  resumption is not possible by design.

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

**Before launch** (folded into the Phase 3 "where data lives" box, ~0.75d):
the honest line, `persist()`, the entry warning, the scoped-key line, "Forget key",
the destination-host display, and the export nudge.

**Shortly after** (~1d): File System Access autosave, opt-in, Chrome/Edge.

**Cheap and unscheduled**: the CSP. Small, and it downgrades the severity of V1–V3.

**Gated on Phase 4 demand**: passphrase / WebAuthn unlock. OAuth PKCE moves up the
moment it is verified to work — it is the only item that improves security *and*
usability at the same time.
