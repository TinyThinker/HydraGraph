import { describe, it, expect, vi } from 'vitest'
import { act, render, renderHook, screen, fireEvent } from '@testing-library/react'
import { ConnectionTest } from './ConnectionTest'
import { useConnectionTest, type ConnectionDraft } from './useConnectionTest'
import type { ProbeInput, ProbeResult } from '../lib/connectionProbe'

const DRAFT: ConnectionDraft = {
  provider: 'openrouter',
  openRouterApiKey: 'sk-or-1',
  openRouterBaseUrl: '',
  ollamaBaseUrl: 'http://localhost:11434',
  defaultModel: 'llama3',
}

/** A probe whose answer the test releases by hand; records the abort signal. */
function deferredProbe() {
  let resolve!: (r: ProbeResult) => void
  let input!: ProbeInput
  const probe = vi.fn((i: ProbeInput) => {
    input = i
    return new Promise<ProbeResult>((res, rej) => {
      resolve = res
      i.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')))
    })
  })
  return { probe, resolve: (r: ProbeResult) => resolve(r), input: () => input }
}

describe('useConnectionTest', () => {
  it('goes idle → testing → ok', async () => {
    const d = deferredProbe()
    const { result } = renderHook(() => useConnectionTest(DRAFT, d.probe))
    expect(result.current.state).toBe('idle')

    act(() => void result.current.run())
    expect(result.current.state).toBe('testing')

    await act(async () => d.resolve({ ok: true, detail: 'Key accepted.' }))
    expect(result.current.state).toBe('ok')
    expect(result.current.result).toEqual({ ok: true, detail: 'Key accepted.' })
  })

  it('goes to fail with the probe result', async () => {
    const probe = vi.fn().mockResolvedValue({ ok: false, kind: 'auth', message: 'nope' })
    const { result } = renderHook(() => useConnectionTest(DRAFT, probe))
    await act(() => result.current.run())
    expect(result.current.state).toBe('fail')
  })

  it('passes the model only for Ollama', async () => {
    const probe = vi.fn().mockResolvedValue({ ok: true })
    const { result, rerender } = renderHook((draft) => useConnectionTest(draft, probe), {
      initialProps: DRAFT,
    })
    await act(() => result.current.run())
    expect(probe.mock.calls[0][0].model).toBeUndefined()

    rerender({ ...DRAFT, provider: 'ollama' })
    await act(() => result.current.run())
    expect(probe.mock.calls[1][0].model).toBe('llama3')
  })

  it('resets to idle and aborts when an input changes', async () => {
    const d = deferredProbe()
    const { result, rerender } = renderHook((draft) => useConnectionTest(draft, d.probe), {
      initialProps: DRAFT,
    })
    act(() => void result.current.run())
    rerender({ ...DRAFT, openRouterApiKey: 'sk-or-2' })
    expect(result.current.state).toBe('idle')
    expect(d.input().signal?.aborted).toBe(true)
  })

  it('a finished result reads idle once the inputs change', async () => {
    const probe = vi.fn().mockResolvedValue({ ok: true })
    const { result, rerender } = renderHook((draft) => useConnectionTest(draft, probe), {
      initialProps: DRAFT,
    })
    await act(() => result.current.run())
    expect(result.current.state).toBe('ok')
    rerender({ ...DRAFT, openRouterBaseUrl: 'https://proxy.example' })
    expect(result.current.state).toBe('idle')
  })

  it('aborts on reset() and on unmount', () => {
    const d = deferredProbe()
    const { result, unmount } = renderHook(() => useConnectionTest(DRAFT, d.probe))

    act(() => void result.current.run())
    act(() => result.current.reset())
    expect(result.current.state).toBe('idle')
    expect(d.input().signal?.aborted).toBe(true)

    act(() => void result.current.run())
    unmount()
    expect(d.input().signal?.aborted).toBe(true)
  })
})

describe('ConnectionTest', () => {
  it('idle: shows the button and calls onRun', () => {
    const onRun = vi.fn()
    render(<ConnectionTest state="idle" result={null} onRun={onRun} />)
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }))
    expect(onRun).toHaveBeenCalled()
  })

  it('testing: disabled spinner text', () => {
    render(<ConnectionTest state="testing" result={null} onRun={() => {}} />)
    expect(screen.getByRole('button', { name: 'Testing…' })).toBeDisabled()
  })

  it('ok: green line with the detail', () => {
    render(<ConnectionTest state="ok" result={{ ok: true, detail: '2 models available' }} onRun={() => {}} />)
    expect(screen.getByRole('status')).toHaveTextContent('2 models available')
  })

  it('fail: red line with the message', () => {
    render(
      <ConnectionTest
        state="fail"
        result={{ ok: false, kind: 'auth', message: 'OpenRouter rejected this key.' }}
        onRun={() => {}}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('OpenRouter rejected this key.')
  })
})
