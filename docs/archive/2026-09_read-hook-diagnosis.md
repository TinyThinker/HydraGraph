# Read-Hook Trimmer — Why The Metrics File Is Almost Empty

> **Point-in-time diagnosis — 2026-09-12, branch `feat/branch-on-selection-and-streaming-perf`
> at `fc82dc7`.** Archived per `docs/README.md` rule 3: this is a record of what was
> found, not documentation of the current system. If the configuration changes, that
> change is described where it lands (`.claude/settings.json`, `CLAUDE.md`), not by
> editing this file.

**Question asked:** `~/.cache/` AST metrics only has a few entries despite a session
making dozens of file reads — is the pre-hook not working?

**Answer:** the hook works correctly. It never *fired*, because not one of those reads
was a `Read` tool call.

---

## 1. Configuration as found

`.claude/settings.json` (untracked at time of writing):

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Read",
      "hooks": [{
        "type": "command",
        "command": "trim-code-hook --max-tokens 800 --cache-dir ~/.cache/ast-token-trimmer --metrics-file ~/.cache/trim-metrics.jsonl",
        "timeout": 15
      }]
    }]
  }
}
```

Binary resolves: `/Users/osiris/.local/bin/trim-code-hook` → pipx venv
`ast-token-trimmer`.

---

## 2. Root cause

`matcher: "Read"` matches the **`Read` tool** and nothing else.

The session in question ran with auto mode active, whose standing instruction is to do
work through Bash wherever Bash can do the job — *"read files with cat, head, or
sed -n, search with grep and find."* Every file inspection therefore went through
`Bash`: `cat`, `sed -n`, `grep`, `find`, `head`, `wc`. The `Read` tool was called zero
times, so `PreToolUse` never matched, so `trim-code-hook` never executed, so no metrics
rows were appended.

Two correct configurations in direct conflict. Neither is broken on its own; together
the trimmer is bypassed for the entire session and full untrimmed file bodies land in
context.

### 2.1 Evidence

| Observation | Value |
|---|---|
| Metrics rows in `~/.cache/trim-metrics.jsonl` | 6 |
| Timestamps of those rows | `11:14:54Z` → `11:17:05Z` |
| Wall clock when the question was asked | `11:30Z` |
| Rows written during the ~30 Bash-based file inspections | **0** |
| `~/.cache/ast-token-trimmer/` contents | 1 entry, `03:27` local — also pre-session |
| `which trim-code-hook` | `/Users/osiris/.local/bin/trim-code-hook` ✓ |

The 6 surviving rows are from an earlier session, and every one of them is a
`passthrough`:

```
5 × {"action": "passthrough", "reason": "under_budget"}
1 × {"action": "passthrough", "reason": "unsupported_extension"}
```

So as of this diagnosis the trimmer had **never actually trimmed a file** — not once.
That is worth separating from the matcher problem: even when the hook did fire, it
declined every time. Small files were under the 800-token budget; one read was a
non-source extension.

---

## 3. How the hook works (relevant mechanics)

From `ast_token_trimmer/hook.py`:

1. Reads the `PreToolUse` request JSON on stdin.
2. `target_path()` pulls **`tool_input.file_path`** — that specific key, as a string.
3. Rejects unsupported extensions via `backend_for_path`. Supported: `.py`, and
   `.ts` / `.tsx` / `.mts` / `.cts`. Nothing else.
4. Counts tokens; if `<= max_tokens`, passthrough.
5. Otherwise strips to a skeleton, writes a content-addressed copy into a
   self-cleaning work dir, and returns
   `hookSpecificOutput.updatedInput.file_path` pointing at that copy.
6. Always exits 0 — a nonzero exit would read as a blocked read.

Two consequences matter for any fix:

- **The redirect mechanism is rewriting a `file_path` field.** A `Bash` tool input has
  no `file_path`; it has `command`, an opaque shell string. There is nothing to rewrite
  without parsing shell.
- **Only `action: passthrough` rows carry a `reason`.** A successful trim writes
  `input_tokens` / `output_tokens` / `cuts` / `fit` / `lang` and no `action` key. So
  "all rows say passthrough" is a reliable signal that nothing was ever trimmed.

---

## 4. What the bypass cost — measured

The hook was replayed offline against the 15 source files read during the session, same
flags, same 800-token budget:

| File | in | out | saved | |
|---|---:|---:|---:|---|
| `src/store/useTreeStore.ts` | 6208 | 914 | 5294 | `fit=false` cuts=5 |
| `src/db/ChatDatabase.ts` | 1607 | 318 | 1289 | cuts=2 |
| `src/components/FanOutModal.tsx` | 1351 | 181 | 1170 | cuts=1 |
| `src/lib/streamingClient.ts` | 1403 | 249 | 1154 | cuts=3 |
| `src/components/ReaderPanel.tsx` | 1163 | 139 | 1024 | cuts=1 |
| `src/components/NodeDispatchControls.tsx` | 983 | 240 | 743 | cuts=1 |
| `src/lib/openRouterCatalog.ts` | 902 | 454 | 448 | cuts=4 |
| `src/lib/pricing.ts` | 1173 | 725 | 448 | cuts=5 |
| `src/store/settingsStore.ts` | 1016 | 655 | 361 | cuts=9 |
| 6 others | — | — | — | `under_budget` |

**9 of 15 trimmed · 15,806 tokens in · 3,875 out · 11,931 saved (75%).** Every parse
came back `clean`. `useTreeStore.ts` is the one file that does not fit even after
stripping (914 > 800).

### 4.1 The counter-argument, stated honestly

That 75% is not free, and this session is the case study. The investigation it funded
depended on reading function **bodies**, not signatures:

- `processLine` in `streamingClient.ts:70` — the finding was that it reads
  `delta.content` and nothing else. A skeleton lists the function and hides that.
- `submitPrompt` in `useTreeStore.ts` — the coalescer / throttled-flush interaction
  with a multi-round tool loop is entirely inside the body.
- `resolvePrice` in `pricing.ts:80` — the conclusion that `:online` survives the
  longest-prefix match is a property of the loop, not the signature.

All three are in the trimmed set, and `useTreeStore.ts` is the heaviest saving on the
list. A skeleton-first session would have had to re-read those files in full anyway,
paying the tokens twice plus the round trips.

**Reading of the data:** the trimmer is correctly aimed at *orientation* — finding
which file holds what, on a first pass over unfamiliar code. It is aimed wrong at the
*deep-read* phase, where the body is the entire point. 800 tokens is a tight budget for
orientation of a 6k-token store file, and a poor one for reading it.

---

## 5. Options

### Option A — stop routing reads through Bash
Drop the auto-mode preference for `cat`/`sed -n` reads so file reads go back through the
`Read` tool. **The hook already works; nothing needs building.** Cost: loses the Bash
conveniences that motivated the preference (piping, `grep -n` with context, one call
doing several things). Also re-exposes the §4.1 problem — orientation gets cheaper,
deep reads get lossier.

### Option B — accept the bypass, drop or narrow the hook
Keep Bash reads and stop pretending the trimmer is in the loop. Honest, zero work, and
correct if most reads in practice are deep reads. Loses the 75% on orientation passes.

### Option C — teach the hook about Bash
Add a `Bash` matcher and have `trim-code-hook` parse `command` for read-shaped
invocations (`cat X`, `head -n N X`, `sed -n 'a,bp' X`), then rewrite the command to
point at the trimmed copy. Substantially more work than it looks:
- shell parsing, quoting, globs, multiple paths per command;
- pipelines (`cat X | grep Y`) where rewriting the head changes the pipeline's meaning;
- `sed -n '1,200p'` already *is* a budget — trimming it is double-counting;
- silently rewriting a user-visible command is a much bigger surprise than
  redirecting a `Read`.

Not recommended as a first move.

### Option D — split the budget by intent
Keep `Read` matched, raise `--max-tokens` to something that survives a real store file
(~2500–3000), and use Bash deliberately when the body is wanted. This makes the two
tools mean different things — `Read` for "show me the shape", Bash for "show me the
code" — instead of having one silently shadow the other. Requires no code, only a
number change plus a line in `CLAUDE.md` saying which is which.

---

## 6. Recommendation

**D, then A.** Raise the budget first, because at 800 tokens the trimmer's only
recorded behaviour across two sessions is `passthrough/under_budget` — the budget is
simultaneously too low to read a real file and, on this codebase's many small modules,
too high to ever engage. Then restore `Read` as the default read path so the hook is
actually in the loop.

Do not build Option C until the metrics file shows a meaningful number of real trims.
There is currently no evidence about how the trimmer behaves in practice, because it
has never trimmed anything.

### Suggested first change

```jsonc
// .claude/settings.json — matcher unchanged, budget raised
"command": "trim-code-hook --max-tokens 2500 --cache-dir ~/.cache/ast-token-trimmer --metrics-file ~/.cache/trim-metrics.jsonl"
```

Then, to check it is live, look for rows **without** an `action` key:

```sh
grep -c '"input_tokens"' ~/.cache/trim-metrics.jsonl   # real trims
grep -c '"action"'       ~/.cache/trim-metrics.jsonl   # passthroughs
```

---

## 7. Reproduction

Replay the hook over a file set without needing a session:

```sh
for f in src/store/useTreeStore.ts src/lib/streamingClient.ts; do
  echo "{\"tool_input\":{\"file_path\":\"$PWD/$f\"}}" \
    | trim-code-hook --max-tokens 800 \
        --cache-dir /tmp/t/cache --work-dir /tmp/t/work \
        --metrics-file /tmp/t/replay.jsonl >/dev/null
done
cat /tmp/t/replay.jsonl
```

Note for zsh: `for f in $FILES` does **not** word-split an unquoted variable — it
iterates once with the whole string, and the hook reports `unreadable` for a path that
is really fifteen paths. Inline the list or use `${=FILES}`.
