import { create } from 'zustand'
import { db } from '../db/ChatDatabase'
import { useSettingsStore } from './settingsStore'
import { fetchOpenRouterModels, type CatalogModel } from '../lib/openRouterCatalog'
import { BUNDLED_CATALOG } from '../lib/bundledCatalog'

// In-session freshness window. A load within this of the last successful fetch
// is skipped unless `force` is passed.
export const TTL_MS = 60 * 60 * 1000

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'

export type CatalogStatus = 'idle' | 'loading' | 'ok' | 'error'
export type CatalogSource = 'live' | 'cache' | 'bundled'

interface CatalogStoreState {
  models: CatalogModel[]
  /** Epoch ms of the last successful live fetch, else `null`. */
  fetchedAt: number | null
  status: CatalogStatus
  source: CatalogSource
}

interface CatalogStoreActions {
  /**
   * Populate `models` from OpenRouter. Skips when a live fetch is still within
   * `TTL_MS` (unless `force`). On failure: last IndexedDB cache, else the
   * bundled snapshot — the catalog is never left empty.
   */
  loadCatalog: (force?: boolean) => Promise<void>
}

export type CatalogStore = CatalogStoreState & CatalogStoreActions

export const useCatalogStore = create<CatalogStore>((set, get) => ({
  models: BUNDLED_CATALOG,
  fetchedAt: null,
  status: 'idle',
  source: 'bundled',

  loadCatalog: async (force = false) => {
    const { fetchedAt } = get()
    if (!force && fetchedAt !== null && Date.now() - fetchedAt < TTL_MS) return

    set({ status: 'loading' })

    const baseUrl = useSettingsStore.getState().settings.openRouterBaseUrl ?? DEFAULT_BASE_URL

    try {
      const models = await fetchOpenRouterModels(baseUrl)
      const nextFetchedAt = Date.now()
      set({ models, fetchedAt: nextFetchedAt, source: 'live', status: 'ok' })
      await db.catalog.put({ key: 'openrouter', models, fetchedAt: nextFetchedAt })
    } catch {
      try {
        const cached = await db.catalog.get('openrouter')
        if (cached && Array.isArray(cached.models) && cached.models.length > 0) {
          set({
            models: cached.models,
            fetchedAt: cached.fetchedAt,
            source: 'cache',
            status: 'error',
          })
          return
        }
      } catch {
        // fall through to the bundled snapshot
      }
      set({ models: BUNDLED_CATALOG, fetchedAt: null, source: 'bundled', status: 'error' })
    }
  },
}))
