import { describe, it, expect, afterEach, vi } from 'vitest'
import { streamLLMResponse } from './streamingClient'
import type { ContextResolutionResult, AppSettings } from '../types'

// Helper to create a fake Response from an array of Uint8Array chunks
function createFakeResponse(chunks: Uint8Array[]) {
  let chunkIndex = 0

  return {
    ok: true,
    status: 200,
    text: async () => '',
    body: {
      getReader() {
        return {
          async read() {
            if (chunkIndex < chunks.length) {
              return {
                done: false,
                value: chunks[chunkIndex++],
              }
            }
            return {
              done: true,
              value: undefined,
            }
          },
        }
      },
    },
  }
}

describe('streamingClient', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  const testSettings: AppSettings = {
    id: 'global_settings',
    geminiApiKey: 'test-key',
    ollamaBaseUrl: 'http://localhost:11434',
    defaultModel: 'gemini-2.5-flash',
  }

  const testPayload: ContextResolutionResult = {
    systemPrompt: 'sys',
    messages: [{ role: 'user', content: 'hi' }],
  }

  it('reassembles a frame split across two reads', async () => {
    const frameString = 'data: {"candidates":[{"content":{"parts":[{"text":"Hello world"}]}}]}\n\n'
    const frameBytes = new TextEncoder().encode(frameString)

    // Split at byte 15, which is roughly mid-JSON
    const chunk1 = frameBytes.slice(0, 15)
    const chunk2 = frameBytes.slice(15)

    const fakeResponse = createFakeResponse([chunk1, chunk2])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse))

    const tokens: string[] = []
    const errors: Error[] = []
    let doneCount = 0

    const onToken = (chunk: string) => {
      tokens.push(chunk)
    }

    const done = new Promise<void>((resolve, reject) => {
      streamLLMResponse(
        testPayload,
        testSettings,
        onToken,
        () => {
          doneCount++
          resolve()
        },
        (err) => {
          errors.push(err)
          reject(err)
        },
      )
    })

    await done

    expect(tokens.join('')).toBe('Hello world')
    expect(errors).toHaveLength(0)
    expect(doneCount).toBe(1)
  })

  it('preserves a multi-byte character split across two reads', async () => {
    const frameString = 'data: {"candidates":[{"content":{"parts":[{"text":"party 🎉 done"}]}}]}\n\n'
    const frameBytes = new TextEncoder().encode(frameString)

    // Find the emoji in the string and split in the middle of its UTF-8 bytes
    const emojiIndex = frameString.indexOf('🎉')
    let byteOffset = 0

    for (let i = 0; i < frameString.length; i++) {
      if (i === emojiIndex) break
      byteOffset += new TextEncoder().encode(frameString[i]).length
    }

    // The 🎉 emoji is 4 bytes in UTF-8, split it at byte 2
    const splitPoint = byteOffset + 2

    const chunk1 = frameBytes.slice(0, splitPoint)
    const chunk2 = frameBytes.slice(splitPoint)

    const fakeResponse = createFakeResponse([chunk1, chunk2])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse))

    const tokens: string[] = []
    const errors: Error[] = []
    let doneCount = 0

    const onToken = (chunk: string) => {
      tokens.push(chunk)
    }

    const onError = (err: Error) => {
      errors.push(err)
    }

    const done = new Promise<void>((resolve) => {
      streamLLMResponse(
        testPayload,
        testSettings,
        onToken,
        () => {
          doneCount++
          resolve()
        },
        onError,
      )
    })

    await done

    expect(tokens.join('')).toBe('party 🎉 done')
    expect(errors).toHaveLength(0)
    expect(doneCount).toBe(1)
  })

  it('emits a final frame that has no trailing newline', async () => {
    const frameString = 'data: {"candidates":[{"content":{"parts":[{"text":"tail"}]}}]}'
    const frameBytes = new TextEncoder().encode(frameString)

    const fakeResponse = createFakeResponse([frameBytes])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse))

    const tokens: string[] = []
    const errors: Error[] = []
    let doneCount = 0

    const onToken = (chunk: string) => {
      tokens.push(chunk)
    }

    const onError = (err: Error) => {
      errors.push(err)
    }

    const done = new Promise<void>((resolve) => {
      streamLLMResponse(
        testPayload,
        testSettings,
        onToken,
        () => {
          doneCount++
          resolve()
        },
        onError,
      )
    })

    await done

    expect(tokens.join('')).toBe('tail')
    expect(errors).toHaveLength(0)
    expect(doneCount).toBe(1)
  })

  it('reports a malformed data frame through onError without aborting', async () => {
    const line1 = 'data: {"candidates":[{"content":{"parts":[{"text":"good"}]}}]}'
    const line2 = 'data: {oops not json'
    const frameString = `${line1}\n${line2}\n`
    const frameBytes = new TextEncoder().encode(frameString)

    const fakeResponse = createFakeResponse([frameBytes])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse))

    const tokens: string[] = []
    const errors: Error[] = []
    let doneCount = 0

    const onToken = (chunk: string) => {
      tokens.push(chunk)
    }

    const onError = (err: Error) => {
      errors.push(err)
    }

    const done = new Promise<void>((resolve) => {
      streamLLMResponse(
        testPayload,
        testSettings,
        onToken,
        () => {
          doneCount++
          resolve()
        },
        onError,
      )
    })

    await done

    expect(tokens.join('')).toContain('good')
    expect(errors.length).toBeGreaterThanOrEqual(1)
    expect(errors[0]).toBeInstanceOf(Error)
    expect(errors[0].message).toContain('Malformed stream payload')
    expect(doneCount).toBe(1)
  })
})
