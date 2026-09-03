import { describe, it, expect, afterEach, vi } from 'vitest'
import { streamLLMResponse } from './streamingClient'
import type { ContextResolutionResult, AppSettings } from '../types'

// Helper to create a fake Response from an array of Uint8Array chunks
function createFakeResponse(chunks: Uint8Array[]) {
  let chunkIndex = 0

  return {
    ok: true,
    status: 200,
    text: async () => '',
    body: {
      getReader() {
        return {
          async read() {
            if (chunkIndex < chunks.length) {
              return {
                done: false,
                value: chunks[chunkIndex++],
              }
            }
            return {
              done: true,
              value: undefined,
            }
          },
        }
      },
    },
  }
}

const enc = (s: string) => new TextEncoder().encode(s)

function runStream(
  settings: AppSettings,
  target: { provider: 'openrouter' | 'ollama'; model: string },
  payload: ContextResolutionResult,
) {
  const tokens: string[] = []
  const errors: Error[] = []
  let usage: { inputTokens: number; outputTokens: number } | null = null
  let doneCount = 0

  const done = new Promise<void>((resolve) => {
    streamLLMResponse(
      payload,
      settings,
      target,
      (chunk) => tokens.push(chunk),
      (u) => {
        usage = u
        doneCount++
        resolve()
      },
      (err) => errors.push(err),
    )
  })

  return { done, tokens, errors, get usage() { return usage }, get doneCount() { return doneCount } }
}

describe('streamingClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const testSettings: AppSettings = {
    id: 'global_settings',
    openRouterApiKey: 'or-secret',
    openRouterBaseUrl: 'https://openrouter.ai/api/v1',
    ollamaBaseUrl: 'http://localhost:11434',
    defaultModel: 'openai/gpt-4o-mini',
    provider: 'openrouter',
  }

  const testPayload: ContextResolutionResult = {
    systemPrompt: 'sys',
    messages: [{ role: 'user', content: 'hi' }],
  }

  const orTarget = { provider: 'openrouter' as const, model: 'openai/gpt-4o-mini' }

  it('reassembles a frame split across two reads', async () => {
    const frame = 'data: {"choices":[{"delta":{"content":"Hello world"}}]}\n\n'
    const bytes = enc(frame)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFakeResponse([bytes.slice(0, 20), bytes.slice(20)])))

    const r = runStream(testSettings, orTarget, testPayload)
    await r.done

    expect(r.tokens.join('')).toBe('Hello world')
    expect(r.errors).toHaveLength(0)
    expect(r.doneCount).toBe(1)
  })

  it('preserves a multi-byte character split across two reads', async () => {
    const frame = 'data: {"choices":[{"delta":{"content":"party 🎉 done"}}]}\n\n'
    const bytes = enc(frame)
    const emojiByteStart = enc(frame.slice(0, frame.indexOf('🎉'))).length
    const splitPoint = emojiByteStart + 2 // mid-emoji (🎉 is 4 UTF-8 bytes)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFakeResponse([bytes.slice(0, splitPoint), bytes.slice(splitPoint)])))

    const r = runStream(testSettings, orTarget, testPayload)
    await r.done

    expect(r.tokens.join('')).toBe('party 🎉 done')
    expect(r.errors).toHaveLength(0)
    expect(r.doneCount).toBe(1)
  })

  it('emits a final frame that has no trailing newline', async () => {
    const frame = 'data: {"choices":[{"delta":{"content":"tail"}}]}'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFakeResponse([enc(frame)])))

    const r = runStream(testSettings, orTarget, testPayload)
    await r.done

    expect(r.tokens.join('')).toBe('tail')
    expect(r.errors).toHaveLength(0)
    expect(r.doneCount).toBe(1)
  })

  it('reports a malformed data frame through onError without aborting', async () => {
    const frame = 'data: {"choices":[{"delta":{"content":"good"}}]}\ndata: {oops not json\n'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFakeResponse([enc(frame)])))

    const r = runStream(testSettings, orTarget, testPayload)
    await r.done

    expect(r.tokens.join('')).toContain('good')
    expect(r.errors.length).toBeGreaterThanOrEqual(1)
    expect(r.errors[0]).toBeInstanceOf(Error)
    expect(r.errors[0].message).toContain('Malformed stream payload')
    expect(r.doneCount).toBe(1)
  })

  it('keeps usage metadata from the last frame that carries it', async () => {
    const frameA = 'data: {"choices":[{"delta":{"content":"a"}}],"usage":{"prompt_tokens":1,"completion_tokens":2}}'
    const frameB = 'data: {"choices":[{"delta":{"content":"b"}}],"usage":{"prompt_tokens":5,"completion_tokens":9}}'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFakeResponse([enc(`${frameA}\n\n${frameB}\n\n`)])))

    const r = runStream(testSettings, orTarget, testPayload)
    await r.done

    expect(r.usage).toEqual({ inputTokens: 5, outputTokens: 9 })
    expect(r.tokens.join('')).toBe('ab')
    expect(r.errors).toHaveLength(0)
    expect(r.doneCount).toBe(1)
  })

  it('surfaces an OpenRouter error frame through onError', async () => {
    const frame = 'data: {"error":{"message":"rate limited"}}\n\n'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFakeResponse([enc(frame)])))

    const tokens: string[] = []
    const errors: Error[] = []
    await new Promise<void>((resolve) => {
      streamLLMResponse(
        testPayload,
        testSettings,
        orTarget,
        (c) => tokens.push(c),
        () => resolve(),
        (err) => {
          errors.push(err)
          resolve()
        },
      )
    })

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('rate limited')
  })

  it('sends the OpenRouter key in the Authorization header, not the URL', async () => {
    const frame = 'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n'
    const fetchMock = vi.fn().mockResolvedValue(createFakeResponse([enc(frame)]))
    vi.stubGlobal('fetch', fetchMock)

    const secretSettings: AppSettings = { ...testSettings, openRouterApiKey: 'SECRET-KEY-VALUE' }
    const r = runStream(secretSettings, orTarget, testPayload)
    await r.done

    expect(r.doneCount).toBe(1)
    expect(r.errors).toHaveLength(0)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(url).not.toContain('SECRET-KEY-VALUE')
    expect(init.headers.Authorization).toBe('Bearer SECRET-KEY-VALUE')
    expect(init.headers['Content-Type']).toBe('application/json')
  })

  it('routes to Ollama when target.provider is ollama', async () => {
    const line1 = '{"message":{"content":"hi"},"done":false}\n'
    const line2 = '{"done":true,"prompt_eval_count":1,"eval_count":1}\n'
    const fetchMock = vi.fn().mockResolvedValue(createFakeResponse([enc(line1 + line2)]))
    vi.stubGlobal('fetch', fetchMock)

    const r = runStream(testSettings, { provider: 'ollama', model: 'llama3' }, testPayload)
    await r.done

    expect(r.doneCount).toBe(1)
    expect(r.errors).toHaveLength(0)
    expect(r.tokens.join('')).toBe('hi')
    expect(r.usage).toEqual({ inputTokens: 1, outputTokens: 1 })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('/api/chat')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('llama3')
  })

  it('streams OpenRouter deltas, sends a Bearer header, and reads usage from the final chunk', async () => {
    const frame1 = 'data: {"choices":[{"delta":{"content":"Hel'
    const frame2 = 'lo"}}]}\n\ndata: {"choices":[{"delta":{"content":" world"}}],"usage":{"prompt_tokens":11,"completion_tokens":2}}\n\ndata: [DONE]\n\n'
    const fetchMock = vi.fn().mockResolvedValue(createFakeResponse([enc(frame1), enc(frame2)]))
    vi.stubGlobal('fetch', fetchMock)

    const r = runStream(testSettings, orTarget, testPayload)
    await r.done

    expect(r.errors).toHaveLength(0)
    expect(r.tokens.join('')).toBe('Hello world')
    expect(r.usage).toEqual({ inputTokens: 11, outputTokens: 2 })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions')
    expect(init.headers.Authorization).toBe('Bearer or-secret')
    const body = JSON.parse(init.body)
    expect(body.model).toBe('openai/gpt-4o-mini')
    expect(body.stream).toBe(true)
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' })
  })

  it('skips OpenRouter SSE keep-alive comment lines', async () => {
    const payload =
      ': OPENROUTER PROCESSING\n\n' +
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n' +
      ': OPENROUTER PROCESSING\n\n' +
      'data: [DONE]\n\n'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(createFakeResponse([enc(payload)])))

    const r = runStream(testSettings, { provider: 'openrouter', model: 'x' }, testPayload)
    await r.done

    expect(r.errors).toHaveLength(0)
    expect(r.tokens.join('')).toBe('ok')
  })
})
