import { describe, it, expect, afterEach, vi } from 'vitest'
import { fetchOpenRouterModels } from './openRouterCatalog'

// Trimmed capture of `GET https://openrouter.ai/api/v1/models` (shape only —
// prices are representative, not authoritative).
const FIXTURE = {
  data: [
    {
      id: 'openai/gpt-4o-mini',
      name: 'OpenAI: GPT-4o-mini',
      context_length: 128000,
      pricing: { prompt: '0.00000015', completion: '0.0000006' },
    },
    {
      id: 'anthropic/claude-3-opus',
      name: 'Anthropic: Claude 3 Opus',
      context_length: 200000,
      pricing: { prompt: '0.000015', completion: '0.000075' },
    },
    {
      id: 'google/gemini-2.5-flash',
      name: 'Google: Gemini 2.5 Flash',
      context_length: 1048576,
      pricing: { prompt: '0.0000003', completion: '0.0000025' },
    },
    {
      id: 'deepseek/deepseek-chat',
      name: 'DeepSeek: DeepSeek V3',
      context_length: 64000,
      pricing: { prompt: '0.00000027', completion: '0.0000011' },
    },
    {
      id: 'meta-llama/llama-3.1-70b-instruct',
      name: 'Meta: Llama 3.1 70B Instruct',
      context_length: 131072,
      pricing: { prompt: '0.0000004', completion: '0.0000004' },
    },
    {
      id: 'openai/gpt-4o',
      name: 'OpenAI: GPT-4o',
      context_length: 128000,
      pricing: { prompt: '0.0000025', completion: '0.00001' },
    },
  ],
}

function stubFetch(payload: unknown, ok = true) {
  const mock = vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => payload }))
  vi.stubGlobal('fetch', mock)
  return mock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchOpenRouterModels', () => {
  it('requests `${baseUrl}/models` and normalizes data[] into CatalogModel', async () => {
    const mock = stubFetch(FIXTURE)

    const models = await fetchOpenRouterModels('https://openrouter.ai/api/v1')

    expect(mock).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/models',
      expect.objectContaining({ headers: expect.any(Object) }),
    )
    expect(models).toHaveLength(6)

    const mini = models.find((m) => m.id === 'openai/gpt-4o-mini')!
    expect(mini.label).toBe('OpenAI: GPT-4o-mini')
    expect(mini.inputPerM).toBeCloseTo(0.15)
    expect(mini.outputPerM).toBeCloseTo(0.6)
    expect(mini.contextWindow).toBe(128000)
  })

  it('sorts ascending by output price', async () => {
    stubFetch(FIXTURE)
    const models = await fetchOpenRouterModels('https://openrouter.ai/api/v1')
    expect(models.map((m) => m.id)).toEqual([
      'meta-llama/llama-3.1-70b-instruct', // 0.4
      'openai/gpt-4o-mini', // 0.6
      'deepseek/deepseek-chat', // 1.1
      'google/gemini-2.5-flash', // 2.5
      'openai/gpt-4o', // 10
      'anthropic/claude-3-opus', // 75
    ])
  })

  it('derives tier from output-price terciles of the fetched set', async () => {
    stubFetch(FIXTURE)
    const models = await fetchOpenRouterModels('https://openrouter.ai/api/v1')
    const tierOf = (id: string) => models.find((m) => m.id === id)!.tier
    // sorted outputs: [0.4, 0.6, 1.1, 2.5, 10, 75] -> p33 = 0.6, p66 = 2.5
    expect(tierOf('meta-llama/llama-3.1-70b-instruct')).toBe('cheap')
    expect(tierOf('openai/gpt-4o-mini')).toBe('cheap')
    expect(tierOf('deepseek/deepseek-chat')).toBe('mid')
    expect(tierOf('google/gemini-2.5-flash')).toBe('mid')
    expect(tierOf('openai/gpt-4o')).toBe('frontier')
    expect(tierOf('anthropic/claude-3-opus')).toBe('frontier')
  })

  it('trims a trailing slash on the base URL', async () => {
    const mock = stubFetch(FIXTURE)
    await fetchOpenRouterModels('https://proxy.example/v1/')
    expect(mock).toHaveBeenCalledWith('https://proxy.example/v1/models', expect.any(Object))
  })

  it('throws on a non-ok response', async () => {
    stubFetch({}, false)
    await expect(fetchOpenRouterModels('https://openrouter.ai/api/v1')).rejects.toThrow(/500/)
  })

  it('tolerates missing name / pricing / context_length', async () => {
    stubFetch({ data: [{ id: 'custom/model' }, 'garbage', null] })
    const models = await fetchOpenRouterModels('https://x')
    expect(models).toHaveLength(1)
    expect(models[0]).toMatchObject({
      id: 'custom/model',
      label: 'custom/model',
      inputPerM: 0,
      outputPerM: 0,
    })
    expect(models[0].contextWindow).toBeUndefined()
  })
})
