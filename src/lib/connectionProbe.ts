/**
 * "Test connection" for the Settings modal: one read-only, free request per
 * provider, using whatever is typed in the form (not what is saved).
 *
 * - OpenRouter: `GET {base}/key` with the bearer token. Response is
 *   `{ data: { limit_remaining: number | null, … } }`; 401/403 means a bad key.
 * - Ollama: `GET {url}/api/tags`, which lists pulled models as
 *   `{ models: [{ name: 'llama3:latest', … }] }`.
 *
 * A browser cannot tell a stopped Ollama, a CORS block, and a denied Local
 * Network Access prompt apart — all three are a `TypeError` from `fetch` — so
 * the network message names all three. No React, no stores.
 */

import type { LLMProvider } from '../types'

export const PROBE_TIMEOUT_MS = 8_000

const DEFAULT_OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

export type ProbeFailureKind = 'auth' | 'network' | 'http' | 'timeout' | 'missing'

export type ProbeResult =
  | { ok: true; detail?: string }
  | { ok: false; kind: ProbeFailureKind; message: string }

export interface ProbeInput {
  provider: LLMProvider
  openRouterApiKey: string
  openRouterBaseUrl: string
  ollamaBaseUrl: string
  /** Checked against Ollama's pulled models; ignored for OpenRouter. */
  model?: string
  signal?: AbortSignal
}

const stripSlash = (url: string) => url.trim().replace(/\/+$/, '')

function isOpenRouterHost(base: string): boolean {
  try {
    return new URL(base).host === 'openrouter.ai'
  } catch {
    return false
  }
}

function networkMessage(input: ProbeInput, base: string): string {
  if (input.provider === 'ollama') {
    return (
      `Could not reach Ollama at ${base}. Usual causes: Ollama is not running; ` +
      'OLLAMA_ORIGINS does not include this site; or the browser blocked this site ' +
      'from reaching apps on your computer.'
    )
  }
  const csp = isOpenRouterHost(base)
    ? ''
    : ' This app only allows requests to openrouter.ai, so a custom base URL is blocked.'
  return `Could not reach ${base}. Check your internet connection.${csp}`
}

function openRouterDetail(body: unknown): string {
  const remaining = (body as { data?: { limit_remaining?: unknown } } | null)?.data
    ?.limit_remaining
  return typeof remaining === 'number'
    ? `Key accepted. $${remaining.toFixed(2)} left on this key's limit.`
    : 'Key accepted.'
}

/** `llama3` matches a pulled `llama3:latest`, as Ollama itself resolves it. */
function ollamaDetail(body: unknown, model: string | undefined): string {
  const list = (body as { models?: unknown } | null)?.models
  const names = Array.isArray(list)
    ? list.map((m) => (m as { name?: unknown })?.name).filter((n): n is string => typeof n === 'string')
    : []
  const wanted = model?.trim()
  if (wanted && !names.some((n) => n === wanted || n === `${wanted}:latest`)) {
    return `Connected, but model '${wanted}' is not pulled. Run \`ollama pull ${wanted}\`.`
  }
  return `${names.length} ${names.length === 1 ? 'model' : 'models'} available`
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

/**
 * Probe the provider described by `input`. Resolves to a result for every
 * outcome except a caller abort, which rejects with the `AbortError` (the
 * caller asked to stop; there is nothing to report).
 */
export async function probeConnection(
  input: ProbeInput,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<ProbeResult> {
  const isOllama = input.provider === 'ollama'
  const key = input.openRouterApiKey.trim()
  const base = isOllama
    ? stripSlash(input.ollamaBaseUrl)
    : stripSlash(input.openRouterBaseUrl) || DEFAULT_OPENROUTER_BASE

  if (isOllama && !base) {
    return { ok: false, kind: 'missing', message: 'Enter the Ollama URL first.' }
  }
  if (!isOllama && !key) {
    return { ok: false, kind: 'missing', message: 'Enter an OpenRouter API key first.' }
  }

  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, PROBE_TIMEOUT_MS)
  const onCallerAbort = () => controller.abort()
  input.signal?.addEventListener('abort', onCallerAbort)
  if (input.signal?.aborted) controller.abort()

  try {
    const res = await fetchImpl(isOllama ? `${base}/api/tags` : `${base}/key`, {
      method: 'GET',
      headers: isOllama ? undefined : { Authorization: `Bearer ${key}` },
      signal: controller.signal,
    })
    if (!isOllama && (res.status === 401 || res.status === 403)) {
      return { ok: false, kind: 'auth', message: 'OpenRouter rejected this key.' }
    }
    if (!res.ok) {
      const who = isOllama ? 'Ollama' : 'OpenRouter'
      return { ok: false, kind: 'http', message: `${who} answered with HTTP ${res.status}.` }
    }
    const body = await readJson(res)
    return { ok: true, detail: isOllama ? ollamaDetail(body, input.model) : openRouterDetail(body) }
  } catch (err) {
    if (timedOut) {
      const who = isOllama ? 'Ollama' : 'OpenRouter'
      return { ok: false, kind: 'timeout', message: `No answer from ${who} after 8 seconds.` }
    }
    if (input.signal?.aborted) throw err
    return { ok: false, kind: 'network', message: networkMessage(input, base) }
  } finally {
    clearTimeout(timer)
    input.signal?.removeEventListener('abort', onCallerAbort)
  }
}
