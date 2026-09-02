import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import { HeaderBar } from './HeaderBar'
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/settingsStore'
import { db } from '../db/ChatDatabase'

const BANNER = /No LLM provider configured/i

beforeEach(async () => {
  await db.delete()
  await db.open()
  // Default settings: Ollama at its default URL, no API keys → "needs provider".
  useSettingsStore.setState({ settings: DEFAULT_SETTINGS, hydrated: true })
})

afterEach(async () => {
  await db.delete()
})

describe('HeaderBar first-run banner', () => {
  it('shows the banner when no provider is configured', () => {
    render(<HeaderBar />)
    expect(screen.getByText(BANNER)).toBeInTheDocument()
  })

  it('clears the banner as soon as a key lands in the settings store — no reload', async () => {
    render(<HeaderBar />)
    expect(screen.getByText(BANNER)).toBeInTheDocument()

    // The Settings modal writes through useSettingsStore; HeaderBar must react to
    // that same store rather than a stale private copy.
    await act(async () => {
      await useSettingsStore.getState().updateSettings({ geminiApiKey: 'g-key' })
    })

    expect(screen.queryByText(BANNER)).not.toBeInTheDocument()
  })
})
