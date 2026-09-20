# Tool Calling & Web Search — Research

> **Where this fits.** This is the *reasoning* behind a possible tools capability —
> API shapes, what the current architecture can and cannot absorb, and the UI
> decision. No checklist here. If this work is adopted, boxes go in
> [`../ROADMAP.md`](../ROADMAP.md) under the Later track; this note is updated only
> when the findings themselves change.

**Revision:** 1 — 2026-09-12
**Assessed against:** branch `feat/branch-on-selection-and-streaming-perf` at `fc82dc7`
**API facts verified:** 2026-09-12 against the live OpenRouter `/api/v1/models` payload
and current OpenRouter / Ollama documentation. Anything marked ⚠️ was *not* verified
against a live call and must be confirmed before code depends on it.

---

## 1. Verdict

Two jobs of very different size, and web search is the small one.

| | Web search | General tools (function calling) |
|---|---|---|
| Who runs it | OpenRouter, server-side | Us, in the browser |
| Request change | add `plugins: [{id:'web'}]` | add `tools[]`, then loop |
| Round trips per turn | 1 (unchanged) | 2–N |
| Schema change | none | yes — Dexie v7 |
| Effort | ~150 lines | ~1 week |
| Provider coverage | OpenRouter only | OpenRouter; Ollama partial |

**Recommendation:** if tools are adopted at all, ship web search via the OpenRouter
plugin and defer the general tool loop. The plugin needs no client loop because
OpenRouter runs the search and injects results *before* the model streams its first
token — the existing one-shot `while (true) reader.read()` in `streamingClient.ts`
keeps working untouched.

**Caveat on scope.** `ROADMAP.md` § "What to refuse" lists **Agents** and **MCP** and
**plugin system**. The web-search plugin is not any of those — it is a request flag on
an existing call. A general client-side tool loop is closer to the line, and should not
be started without Stop-4 evidence that anyone wants it.

---

## 2. What the current architecture can absorb

### 2.1 Absorbs web search without complaint

The plugin path changes one request body and one parse branch. Nothing about the node
model, the context engine, the coalescer, or the throttled flush has to move.

### 2.2 Does *not* absorb a tool loop — the node is a single string

Three facts, and together they are the whole blocker:

- `TurnNode.assistantResponse: string` — `src/types/index.ts:16`
- `ContextResolutionResult.messages` allows `role: 'user' | 'assistant'` only —
  `src/types/index.ts:71`
- `resolveContextPayload` **rebuilds the entire message array from ancestry on every
  dispatch** — `src/lib/contextEngine.ts:32-40`

A tool round-trip is `assistant(tool_calls)` → `tool(result)` → `assistant(text)`. If
the middle two are not persisted, the next turn's context reconstruction silently drops
the tool evidence and the model sees its own answer citing results it can no longer
read. In an app whose entire pitch is *identical inherited context, provable*, that is
a correctness bug, not a cosmetic one.

---

## 3. API facts

### 3.1 OpenRouter web search plugin

Two spellings, same feature:

```json
{ "model": "openai/gpt-5.2:online" }
```

```json
{
  "model": "openai/gpt-5.2",
  "plugins": [{
    "id": "web",
    "engine": "native",
    "mode": "turbo",
    "max_results": 5,
    "search_prompt": "A web search was conducted on `date`. Incorporate the following web search results into your response.",
    "include_domains": ["example.com", "*.substack.com"],
    "exclude_domains": ["reddit.com"]
  }]
}
```

| Option | Type | Notes |
|---|---|---|
| `engine` | string | `native`, `exa`, `firecrawl`, `parallel`, `perplexity`, or omitted |
| `mode` | string | engine-dependent |
| `max_results` | number | defaults to 5 |
| `search_prompt` | string | how results get framed to the model |
| `include_domains` / `exclude_domains` | array | wildcards supported |

Works on **any** model, including ones with no native tool support, because OpenRouter
performs the search itself. Models with native search also accept
`web_search_options: { search_context_size: "low" | "medium" | "high" }`.

Citations come back as:

```json
{
  "message": {
    "role": "assistant",
    "content": "…",
    "annotations": [{
      "type": "url_citation",
      "url_citation": {
        "url": "https://www.example.com/article",
        "title": "Article Title",
        "content": "Extracted excerpt from page",
        "start_index": 100,
        "end_index": 200
      }
    }]
  }
}
```

⚠️ That is the **non-streaming** shape. Where annotations land inside an SSE delta was
not verified — confirm with one live streamed call before building the sources UI.

**Search pricing** is a flat per-request fee, *not* tokens:

| Engine | Cost |
|---|---|
| Exa | $0.007/request (10 results included), $0.001 per extra result |
| Parallel | $0.001–$0.005/request by mode |
| Perplexity | $0.005/request |
| Firecrawl | draws on your Firecrawl account credits |
| Native | provider-specific; exposed per model as `pricing.web_search` |

### 3.2 OpenRouter tool calling

Standard OpenAI shape, passed through untransformed for OpenAI-compatible upstreams and
mapped for the rest. Request takes `tools[]` and `tool_choice` (`'none' | 'auto' |
{function}`). Assistant replies carry:

```json
{ "tool_calls": [{ "id": "…", "type": "function",
                   "function": { "name": "…", "arguments": "<json string>" } }] }
```

Results go back as `{ "role": "tool", "content": "…", "tool_call_id": "…" }`.

While streaming, `function.arguments` arrives as **fragments keyed by `index`**. The
correct consumption is: buffer fragments per index → wait for `finish_reason:
"tool_calls"` → `JSON.parse` the assembled string → execute. Parsing early gets you
invalid JSON.

### 3.3 Catalog fields we currently discard

From a live pull on 2026-09-12: **445 models total, 377 expose `tools` in
`supported_parameters`, 165 carry a `pricing.web_search` rate.**

`normalizeCatalog` (`src/lib/openRouterCatalog.ts:74`) reads `id`, `name`,
`context_length`, and `pricing.{prompt,completion}` and throws the rest away. Two fields
would need keeping:

```ts
supportsTools: boolean        // from supported_parameters.includes('tools')
webSearchPerRequest?: number  // from pricing.web_search
```

### 3.4 Usage accounting — and a correction to carried debt

`ROADMAP.md` carried debt records: *"OpenRouter never reports token usage.
`streamingClient` parses a `usage` frame but never asks for one (`usage: { include:
true }`), so every real OpenRouter turn finalizes at `{0, 0}`."*

**The stated fix is obsolete.** Current OpenRouter docs say `usage: { include: true }`
and `stream_options: { include_usage: true }` are *deprecated and have no effect* —
full usage is now always included, in the last SSE message for a streamed response.
The returned object carries real dollars:

```json
{
  "usage": {
    "prompt_tokens": 194,
    "completion_tokens": 2,
    "total_tokens": 196,
    "cost": 0.95,
    "cost_details": { "upstream_inference_cost": 19 },
    "prompt_tokens_details": { "cached_tokens": 0, "cache_write_tokens": 100 },
    "completion_tokens_details": { "reasoning_tokens": 0 }
  }
}
```

So the `{0, 0}` symptom needs **re-diagnosis**, not the recorded fix. Adding the
deprecated parameter will change nothing. (Root cause not determined here — no API key
was used in this investigation.)

This matters for tools independently: a web search is a flat fee, so
`turnCostUSD()` in `src/lib/pricing.ts` would under-report every searched turn no
matter how good the token counts are. Recording `usage.cost` on the node and preferring
it over the client-side reprice fixes the carried-debt item and the search surcharge in
one move.

### 3.5 Ollama — the gap

Local `/api/chat` accepts `tools` and has streamed `tool_calls` since May 2025, but its
streaming shape is [reported as inconsistent](https://github.com/ollama/ollama/issues/12557)
with the OpenAI convention — do not assume an OpenRouter parser transfers.

There is **no local web search**. Ollama's web search is a *cloud* endpoint
(`https://ollama.com/api/web_search`, plus `/api/web_fetch`) requiring a separate free
`OLLAMA_API_KEY`, max 10 results. That is a second credential and a second network
dependency for the provider whose whole appeal is neither. Ship web search as
OpenRouter-only and say so in the UI.

---

## 4. Changes required

### 4.1 Tier 1 — web search, no loop

**`src/types/index.ts`** — one new shape, threaded through the existing three-level
cascade:

```ts
export interface ToolConfig {
  webSearch?: { maxResults?: number; engine?: 'native' | 'exa' | 'perplexity' }
}
// TurnNode.toolsOverride?: ToolConfig
// ConversationTree.defaultTools?: ToolConfig
// AppSettings.defaultTools?: ToolConfig
```

**`src/services/llm.ts`** — `DispatchTarget` gains `tools`. `resolveDispatchTarget`
already implements node → tree → settings precedence; tools slot in as a fourth field.
No new concept, and `resolveDispatchForNode` keeps its signature shape.

**`src/lib/streamingClient.ts:52`** — the OpenRouter request body:

```ts
body: JSON.stringify({
  model,
  messages: [...],
  stream: true,
  ...(tools?.webSearch && {
    plugins: [{
      id: 'web',
      max_results: tools.webSearch.maxResults ?? 5,
      ...(tools.webSearch.engine && { engine: tools.webSearch.engine }),
    }],
  }),
}),
```

**`processLine` (`src/lib/streamingClient.ts:70`)** currently reads `delta.content`
only. Two additions: `delta.annotations` → `url_citation[]` for a sources list (⚠️ see
§3.1), and `parsed.usage.cost` for the honest dollar figure.

**`src/lib/openRouterCatalog.ts:74`** — keep `supportsTools` and `webSearchPerRequest`
(§3.3) so the picker can disable incapable models and the receipt can quote the
surcharge.

### 4.2 Tier 2 — the general tool loop

1. Widen `MessagePayload.role` to include `'tool'`; add `tool_calls` / `tool_call_id`.
2. Replace the flat string with `TurnNode.steps?: TurnStep[]` as the source of truth.
   **Dexie v7**, backfilling `steps: [{ type: 'text', text: assistantResponse }]`.
   (v6 is taken by [`persona-library-plan.md`](persona-library-plan.md).)
3. Streaming accumulator for `delta.tool_calls[i].function.arguments` fragments, keyed
   by `index`, assembled at `finish_reason: 'tool_calls'` (§3.2).
4. An outer `while (round < MAX_ROUNDS)` inside `submitPrompt` that re-POSTs with the
   appended messages. `tokenCoalescer` and the 400 ms throttled flush both assume one
   continuous stream and must be made to survive round boundaries.
5. `resolveContextPayload` must emit stored tool steps for ancestors, or §2.2 bites.

---

## 5. How we get access to tools

Three sources, decreasing convenience.

**OpenRouter web plugin** — nothing to obtain. The existing API key covers it; billed
per request (§3.1). Works on any model.

**OpenRouter `tools[]`** — nothing to obtain, but *we* supply the implementations. In a
pure browser app that means CORS-clean targets only: a public JSON API, a calculator, a
date function, reading the user's own tree. Anything else needs a proxy — which ends
the "static deploy, your data stays local" line that Phase 3 is built on, and turns a
free static page into a service with costs.

**Ollama** — see §3.5. Cloud endpoint, separate key, or nothing.

---

## 6. UI decision: node-level toggle, not prompt-based

### 6.1 The zero-code path exists and is a trap

`:online` appended to a model id already works today — type
`openai/gpt-4o-mini:online` into `ModelSelect` and web search happens with no code
changes at all.

But `modelUsed` doubles as the pricing key. The suffix *survives* `resolvePrice`'s
longest-prefix match (`src/lib/pricing.ts:80`), so token pricing still resolves
correctly — the flat search fee simply never appears on the receipt. Fine for a
five-minute spike; wrong as the product surface, especially for an app whose headline
feature is an honest cost number.

### 6.2 Why per-node is right

The app already has a per-node dispatch override cascade — `providerOverride`,
`modelUsed`, `systemPromptOverride`, resolved node → tree → global in
`src/services/llm.ts`. Tools are the same kind of thing: a **dispatch input, not
content**. A fourth field costs one row of UI and reuses machinery that is already
tested.

Three surfaces, in build order:

1. **`NodeDispatchControls.tsx`** — already Provider / Model / Persona in the reader
   panel. Add a **Tools** row: `☐ Web search`, with a `max_results` stepper when
   checked, disabled with a tooltip when `provider === 'ollama'`. Persists via
   `updateNode`, applies on next Regenerate, exactly like the other three.
2. **`FanOutRow.tsx`** — the payoff. `FanOutVariant` gains `tools?: ToolConfig`, which
   makes *same prompt, same model, web on vs. web off from identical ancestry* a
   one-click comparison. That is the product's own thesis and no other surface can
   show it.
3. **`TurnNode.tsx` / `ChatMessage.tsx`** — a globe badge on searched turns plus a
   collapsible sources list. Without a visible marker two sibling branches look
   identical and the comparison proves nothing.

**Skip a chat-input toggle.** A per-message tool choice not attached to a node has
nowhere to persist and will not survive regenerate.

---

## 7. Sequencing notes

**The schema bump is cheapest now.** Tier 1 alone does not need `TurnNode.steps[]` —
web results arrive as ordinary assistant text. But shipping Tier 1 on the flat string
and adding Tier 2 later pays for a *second* Dexie migration over trees users have
already built. Pre-launch, with no real users, that migration costs nothing. Doing the
v7 bump while it is free is the cheaper order even if the loop itself waits
indefinitely.

**The demo tree collides with this.** Phase 3's next unchecked box is the canned,
no-key demo tree. If web search ships first, the demo needs canned citations too, or
the demo tree and the live app render differently — which is exactly the kind of
detail a stranger notices in the first minute.

---

## Sources

- [OpenRouter — Web search](https://openrouter.ai/docs/features/web-search)
- [OpenRouter — Requests / parameters](https://openrouter.ai/docs/requests)
- [OpenRouter — Usage accounting](https://openrouter.ai/docs/use-cases/usage-accounting)
- [OpenRouter — Tool calling tutorial](https://openrouter.ai/blog/tutorials/tool-calling/)
- [Ollama — Streaming responses with tool calling](https://ollama.com/blog/streaming-tool)
- [Ollama — Web search](https://docs.ollama.com/capabilities/web-search)
- [ollama/ollama#12557 — streaming tool call inconsistency](https://github.com/ollama/ollama/issues/12557)
- Live `GET https://openrouter.ai/api/v1/models`, pulled 2026-09-12
