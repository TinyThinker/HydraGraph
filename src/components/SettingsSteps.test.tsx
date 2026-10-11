import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { SettingsSteps } from './SettingsSteps'
import { SettingsModal } from './SettingsModal'
import { setupSteps } from './useSetupSteps'
import type { ConnectionDraft, ConnectionTestState } from './useConnectionTest'
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/settingsStore'

const OR: ConnectionDraft = {
  provider: 'openrouter',
  openRouterApiKey: '',
  openRouterBaseUrl: '',
  ollamaBaseUrl: 'http://localhost:11434',
  defaultModel: '',
}
const OLLAMA: ConnectionDraft = { ...OR, provider: 'ollama' }

const flags = (draft: ConnectionDraft, state: ConnectionTestState) =>
  setupSteps(draft, state).map((s) => s.done)

describe('setupSteps', () => {
  it.each<[string, ConnectionDraft, ConnectionTestState, boolean[]]>([
    ['OpenRouter, no key', OR, 'idle', [true, false, false]],
    ['OpenRouter, blank key', { ...OR, openRouterApiKey: '   ' }, 'idle', [true, false, false]],
    ['OpenRouter, key, untested', { ...OR, openRouterApiKey: 'sk' }, 'idle', [true, true, false]],
    ['OpenRouter, key, testing', { ...OR, openRouterApiKey: 'sk' }, 'testing', [true, true, false]],
    ['OpenRouter, key, failed', { ...OR, openRouterApiKey: 'sk' }, 'fail', [true, true, false]],
    ['OpenRouter, key, passed', { ...OR, openRouterApiKey: 'sk' }, 'ok', [true, true, true]],
    ['Ollama, prefilled URL', OLLAMA, 'idle', [true, true, false]],
    ['Ollama, empty URL', { ...OLLAMA, ollamaBaseUrl: '' }, 'idle', [true, false, false]],
    ['Ollama, passed', OLLAMA, 'ok', [true, true, true]],
  ])('%s', (_name, draft, state, expected) => {
    expect(flags(draft, state)).toEqual(expected)
  })

  it('names the provider and switches step 2 to URL for Ollama', () => {
    expect(setupSteps(OR, 'idle').map((s) => s.label)).toEqual(['Provider', 'Key', 'Test'])
    expect(setupSteps(OLLAMA, 'idle')[0].note).toBe('Ollama')
    expect(setupSteps(OLLAMA, 'idle')[1].label).toBe('URL')
  })
})

describe('SettingsSteps', () => {
  it('ticks done steps and marks the current one', () => {
    render(<SettingsSteps steps={setupSteps({ ...OR, openRouterApiKey: 'sk' }, 'idle')} current={2} />)
    const items = screen.getAllByRole('listitem')
    expect(items.map((li) => li.dataset.done)).toEqual(['true', 'true', 'false'])
    expect(items[2]).toHaveAttribute('aria-current', 'step')
    expect(within(items[2]).getByText('③')).toBeInTheDocument()
  })
})

describe('SettingsSteps in SettingsModal', () => {
  beforeEach(() => {
    useSettingsStore.setState({ settings: DEFAULT_SETTINGS, hydrated: true })
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('updates live as the user types and tests', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{"data":{}}', { status: 200 }))
    render(<SettingsModal open onClose={() => {}} />)
    const current = () => within(screen.getByLabelText('Setup steps')).getByRole('listitem', { current: 'step' })

    expect(current()).toHaveTextContent('Key')
    fireEvent.change(screen.getByLabelText('OpenRouter API key'), { target: { value: 'sk-or' } })
    expect(current()).toHaveTextContent('Test')

    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }))
    await screen.findByRole('status')
    const items = within(screen.getByLabelText('Setup steps')).getAllByRole('listitem')
    expect(items[2].dataset.done).toBe('true')
  })
})
