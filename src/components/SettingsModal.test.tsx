import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsModal } from './SettingsModal'
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/settingsStore'
import { useCatalogStore } from '../store/catalogStore'
import { db } from '../db/ChatDatabase'

beforeEach(async () => {
  await db.delete()
  await db.open()
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, hydrated: true })
})

afterEach(async () => {
  await db.delete()
  vi.restoreAllMocks()
})

describe('SettingsModal — provider-linked credential field', () => {
  it('swaps the visible credential control and preserves the hidden slot in draft', () => {
    render(<SettingsModal open onClose={() => {}} />)

    // Default provider is openrouter → key field visible, Ollama URL absent.
    const key = screen.getByLabelText('OpenRouter API key')
    expect(key).toBeInTheDocument()
    expect(screen.queryByLabelText('Ollama URL')).not.toBeInTheDocument()

    fireEvent.change(key, { target: { value: 'or-typed' } })

    // Flip to Ollama → URL field visible, key field gone.
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'ollama' } })
    const url = screen.getByLabelText('Ollama URL')
    expect(url).toBeInTheDocument()
    expect(screen.queryByLabelText('OpenRouter API key')).not.toBeInTheDocument()

    fireEvent.change(url, { target: { value: 'http://box:1234' } })

    // Flip back → the OpenRouter key typed earlier is still in the draft.
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'openrouter' } })
    expect(screen.getByLabelText('OpenRouter API key')).toHaveValue('or-typed')
  })

  it('Save persists every slot to the store and the DB', async () => {
    const onClose = vi.fn()
    render(<SettingsModal open onClose={onClose} />)

    fireEvent.change(screen.getByLabelText('OpenRouter API key'), { target: { value: 'or-key' } })
    fireEvent.change(screen.getByLabelText('OpenRouter base URL'), {
      target: { value: 'https://proxy.example/v1' },
    })
    fireEvent.change(screen.getByLabelText('Default model'), {
      target: { value: 'anthropic/claude-3.5-sonnet' },
    })

    // Touch the Ollama slot too, then switch back before saving.
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'ollama' } })
    fireEvent.change(screen.getByLabelText('Ollama URL'), { target: { value: 'http://box:1234' } })
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'openrouter' } })

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() =>
      expect(useSettingsStore.getState().settings).toMatchObject({
        provider: 'openrouter',
        openRouterApiKey: 'or-key',
        openRouterBaseUrl: 'https://proxy.example/v1',
        ollamaBaseUrl: 'http://box:1234',
        defaultModel: 'anthropic/claude-3.5-sonnet',
      }),
    )

    const row = await db.settings.get('global_settings')
    expect(row).toMatchObject({
      provider: 'openrouter',
      openRouterApiKey: 'or-key',
      openRouterBaseUrl: 'https://proxy.example/v1',
      ollamaBaseUrl: 'http://box:1234',
      defaultModel: 'anthropic/claude-3.5-sonnet',
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('"Refresh prices" forces a catalog reload and shows a freshness line', () => {
    const spy = vi
      .spyOn(useCatalogStore.getState(), 'loadCatalog')
      .mockResolvedValue(undefined)

    render(<SettingsModal open onClose={() => {}} />)

    expect(screen.getByText(/bundled · updated never/)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Refresh prices' }))
    expect(spy).toHaveBeenCalledWith(true)
  })
})
