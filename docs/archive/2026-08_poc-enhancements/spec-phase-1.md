# Phase 1: Global Settings & Provider Reactivity

## Scope
Extract provider configurations (Ollama, OpenRouter, Gemini), API keys, and model parameters into a global persistent Zustand store.

## Sequential Tasks
- Task 1.1: Create `src/store/settingsStore.ts` for API keys, active provider, and model defaults.
- Task 1.2: Bind Settings UI modal in `src/components/SettingsModal.tsx` directly to `settingsStore`.
- Task 1.3: Update API client dispatch in `src/services/llm.ts` to resolve: Node override -> Tree default -> Global store.

## Passing Criteria
- Updating API keys or switching providers in Settings applies on the very next prompt without reload.
- Node-level overrides take precedence over global defaults.
- `npm run typecheck` and test suites pass.