import { useCallback, useEffect, useRef, useState } from 'react'
import { probeConnection, type ProbeResult } from '../lib/connectionProbe'
import type { LLMProvider } from '../types'

export type ConnectionTestState = 'idle' | 'testing' | 'ok' | 'fail'

/** The Settings draft fields the probe reads. */
export interface ConnectionDraft {
  provider: LLMProvider
  openRouterApiKey: string
  openRouterBaseUrl: string
  ollamaBaseUrl: string
  defaultModel: string
}

interface Snapshot {
  inputKey: string
  state: ConnectionTestState
  result: ProbeResult | null
}

const IDLE: Snapshot = { inputKey: '', state: 'idle', result: null }

/**
 * Runs `probeConnection` against the *draft* values. A result belongs to the
 * inputs it was run with: edit any field and the state reads `idle` again and
 * an in-flight probe is aborted. Also aborts on unmount and on `reset()`.
 * `probe` is injectable for tests.
 */
export function useConnectionTest(draft: ConnectionDraft, probe = probeConnection) {
  const { provider, openRouterApiKey, openRouterBaseUrl, ollamaBaseUrl, defaultModel } = draft
  const inputKey = [provider, openRouterApiKey, openRouterBaseUrl, ollamaBaseUrl, defaultModel].join('\u0000')

  const [snap, setSnap] = useState<Snapshot>(IDLE)
  const controllerRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    controllerRef.current?.abort()
    controllerRef.current = null
  }, [])

  // Cleanup runs when the inputs change and on unmount.
  useEffect(() => cancel, [inputKey, cancel])

  const run = useCallback(async () => {
    cancel()
    const controller = new AbortController()
    controllerRef.current = controller
    setSnap({ inputKey, state: 'testing', result: null })
    try {
      const result = await probe({
        provider,
        openRouterApiKey,
        openRouterBaseUrl,
        ollamaBaseUrl,
        model: provider === 'ollama' ? defaultModel : undefined,
        signal: controller.signal,
      })
      if (!controller.signal.aborted) {
        setSnap({ inputKey, state: result.ok ? 'ok' : 'fail', result })
      }
    } catch {
      // Aborted: the inputs changed or the modal closed. Nothing to show.
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null
    }
  }, [cancel, probe, inputKey, provider, openRouterApiKey, openRouterBaseUrl, ollamaBaseUrl, defaultModel])

  const reset = useCallback(() => {
    cancel()
    setSnap(IDLE)
  }, [cancel])

  const current = snap.inputKey === inputKey ? snap : IDLE
  return { state: current.state, result: current.result, run, reset }
}
