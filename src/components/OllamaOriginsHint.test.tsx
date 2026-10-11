import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { OllamaOriginsHint } from './OllamaOriginsHint'
import { SettingsCredentialField } from './SettingsCredentialField'
import { SettingsModal } from './SettingsModal'
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/settingsStore'
import type { LLMProvider } from '../types'

const field = (provider: LLMProvider, ollamaHintOpen = false) => (
  <SettingsCredentialField
    provider={provider}
    openRouterApiKey=""
    openRouterBaseUrl=""
    ollamaBaseUrl="http://localhost:11434"
    onChange={() => {}}
    ollamaHintOpen={ollamaHintOpen}
  />
)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('OllamaOriginsHint', () => {
  it('is hidden for OpenRouter and shown for Ollama', () => {
    const { rerender } = render(field('openrouter'))
    expect(screen.queryByTestId('ollama-origins-hint')).not.toBeInTheDocument()
    rerender(field('ollama'))
    expect(screen.getByTestId('ollama-origins-hint')).toBeInTheDocument()
  })

  it('fills in this page origin from window.location', () => {
    render(<OllamaOriginsHint open={false} />)
    const origin = window.location.origin
    expect(screen.getByText(`OLLAMA_ORIGINS="${origin}" ollama serve`)).toBeInTheDocument()
    expect(screen.getByText(`launchctl setenv OLLAMA_ORIGINS "${origin}"`)).toBeInTheDocument()
  })

  it('is closed by default and opens on `open`', () => {
    const { rerender } = render(field('ollama'))
    expect(screen.getByTestId('ollama-origins-hint')).not.toHaveAttribute('open')
    rerender(field('ollama', true))
    expect(screen.getByTestId('ollama-origins-hint')).toHaveAttribute('open')
  })

  it('names the instant-failure symptom and the Chrome permission prompt', () => {
    render(<OllamaOriginsHint open />)
    expect(screen.getByText(/cause when requests fail instantly/)).toBeInTheDocument()
    expect(screen.getByText(/Chrome asks permission before a website can reach apps/)).toBeInTheDocument()
  })

  it('SettingsModal opens it when an Ollama test fails with a network error', async () => {
    useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS, provider: 'ollama' }, hydrated: true })
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))

    render(<SettingsModal open onClose={() => {}} />)
    expect(screen.getByTestId('ollama-origins-hint')).not.toHaveAttribute('open')

    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }))
    await waitFor(() => expect(screen.getByTestId('ollama-origins-hint')).toHaveAttribute('open'))
  })
})
