import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ProviderBanner } from './ProviderBanner'
import { useSettingsStore, DEFAULT_SETTINGS } from '../store/settingsStore'
import { useTreeStore } from '../store/useTreeStore'
import { DEMO_TREE_ID } from '../lib/demoTree'

const noop = () => {}

beforeEach(() => {
  useSettingsStore.setState({ settings: { ...DEFAULT_SETTINGS }, hydrated: true })
  useTreeStore.setState({ activeTreeId: null })
})

describe('ProviderBanner', () => {
  it('warns on the visitor’s own tree when no provider is configured', () => {
    useTreeStore.setState({ activeTreeId: 'my-tree' })
    render(<ProviderBanner onOpenSettings={noop} />)

    expect(screen.getByText(/No LLM provider configured/i)).toBeInTheDocument()
    expect(screen.queryByTestId('demo-banner')).not.toBeInTheDocument()
  })

  it('explains instead of warning while the demo tree is open', () => {
    useTreeStore.setState({ activeTreeId: DEMO_TREE_ID })
    render(<ProviderBanner onOpenSettings={noop} />)

    expect(screen.getByTestId('demo-banner')).toBeInTheDocument()
    expect(screen.getByText(/no API key needed/i)).toBeInTheDocument()
    expect(screen.queryByText(/No LLM provider configured/i)).not.toBeInTheDocument()
  })

  it('renders nothing once a provider is configured, demo or not', () => {
    useSettingsStore.setState({
      settings: { ...DEFAULT_SETTINGS, openRouterApiKey: 'or-key' },
      hydrated: true,
    })

    useTreeStore.setState({ activeTreeId: DEMO_TREE_ID })
    const { container, unmount } = render(<ProviderBanner onOpenSettings={noop} />)
    expect(container).toBeEmptyDOMElement()
    unmount()

    useTreeStore.setState({ activeTreeId: 'my-tree' })
    const own = render(<ProviderBanner onOpenSettings={noop} />)
    expect(own.container).toBeEmptyDOMElement()
  })
})
