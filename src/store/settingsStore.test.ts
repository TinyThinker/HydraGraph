import { describe, it, expect, beforeEach } from 'vitest'
import { useSettingsStore, DEFAULT_SETTINGS } from './settingsStore'
import { db } from '../db/ChatDatabase'

async function resetStore() {
  await db.delete()
  await db.open()
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, hydrated: false })
}

const state = () => useSettingsStore.getState()

describe('settingsStore', () => {
  beforeEach(resetStore)

  describe('loadSettings', () => {
    it('seeds defaults and persists them on first run', async () => {
      await state().loadSettings()

      expect(state().hydrated).toBe(true)
      expect(state().settings).toEqual(DEFAULT_SETTINGS)

      const row = await db.settings.get('global_settings')
      expect(row).toEqual(DEFAULT_SETTINGS)
    })

    it('reads an existing row and backfills fields added later', async () => {
      // A legacy row missing openRouterBaseUrl / defaultModels.
      await db.settings.put({
        id: 'global_settings',
        provider: 'ollama',
        ollamaBaseUrl: 'http://box:11434',
        defaultModel: 'mistral',
      })

      await state().loadSettings()

      expect(state().settings.provider).toBe('ollama')
      expect(state().settings.ollamaBaseUrl).toBe('http://box:11434')
      expect(state().settings.defaultModel).toBe('mistral')
      // Backfilled from DEFAULT_SETTINGS.
      expect(state().settings.openRouterBaseUrl).toBe(DEFAULT_SETTINGS.openRouterBaseUrl)
      expect(state().settings.defaultModels).toEqual(DEFAULT_SETTINGS.defaultModels)
    })
  })

  describe('updateSettings', () => {
    beforeEach(async () => {
      await state().loadSettings()
    })

    it('merges the patch, persists it, and replaces the object reference', async () => {
      const before = state().settings

      await state().updateSettings({ openRouterApiKey: 'or-key', defaultModel: 'google/gemini-2.5-pro' })

      const after = state().settings
      expect(after).not.toBe(before)
      expect(before.openRouterApiKey).toBeUndefined() // previous object untouched
      expect(after.openRouterApiKey).toBe('or-key')
      expect(after.defaultModel).toBe('google/gemini-2.5-pro')
      expect(after.ollamaBaseUrl).toBe(DEFAULT_SETTINGS.ollamaBaseUrl) // untouched field preserved

      const row = await db.settings.get('global_settings')
      expect(row?.openRouterApiKey).toBe('or-key')
      expect(row?.defaultModel).toBe('google/gemini-2.5-pro')
    })

    it('always keeps the fixed primary key', async () => {
      await state().updateSettings({ provider: 'openrouter' })
      expect(state().settings.id).toBe('global_settings')
      const rows = await db.settings.toArray()
      expect(rows).toHaveLength(1)
    })
  })

  describe('targeted setters', () => {
    beforeEach(async () => {
      await state().loadSettings()
    })

    it('setActiveProvider switches provider in memory and DB', async () => {
      await state().setActiveProvider('ollama')
      expect(state().settings.provider).toBe('ollama')
      expect((await db.settings.get('global_settings'))?.provider).toBe('ollama')
    })

    it('setApiKey stores the OpenRouter key, trims it, and clears on empty string', async () => {
      await state().setApiKey('openrouter', '  or-key  ')
      expect(state().settings.openRouterApiKey).toBe('or-key')
      expect((await db.settings.get('global_settings'))?.openRouterApiKey).toBe('or-key')

      await state().setApiKey('openrouter', '   ')
      expect(state().settings.openRouterApiKey).toBeUndefined()
      expect((await db.settings.get('global_settings'))?.openRouterApiKey).toBeUndefined()
    })

    it('setBaseUrl writes the matching provider URL field', async () => {
      await state().setBaseUrl('ollama', 'http://gpu:11434 ')
      await state().setBaseUrl('openrouter', ' https://proxy.example/v1')
      expect(state().settings.ollamaBaseUrl).toBe('http://gpu:11434')
      expect(state().settings.openRouterBaseUrl).toBe('https://proxy.example/v1')

      const row = await db.settings.get('global_settings')
      expect(row?.ollamaBaseUrl).toBe('http://gpu:11434')
      expect(row?.openRouterBaseUrl).toBe('https://proxy.example/v1')
    })

    it('setDefaultModel without a provider sets the global fallback', async () => {
      await state().setDefaultModel(' custom-model ')
      expect(state().settings.defaultModel).toBe('custom-model')
    })

    it('setDefaultModel with a provider updates only that entry', async () => {
      await state().setDefaultModel('openai/gpt-4o', 'openrouter')

      expect(state().settings.defaultModels?.openrouter).toBe('openai/gpt-4o')
      // Other providers' defaults are preserved.
      expect(state().settings.defaultModels?.ollama).toBe(DEFAULT_SETTINGS.defaultModels?.ollama)
      // Global fallback is untouched.
      expect(state().settings.defaultModel).toBe(DEFAULT_SETTINGS.defaultModel)

      expect((await db.settings.get('global_settings'))?.defaultModels?.openrouter).toBe('openai/gpt-4o')
    })

    it('setActiveTreeId remembers the last-opened tree in memory and DB', async () => {
      await state().setActiveTreeId('tree-abc')
      expect(state().settings.activeTreeId).toBe('tree-abc')
      expect((await db.settings.get('global_settings'))?.activeTreeId).toBe('tree-abc')

      await state().setActiveTreeId('tree-xyz')
      expect(state().settings.activeTreeId).toBe('tree-xyz')
    })

    it('resetSettings restores defaults in memory and DB', async () => {
      await state().updateSettings({ openRouterApiKey: 'x', provider: 'ollama', defaultModel: 'y' })
      await state().resetSettings()

      expect(state().settings).toEqual(DEFAULT_SETTINGS)
      expect(await db.settings.get('global_settings')).toEqual(DEFAULT_SETTINGS)
    })
  })

  describe('persistence across a reload', () => {
    it('restores previously saved values from IndexedDB', async () => {
      await state().loadSettings()
      await state().setActiveProvider('openrouter')
      await state().setApiKey('openrouter', 'or-secret')
      await state().setBaseUrl('ollama', 'http://persisted:11434')
      await state().setDefaultModel('llama3.1', 'ollama')

      // Simulate a fresh page load: wipe in-memory state, keep IndexedDB.
      useSettingsStore.setState({ settings: DEFAULT_SETTINGS, hydrated: false })
      expect(state().settings.openRouterApiKey).toBeUndefined()

      await state().loadSettings()

      expect(state().hydrated).toBe(true)
      expect(state().settings.provider).toBe('openrouter')
      expect(state().settings.openRouterApiKey).toBe('or-secret')
      expect(state().settings.ollamaBaseUrl).toBe('http://persisted:11434')
      expect(state().settings.defaultModels?.ollama).toBe('llama3.1')
    })
  })
})
