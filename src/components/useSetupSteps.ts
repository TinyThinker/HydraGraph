import { useMemo } from 'react'
import { providerOptions } from '../lib/providerOptions'
import type { ConnectionDraft, ConnectionTestState } from './useConnectionTest'

export interface SetupStep {
  label: string
  /** Shown after the label, e.g. the chosen provider. */
  note?: string
  done: boolean
}

/** Pure: the three setup steps for a draft and the current test state. */
export function setupSteps(draft: ConnectionDraft, testState: ConnectionTestState): SetupStep[] {
  const isOllama = draft.provider === 'ollama'
  const providerLabel = providerOptions().find((o) => o.value === draft.provider)?.label
  // The Ollama URL is prefilled, so step 2 is nearly always done there; the
  // test is the real check.
  const credential = isOllama ? draft.ollamaBaseUrl : draft.openRouterApiKey
  return [
    { label: 'Provider', note: providerLabel, done: true },
    { label: isOllama ? 'URL' : 'Key', done: credential.trim() !== '' },
    { label: 'Test', done: testState === 'ok' },
  ]
}

/**
 * Guidance only: nothing is hidden and Save is never gated. Also returns the
 * index of the current step (the first not done; the last when all are).
 */
export function useSetupSteps(draft: ConnectionDraft, testState: ConnectionTestState) {
  const { provider, openRouterApiKey, openRouterBaseUrl, ollamaBaseUrl, defaultModel } = draft
  return useMemo(() => {
    const steps = setupSteps(
      { provider, openRouterApiKey, openRouterBaseUrl, ollamaBaseUrl, defaultModel },
      testState,
    )
    const firstOpen = steps.findIndex((s) => !s.done)
    return { steps, current: firstOpen === -1 ? steps.length - 1 : firstOpen }
  }, [provider, openRouterApiKey, openRouterBaseUrl, ollamaBaseUrl, defaultModel, testState])
}
