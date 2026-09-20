# AST Token Trimmer Pre-Hook — Analysis

> **Point-in-time analysis — 2026-09-12, branch `feat/branch-on-selection-and-streaming-perf`
> at `fc82dc7`.** Archived record of what was found. Supersedes the conclusion in
> `2026-09_read-hook-diagnosis.md` (see the closing note).

## Verdict

The trimmer is not broken. It works, and it works well — 84% reduction on the files it can touch. But it has **one real defect that makes it a net token *amplifier*** in this repo, and the reason your cache looks empty is mundane: it almost never gets invoked.

---

## 1. Why `.cache/ast-token-trimmer` has ~1 file

I counted every tool call across all 10 session transcripts for this project:

| Tool | Calls |
|---|---|
| Bash | 245 |
| Edit | 48 |
| **Read** | **29** |
| Write | 13 |

The hook matches `Read` only. 29 reads have *ever* happened here. Everything else — `cat`, `sed -n`, `head`, `grep` — bypasses it entirely. This session's own instructions mandate Bash-first reading, so 100% of my reads today were invisible to it.

Of those 29 reads, an entry only lands in the cache when the file is **both** a supported extension **and** over budget:

- Supported: `.py .ts .tsx .mts .cts` only. No `.md`, `.json`, `.css`, `.svg`.
- The 6 logged invocations happened while `--max-tokens` was **5000**, not 800 (you changed it in `.claude/settings.json` at 04:19; the metrics entries are from 04:14–04:17). At 5000, `streamingClient.ts` (1403 tok) and `hook.py` (2149 tok) correctly logged `under_budget`.
- The other ~21 reads (04:29–04:47 local) produced no metrics and no cache entries at all — that session started before the hook was wired in, so it ran without it.

So: 1 cache entry ≈ 1 qualifying read. Arithmetic, not a bug.

**Proof it functions:** I ran a real `Read` on `src/store/settingsStore.ts` this session. It fired, redirected, and logged `1016 → 655 tokens, 9 cuts, parse_status: clean`.

---

## 2. The real defect: it destroys `offset`/`limit` on every read

`hook.py:62-73` builds `updatedInput` as `{"file_path": ...}` — a fresh dict. Claude Code **replaces** the tool input with it, so `offset` and `limit` are dropped. And `_passthrough()` emits an `updatedInput` too, so this happens on **every read, including files it can't trim**.

Repro, just now — 200-line markdown file, `Read(offset=100, limit=3)`:

```
requested:  3 lines starting at line 100
returned:   all 200 lines, numbered from 1
```

Consequences in this repo:

- `Read(docs/ARCHITECTURE.md, offset=400, limit=40)` → pulls all **15,704 tokens**.
- `Read(package-lock.json, offset=…)` → pulls all **69,916 tokens**.
- 59% of this repo's tokens (174,750) sit in files the trimmer can't touch but *can* still un-window.
- For supported files, a windowed read silently returns the whole skeleton with renumbered lines, so any `file:line` reference you get back is wrong.

**Fix:** echo the original `tool_input` back with only `file_path` swapped, instead of constructing a new dict. Passthroughs should emit no `updatedInput` at all.

---

## 3. Second defect: the output is unmarked

The trimmed copy has no watermark. When I read `settingsStore.ts` I got 72 lines numbered 1–72; the real file is 118 lines. Nothing told me bodies had been elided. `languages/__init__.py` even ships `header_prefixes()` — *"used when pruning to tell our own output apart"* — but only `build_skeletons.py` uses it. The hook path emits bare `{ /* ... */ }` placeholders.

A model reading that will conclude `configuredProviders` has an empty body. Edits still land on the real file (I verified), but you can't write an `old_string` for code you were never shown.

---

## 4. Everything else checks out

| Aspect | Finding |
|---|---|
| Correctness | 53/53 files parsed clean, 0 failures |
| Compression | 87,629 → 14,447 tokens (**84%**), 51/53 fit under 800 after |
| Failure modes | Every path degrades to passthrough, always exits 0. Solid. |
| Cache | Content-addressed, atomic writes, corrupt entries = miss. Correct. |
| TTL pruning | Works — the stale 03:27 copy was gone by 05:05 |
| Latency | **245 ms** per supported read, **131 ms** per unsupported one (cold Python + tiktoken + tree-sitter every invocation) |
| Cache GC | None. Entries accumulate per file *version* forever. |
| `prune_old` | Deletes *any* regular file past TTL in the work dir, without checking the watermark. Fine on the default `$TMPDIR` path; destructive if anyone points `--work-dir` at a real directory. |

Observability gap worth fixing: passthrough records log only `{action, reason}` — no path, no limit, no token count. That's precisely why you couldn't answer your own question from the metrics file.

---

## Recommendation

Keep the tool, fix the wiring:

1. **Preserve `offset`/`limit`** — this is the blocking one. Right now the hook costs you more tokens than it saves on any windowed read.
2. Add a `// skeleton — N bodies elided` header to the hook's output.
3. Add `input_tokens` + `path` to passthrough metrics.
4. Consider whether 245 ms × every read is worth it given how rarely `Read` is used here versus Bash.

Also: `docs/archive/2026-09_read-hook-diagnosis.md` (written 04:36 today) concludes *"it never fired, because not one of those reads was a `Read` tool call."* That's wrong on both counts — the metrics file records 6 firings, and the transcripts contain 29 `Read` calls, 21 of them before that note was written. I found this by grepping transcripts, not by reading the doc.

Cleanup: I removed my scratch metrics file. The 2 extra entries in `~/.cache/trim-metrics.jsonl` and 2 new cache entries came from genuine `Read` calls during testing — harmless, left in place.
