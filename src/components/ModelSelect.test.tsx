import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ModelSelect } from './ModelSelect'
import { useCatalogStore } from '../store/catalogStore'
import { BUNDLED_CATALOG } from '../lib/bundledCatalog'
import type { CatalogModel } from '../lib/openRouterCatalog'

const CATALOG: CatalogModel[] = [
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o-mini', inputPerM: 0.15, outputPerM: 0.6, tier: 'cheap' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet', inputPerM: 3, outputPerM: 15, tier: 'frontier' },
]

beforeEach(() => {
  useCatalogStore.setState({ models: CATALOG })
})

afterEach(() => {
  useCatalogStore.setState({ models: BUNDLED_CATALOG })
})

describe('ModelSelect', () => {
  it('renders a priced datalist of catalog models for openrouter', () => {
    const { container } = render(
      <ModelSelect provider="openrouter" value="" onChange={() => {}} id="ms" ariaLabel="Model" />,
    )

    expect(screen.getByLabelText('Model')).toHaveAttribute('list', 'ms-catalog')
    const options = [...container.querySelectorAll('datalist#ms-catalog option')]
    expect(options.map((o) => o.getAttribute('value'))).toEqual([
      'openai/gpt-4o-mini',
      'anthropic/claude-3.5-sonnet',
    ])
    expect(options[0].textContent).toBe('GPT-4o-mini · $0.15/$0.6 per 1M')
  })

  it('fires onChange with a picked catalog id', () => {
    const onChange = vi.fn()
    render(<ModelSelect provider="openrouter" value="" onChange={onChange} ariaLabel="Model" />)

    fireEvent.change(screen.getByLabelText('Model'), {
      target: { value: 'anthropic/claude-3.5-sonnet' },
    })
    expect(onChange).toHaveBeenCalledWith('anthropic/claude-3.5-sonnet')
  })

  it('round-trips a free-typed custom id', () => {
    const onChange = vi.fn()
    render(<ModelSelect provider="openrouter" value="" onChange={onChange} ariaLabel="Model" />)

    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'my/custom-model' } })
    expect(onChange).toHaveBeenCalledWith('my/custom-model')
  })

  it('renders a plain input with no datalist for ollama', () => {
    const { container } = render(
      <ModelSelect provider="ollama" value="llama3.1" onChange={() => {}} ariaLabel="Model" />,
    )

    expect(screen.getByLabelText('Model')).not.toHaveAttribute('list')
    expect(container.querySelector('datalist')).toBeNull()
  })

  it('passes the current value to onBlur', () => {
    const onBlur = vi.fn()
    render(
      <ModelSelect provider="ollama" value="llama3.1" onChange={() => {}} onBlur={onBlur} ariaLabel="Model" />,
    )

    fireEvent.blur(screen.getByLabelText('Model'), { target: { value: 'llama3.1' } })
    expect(onBlur).toHaveBeenCalledWith('llama3.1')
  })
})
