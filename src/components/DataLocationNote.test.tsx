import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DataLocationNote } from './DataLocationNote'
import { isPersisted, readEstimate } from '../lib/storageHealth'

vi.mock('../lib/storageHealth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/storageHealth')>()),
  isPersisted: vi.fn(),
  readEstimate: vi.fn(),
}))

const MB = 1024 * 1024

beforeEach(() => {
  vi.mocked(isPersisted).mockReset()
  vi.mocked(readEstimate).mockReset()
})

describe('DataLocationNote', () => {
  it('renders where data lives, usage, and the granted line', async () => {
    vi.mocked(readEstimate).mockResolvedValue({ usageBytes: 4.2 * MB, quotaBytes: 2.1 * 1024 * MB })
    vi.mocked(isPersisted).mockResolvedValue(true)
    render(<DataLocationNote />)

    expect(screen.getByText(/stored in this browser only/)).toBeInTheDocument()
    expect(await screen.findByText('Using 4.2 MB of 2.1 GB.')).toBeInTheDocument()
    expect(await screen.findByText(/Browser agreed to keep this data/)).toBeInTheDocument()
    expect(screen.queryByText(/protected/)).not.toBeInTheDocument()
  })

  it('hides the estimate when null and warns when not persisted', async () => {
    vi.mocked(readEstimate).mockResolvedValue(null)
    vi.mocked(isPersisted).mockResolvedValue(false)
    render(<DataLocationNote />)

    expect(await screen.findByText(/Not protected — export regularly/)).toBeInTheDocument()
    expect(screen.queryByText(/^Using /)).not.toBeInTheDocument()
  })
})
