import { create } from 'zustand'
import { db } from '../db/ChatDatabase'
import type { AppSettings, LLMProvider, ProviderModelMap } from '../types'

// Single source of truth for provider configuration and the last-opened tree.
// Persisted to the Dexie `settings` table under the fixed `global_settings`
// key. This is the only in-memory copy of the settings row — useTreeStore no
// longer keeps its own.
export const DEFAULT_SETTINGS: AppSettings = {
  id: 'global_settings',
  provider: 'openrouter',
  ollamaBaseUrl: 'http://localhost:11434',
  openRouterBaseUrl: 'https://openrouter.ai/api/v1',
  defaultModel: 'openai/gpt-4o-mini',
  defaultModels: {
    openrouter: 'openai/gpt-4o-mini',
    ollama: 'llama3',
  },
}

interface SettingsStoreState {
  settings: AppSettings
  hydrated: boolean
}

interface SettingsStoreActions {
  // Read the persisted row into memory, seeding defaults on first run.
  loadSettings: () => Promise<void>
  // Generic immutable merge-and-persist.
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  setActiveProvider: (provider: LLMProvider) => Promise<void>
  // Remember the last-opened tree so a reload reopens it.
  setActiveTreeId: (treeId: string) => Promise<void>
  // Empty string clears the key (stored as undefined).
  setApiKey: (provider: 'openrouter', key: string) => Promise<void>
  setBaseUrl: (provider: 'ollama' | 'openrouter', url: string) => Promise<void>
  // Omit `provider` to set the global fallback model; pass one to set that
  // provider's default without touching the others.
  setDefaultModel: (model: string, provider?: LLMProvider) => Promise<void>
  resetSettings: () => Promise<void>
}

export type SettingsStore = SettingsStoreState & SettingsStoreActions

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  hydrated: false,

  loadSettings: async () => {
    const saved = await db.settings.get('global_settings')
    if (saved) {
      // Backfill any fields added since the row was written.
      set({ settings: { ...DEFAULT_SETTINGS, ...saved, id: 'global_settings' }, hydrated: true })
    } else {
      const defaults: AppSettings = { ...DEFAULT_SETTINGS }
      await db.settings.put(defaults)
      set({ settings: defaults, hydrated: true })
    }
  },

  updateSettings: async (patch) => {
    const merged: AppSettings = { ...get().settings, ...patch, id: 'global_settings' }
    await db.settings.put(merged)
    set({ settings: merged })
  },

  setActiveProvider: async (provider) => {
    await get().updateSettings({ provider })
  },

  setActiveTreeId: async (treeId) => {
    await get().updateSettings({ activeTreeId: treeId })
  },

  setApiKey: async (_provider, key) => {
    const value = key.trim() || undefined
    await get().updateSettings({ openRouterApiKey: value })
  },

  setBaseUrl: async (provider, url) => {
    const value = url.trim()
    if (provider === 'ollama') {
      await get().updateSettings({ ollamaBaseUrl: value })
    } else {
      await get().updateSettings({ openRouterBaseUrl: value })
    }
  },

  setDefaultModel: async (model, provider) => {
    const value = model.trim()
    if (!provider) {
      await get().updateSettings({ defaultModel: value })
      return
    }
    const nextModels: ProviderModelMap = { ...get().settings.defaultModels, [provider]: value }
    await get().updateSettings({ defaultModels: nextModels })
  },

  resetSettings: async () => {
    const defaults: AppSettings = { ...DEFAULT_SETTINGS }
    await db.settings.put(defaults)
    set({ settings: defaults })
  },
}))
