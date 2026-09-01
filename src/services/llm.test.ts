import { describe, it, expect } from 'vitest'
import { resolveDispatchTarget, resolveDispatchForNode } from './llm'
import type { AppSettings } from '../types'

const settings: AppSettings = {
  id: 'global_settings',
  provider: 'gemini',
  ollamaBaseUrl: 'http://localhost:11434',
  openRouterBaseUrl: 'https://openrouter.ai/api/v1',
  defaultModel: 'flat-fallback',
  defaultModels: {
    gemini: 'gemini-default',
    openrouter: 'openrouter-default',
    ollama: 'ollama-default',
  },
}

describe('resolveDispatchTarget', () => {
  it('falls back to the global store when nothing overrides it', () => {
    expect(resolveDispatchTarget(null, null, settings)).toEqual({
      provider: 'gemini',
      model: 'gemini-default',
    })
  })

  it('uses the flat defaultModel when the provider has no per-provider default', () => {
    const bare: AppSettings = { ...settings, defaultModels: undefined }
    expect(resolveDispatchTarget(null, null, bare)).toEqual({
      provider: 'gemini',
      model: 'flat-fallback',
    })
  })

  it('lets the tree default win over the global store', () => {
    expect(
      resolveDispatchTarget(null, { defaultProvider: 'ollama', defaultModel: 'tree-model' }, settings),
    ).toEqual({ provider: 'ollama', model: 'tree-model' })
  })

  it('resolves the model against the tree provider when the tree omits a model', () => {
    expect(resolveDispatchTarget(null, { defaultProvider: 'openrouter' }, settings)).toEqual({
      provider: 'openrouter',
      model: 'openrouter-default',
    })
  })

  it('lets a node override win over both the tree default and the global store', () => {
    expect(
      resolveDispatchTarget(
        { provider: 'openrouter', model: 'node-model' },
        { defaultProvider: 'ollama', defaultModel: 'tree-model' },
        settings,
      ),
    ).toEqual({ provider: 'openrouter', model: 'node-model' })
  })

  it('treats blank / whitespace override strings as absent', () => {
    expect(
      resolveDispatchTarget({ model: '   ' }, { defaultModel: '  ' }, settings),
    ).toEqual({ provider: 'gemini', model: 'gemini-default' })
  })

  it('allows a node to override only the model, keeping the resolved provider', () => {
    expect(
      resolveDispatchTarget({ model: 'just-the-model' }, { defaultProvider: 'ollama' }, settings),
    ).toEqual({ provider: 'ollama', model: 'just-the-model' })
  })
})

describe('resolveDispatchForNode', () => {
  it('reads only modelUsed as the node-level override, never the stamped provider', () => {
    const node = { modelUsed: 'pinned-model' } as Parameters<typeof resolveDispatchForNode>[0]
    expect(resolveDispatchForNode(node, null, settings)).toEqual({
      provider: 'gemini',
      model: 'pinned-model',
    })
  })

  it('falls through to the global store when the node has no modelUsed', () => {
    expect(resolveDispatchForNode({ modelUsed: '' }, null, settings)).toEqual({
      provider: 'gemini',
      model: 'gemini-default',
    })
  })
})
