<p align="center">
  <img src="public/logo.png" alt="Hydra Graph" width="360" />
</p>

# Hydra Graph

A spatial 2D conversation tree interface for deep LLM research. Replaces the linear chat scroll with a node-based canvas where every branch is an isolated context — no more cognitive overload from parallel questions, no more context drift from deep dives.

![Status](https://img.shields.io/badge/status-MVP%20in%20progress-indigo)
![TypeScript](https://img.shields.io/badge/TypeScript-6-blue)
![React](https://img.shields.io/badge/React-19-61dafb)
![License](https://img.shields.io/badge/license-MIT-green)

---

## The Problem

Standard LLM chat interfaces fail during complex research:

| Failure Mode | What happens |
|---|---|
| **Parallel Wall** | Ask 5 questions at once → massive wall of text, impossible to track follow-ups |
| **Sequential Drift** | Go 5 turns deep on one question → context window polluted, model loses the thread |

## The Solution

A directed acyclic graph (DAG) where each node is a complete Q&A turn. Branching a node creates a child that inherits only its exact ancestor chain — nothing from sibling branches ever leaks in.

```
[ Root: System Architecture ]
        /           \
[ Branch A:       [ Branch B:
  Indexing ]        Security ]
    /    \
[A1: B+Tree] [A2: LSM]
```

Each branch maintains a clean, isolated context stack. Deep dives stay deep without contaminating parallel threads.

---

## Features

- **Spatial canvas** — a "subway map" of compact station-pill nodes with deterministic auto-layout; pan and zoom to navigate
- **Dual pane** — canvas for wayfinding on the left, a linear chat stream for reading and composing on the right
- **Branching** — submit a prompt to fork a child off any turn; edges visualize ancestry, the active path is highlighted. Or highlight a passage inside any response and branch straight from it, quote included
- **Context isolation** — each API call compiles only the direct ancestor chain
- **Fan-out** — one prompt, N branches from identical ancestry, a different model or persona each, dispatched in parallel
- **Compare** — selected siblings column by column, with the shared-context guarantee (same N turns, same ~N tokens) stated on screen
- **Cost receipts** — per-turn and per-tree dollars from a live OpenRouter price catalog, against the counterfactual: what the same turns would have cost as one linear thread that re-sends everything. "Context you didn't pay for"
- **Personas** — set a system prompt at any node (presets included); all descendants inherit it unless overridden
- **Local-first / BYOK** — all data in browser IndexedDB, your API key never leaves your machine
- **Two providers, every model** — OpenRouter (so GPT, Claude, Gemini, DeepSeek, Llama… as `vendor/model` slugs) or a local Ollama instance, streaming token-by-token
- **Workspace** — multiple trees, full-text search with fly-to, JSON export/import, per-tree viewport, keyboard navigation
- **Session restore** — reopen the browser and pick up exactly where you left off

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + Vite 8 + TypeScript 6 |
| Canvas | [@xyflow/react](https://reactflow.dev) v12 |
| State | [Zustand](https://zustand-demo.pmnd.rs) v5 |
| Storage | [Dexie.js](https://dexie.org) v4 (IndexedDB) |
| Layout | [d3-hierarchy](https://github.com/d3/d3-hierarchy) v3 |
| Styling | Tailwind CSS v4 |
| LLM | OpenRouter (GPT · Claude · Gemini · DeepSeek · Llama as `vendor/model` slugs) · Ollama (local) |

---

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. **No API key needed to look around** — a first load seeds
a shipped demo tree: a 16-turn research session with canned responses, a three-model
fan-out on one identical question, a three-persona review of one piece of DDL, and a
cost receipt already showing real dollars (`$0.1794` for the branched tree vs `$0.2545`
as one linear thread). Read it, compare the siblings, export it, delete it — it is
ordinary data, not a slideshow.

To run your own prompts, click the gear icon, pick a provider and enter a key. Already
have trees in this browser and want the demo? Tree switcher → **Reset demo tree**.

For provider configuration, the Ollama `OLLAMA_ORIGINS` gotcha, and the full script list, see **[`docs/SETUP.md`](docs/SETUP.md)**.

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `↑` / `↓` | Select the parent / first child |
| `←` / `→` | Previous / next sibling |
| `b` | Branch a new child from the selected node |
| `r` | Open the reader panel for the selected node |
| `Esc` | Close the reader panel |

Shortcuts are ignored while a text field is focused.

---

## Documentation

| I want to know… | Read |
|---|---|
| Where the project is right now + what's next | [`docs/STATUS.md`](docs/STATUS.md) → [`docs/ROADMAP.md`](docs/ROADMAP.md) |
| What has shipped | [`docs/CHANGELOG.md`](docs/CHANGELOG.md) |
| How the system is built (design, schemas, data flow) | [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| How to run it and configure a provider | [`docs/SETUP.md`](docs/SETUP.md) |
| How the docs are organized / where a new doc goes | [`docs/README.md`](docs/README.md) |

Contributor and AI-agent coding constraints are in [`CLAUDE.md`](CLAUDE.md).

---

## License

MIT
