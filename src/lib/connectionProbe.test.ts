import { describe, it, expect, vi, afterEach } from 'vitest'
import { probeConnection, PROBE_TIMEOUT_MS, type ProbeInput } from './connectionProbe'

const OR: ProbeInput = {
  provider: 'openrouter',
  openRouterApiKey: 'sk-or-test',
  openRouterBaseUrl: '',
  ollamaBaseUrl: 'http://localhost:11434',
}
const OLLAMA: ProbeInput = { ...OR, provider: 'ollama', openRouterApiKey: '' }

const json = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }))

/** A fetch that never answers, but rejects like the real one when aborted. */
const hanging = () =>
  vi.fn<typeof fetch>(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')),
        )
      }),
  )

afterEach(() => {
  vi.useRealTimers()
})

describe('probeConnection — missing input', () => {
  it('reports a missing OpenRouter key without a request', async () => {
    const f = json({})
    const r = await probeConnection({ ...OR, openRouterApiKey: '  ' }, f)
    expect(r).toMatchObject({ ok: false, kind: 'missing' })
    expect(f).not.toHaveBeenCalled()
  })

  it('reports an empty Ollama URL without a request', async () => {
    const f = json({})
    const r = await probeConnection({ ...OLLAMA, ollamaBaseUrl: '' }, f)
    expect(r).toMatchObject({ ok: false, kind: 'missing' })
    expect(f).not.toHaveBeenCalled()
  })
})

describe('probeConnection — OpenRouter', () => {
  it('GETs {base}/key with the bearer token and passes on 200', async () => {
    const f = json({ data: { label: 'x', limit_remaining: 4.5 } })
    const r = await probeConnection(OR, f)
    expect(r).toEqual({ ok: true, detail: "Key accepted. $4.50 left on this key's limit." })
    const [url, init] = f.mock.calls[0]
    expect(url).toBe('https://openrouter.ai/api/v1/key')
    expect(init?.headers).toEqual({ Authorization: 'Bearer sk-or-test' })
  })

  it('omits the credit line when the key has no limit', async () => {
    const r = await probeConnection(OR, json({ data: { limit_remaining: null } }))
    expect(r).toEqual({ ok: true, detail: 'Key accepted.' })
  })

  it('uses a custom base URL, trailing slash stripped', async () => {
    const f = json({ data: {} })
    await probeConnection({ ...OR, openRouterBaseUrl: 'https://proxy.example/v1/' }, f)
    expect(f.mock.calls[0][0]).toBe('https://proxy.example/v1/key')
  })

  it.each([401, 403])('maps %i to auth', async (status) => {
    const r = await probeConnection(OR, json({ error: {} }, status))
    expect(r).toEqual({ ok: false, kind: 'auth', message: 'OpenRouter rejected this key.' })
  })

  it('maps other non-2xx to http with the status', async () => {
    const r = await probeConnection(OR, json({}, 502))
    expect(r).toMatchObject({ ok: false, kind: 'http', message: expect.stringContaining('502') })
  })

  it('maps a fetch TypeError to network, naming the CSP only for a custom host', async () => {
    const fail = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    const plain = await probeConnection(OR, fail)
    expect(plain).toMatchObject({ ok: false, kind: 'network' })
    expect(plain.ok || plain.message).not.toMatch(/custom base URL/)

    const custom = await probeConnection({ ...OR, openRouterBaseUrl: 'https://proxy.example' }, fail)
    expect(custom.ok || custom.message).toMatch(/custom base URL is blocked/)
  })
})

describe('probeConnection — Ollama', () => {
  const tags = { models: [{ name: 'llama3:latest' }, { name: 'qwen3:8b' }] }

  it('GETs {url}/api/tags and counts models', async () => {
    const f = json(tags)
    const r = await probeConnection(OLLAMA, f)
    expect(r).toEqual({ ok: true, detail: '2 models available' })
    expect(f.mock.calls[0][0]).toBe('http://localhost:11434/api/tags')
  })

  it('accepts a model pulled under :latest', async () => {
    const r = await probeConnection({ ...OLLAMA, model: 'llama3' }, json(tags))
    expect(r).toEqual({ ok: true, detail: '2 models available' })
  })

  it('passes but warns when the model is not pulled', async () => {
    const r = await probeConnection({ ...OLLAMA, model: 'mistral' }, json(tags))
    expect(r).toEqual({
      ok: true,
      detail: "Connected, but model 'mistral' is not pulled. Run `ollama pull mistral`.",
    })
  })

  it('names all three causes on a network failure', async () => {
    const fail = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    const r = await probeConnection(OLLAMA, fail)
    expect(r).toMatchObject({ ok: false, kind: 'network' })
    const msg = r.ok ? '' : r.message
    expect(msg).toMatch(/not running/)
    expect(msg).toMatch(/OLLAMA_ORIGINS/)
    expect(msg).toMatch(/apps on your computer/)
  })
})

describe('probeConnection — timeout and abort', () => {
  it('times out after 8 s', async () => {
    vi.useFakeTimers()
    const pending = probeConnection(OR, hanging())
    await vi.advanceTimersByTimeAsync(PROBE_TIMEOUT_MS)
    expect(await pending).toMatchObject({ ok: false, kind: 'timeout' })
  })

  it('rejects with AbortError when the caller aborts', async () => {
    const caller = new AbortController()
    const pending = probeConnection({ ...OR, signal: caller.signal }, hanging())
    caller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  })
})
