import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Dexie from 'dexie'
import { StorageBanner } from './StorageBanner'
import { useStorageStatusStore, reportWriteFailure } from '../store/storageStatusStore'

beforeEach(() => {
  useStorageStatusStore.setState({ writeFailure: null })
})

describe('StorageBanner', () => {
  it('renders nothing when there is no write failure', () => {
    const { container } = render(<StorageBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders the quota advice in plain words', () => {
    reportWriteFailure(new Dexie.QuotaExceededError('raw'))
    render(<StorageBanner />)

    expect(screen.getByText(/Browser storage is full\. New work is not being saved\./)).toBeInTheDocument()
    expect(screen.getByText(/Export your trees/)).toBeInTheDocument()
    expect(screen.getByText(/private window/)).toBeInTheDocument()
  })

  it('renders the message for other failures', () => {
    reportWriteFailure(new Error('disk on fire'))
    render(<StorageBanner />)

    expect(screen.getByText(/disk on fire/)).toBeInTheDocument()
    expect(screen.queryByText(/Export your trees/)).not.toBeInTheDocument()
  })

  it('dismiss clears the failure and hides the banner', () => {
    reportWriteFailure(new Dexie.QuotaExceededError('raw'))
    render(<StorageBanner />)

    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))

    expect(useStorageStatusStore.getState().writeFailure).toBeNull()
    expect(screen.queryByTestId('storage-banner')).not.toBeInTheDocument()
  })
})
