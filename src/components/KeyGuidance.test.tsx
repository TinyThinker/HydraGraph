import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SettingsModal } from './SettingsModal'
import { ProviderBanner } from './ProviderBanner'
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/settingsStore'
import { useTreeStore } from '../store/useTreeStore'
import { db } from '../db/ChatDatabase'

const withKey = { ...DEFAULT_SETTINGS, openRouterApiKey: 'or-key' }

beforeEach(async () => {
  await db.delete()
  await db.open()
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS }, hydrated: true })
  useTreeStore.setState({ activeTreeId: 'my-tree' })
})

afterEach(async () => {
  await db.delete()
  vi.restoreAllMocks()
})

describe('KeyGuidance — what to do before pasting a key', () => {
  it('shows all three pieces of copy for openrouter, and none of it for ollama', () => {
    render(<SettingsModal open onClose={() => {}} />)

    expect(screen.getByText(/OpenRouter shows this key only once/i)).toBeInTheDocument()
    expect(screen.getByText(/dedicated key with a spend limit/i)).toBeInTheDocument()
    expect(screen.getByText(/early build shared for testing/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /OpenRouter key settings/i })).toHaveAttribute(
      'href',
      'https://openrouter.ai/settings/keys',
    )

    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'ollama' } })
    expect(screen.queryByTestId('key-guidance')).not.toBeInTheDocument()
  })

  it('sits directly under the key input, ahead of Advanced and Refresh prices', () => {
    render(<SettingsModal open onClose={() => {}} />)

    const guidance = screen.getByTestId('key-guidance')
    const after = (el: Element) =>
      Boolean(guidance.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)

    expect(after(screen.getByLabelText('OpenRouter API key'))).toBe(false)
    expect(after(screen.getByText('Advanced'))).toBe(true)
    expect(after(screen.getByRole('button', { name: 'Refresh prices' }))).toBe(true)
  })
})

describe('KeyGuidance — destination host', () => {
  it('names openrouter.ai plainly on the default base URL', () => {
    render(<SettingsModal open onClose={() => {}} />)

    expect(screen.getByTestId('key-destination')).toHaveTextContent('Key is sent to openrouter.ai')
    expect(screen.queryByText(/Non-default destination/i)).not.toBeInTheDocument()
  })

  it('warns once the base URL points somewhere else', () => {
    render(<SettingsModal open onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('OpenRouter base URL'), {
      target: { value: 'https://proxy.example/v1' },
    })

    const line = screen.getByTestId('key-destination')
    expect(line).toHaveTextContent(/Non-default destination/i)
    expect(line).toHaveTextContent('proxy.example')
  })

  it('treats an unparseable base URL as non-default rather than silently defaulting', () => {
    render(<SettingsModal open onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('OpenRouter base URL'), {
      target: { value: 'not a url' },
    })

    const line = screen.getByTestId('key-destination')
    expect(line).toHaveTextContent(/Non-default destination/i)
    expect(line).toHaveTextContent('not a url')
  })
})

describe('KeyGuidance — Forget key', () => {
  it('is hidden until a key is actually stored', () => {
    render(<SettingsModal open onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Forget key' })).not.toBeInTheDocument()
  })

  it('does not offer to forget a key that has only been typed, not saved', () => {
    render(<SettingsModal open onClose={() => {}} />)

    fireEvent.change(screen.getByLabelText('OpenRouter API key'), { target: { value: 'typed' } })
    expect(screen.queryByRole('button', { name: 'Forget key' })).not.toBeInTheDocument()
  })

  it('clears the key from the store, the DB and the field', async () => {
    await db.settings.put(withKey)
    useSettingsStore.setState({ settings: withKey, hydrated: true })

    render(<SettingsModal open onClose={() => {}} />)
    expect(screen.getByLabelText('OpenRouter API key')).toHaveValue('or-key')

    fireEvent.click(screen.getByRole('button', { name: 'Forget key' }))

    await waitFor(() =>
      expect(useSettingsStore.getState().settings.openRouterApiKey).toBeUndefined(),
    )
    expect(screen.getByLabelText('OpenRouter API key')).toHaveValue('')
    expect(screen.queryByRole('button', { name: 'Forget key' })).not.toBeInTheDocument()

    const row = await db.settings.get('global_settings')
    expect(row?.openRouterApiKey).toBeUndefined()
    expect(row).toMatchObject({ provider: 'openrouter', defaultModel: DEFAULT_SETTINGS.defaultModel })
  })

  it('brings the provider banner back with no extra wiring', async () => {
    await db.settings.put(withKey)
    useSettingsStore.setState({ settings: withKey, hydrated: true })

    render(
      <>
        <ProviderBanner onOpenSettings={() => {}} />
        <SettingsModal open onClose={() => {}} />
      </>,
    )
    expect(screen.queryByTestId('provider-banner')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Forget key' }))

    await waitFor(() => expect(screen.getByTestId('provider-banner')).toBeInTheDocument())
  })
})
