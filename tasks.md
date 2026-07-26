# Execution Tasks Matrix

## Phase 1: Core Foundation & Storage Setup
- [x] Initialize Vite + React + TypeScript + Tailwind CSS project
- [x] Implement Dexie.js database schema (`ChatDatabase.ts`)
- [x] Implement Zustand central state store (`useTreeStore.ts`) with Dexie persistence

## Phase 2: Canvas Integration & Turn Node Component
- [x] Install `@xyflow/react` and configure main canvas container
- [x] Build custom `TurnNode` component (Prompt + Response card layout)
- [x] Wire node dragging, viewport panning/zooming, and edge rendering to Zustand store

## Phase 3: Context Engine & Streaming API Client
- [x] Implement `resolveContextPayload()` parent chain traversal logic
- [x] Implement native SSE streaming fetch client for Gemini API & Ollama
- [ ] Connect real-time streaming deltas to active node state

## Phase 4: Advanced Features & Polish
- [ ] Implement cascading system prompt overrides and UI shield badges
- [ ] Implement sub-tree collapse/expand mechanics (`📦 N Nodes Collapsed`)
- [ ] Integrate `@dagrejs/dagre` for automated branch layout
- [ ] Implement JSON tree export/import backup pipeline
