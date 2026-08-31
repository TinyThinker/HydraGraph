import type { ContextResolutionResult, AppSettings, TokenUsage } from '../types'

export async function streamLLMResponse(
  payload: ContextResolutionResult,
  settings: AppSettings,
  onToken: (chunk: string) => void,
  onDone: (usage: TokenUsage) => void,
  onError: (err: Error) => void,
): Promise<() => void> {
  const controller = new AbortController()

  if (settings.geminiApiKey) {
    streamGemini(payload, settings, controller, onToken, onDone, onError)
  } else {
    streamOllama(payload, settings, controller, onToken, onDone, onError)
  }

  return () => controller.abort()
}

async function streamGemini(
  payload: ContextResolutionResult,
  settings: AppSettings,
  controller: AbortController,
  onToken: (chunk: string) => void,
  onDone: (usage: TokenUsage) => void,
  onError: (err: Error) => void,
) {
  const model = settings.defaultModel || 'gemini-2.5-flash'
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`

  // Gemini uses 'model' not 'assistant' for role
  const contents = payload.messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': settings.geminiApiKey || '',
      },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: payload.systemPrompt }] },
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const err = await res.text()
      onError(new Error(`Gemini ${res.status}: ${err}`))
      return
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 }
    let buffer = ''

    const processLine = (line: string) => {
      if (!line.startsWith('data:')) return
      const json = line.slice(5).trim()
      if (!json || json === '[DONE]') return

      try {
        const parsed = JSON.parse(json)
        const parts = parsed?.candidates?.[0]?.content?.parts
        if (parts) {
          for (const part of parts) {
            if (part.thought) continue
            if (part.text) onToken(part.text)
          }
        }
        const meta = parsed?.usageMetadata
        if (meta) {
          usage = { inputTokens: meta.promptTokenCount ?? 0, outputTokens: meta.candidatesTokenCount ?? 0 }
        }
      } catch {
        const snippet = line.slice(0, 100)
        onError(new Error(`Malformed stream payload: ${snippet}`))
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      for (let i = 0; i < lines.length - 1; i++) {
        processLine(lines[i])
      }
      buffer = lines[lines.length - 1]
    }

    // Final flush of decoder and remaining buffer
    buffer += decoder.decode()
    if (buffer) {
      processLine(buffer)
    }

    onDone(usage)
  } catch (err) {
    if ((err as Error).name !== 'AbortError') onError(err as Error)
  }
}

async function streamOllama(
  payload: ContextResolutionResult,
  settings: AppSettings,
  controller: AbortController,
  onToken: (chunk: string) => void,
  onDone: (usage: TokenUsage) => void,
  onError: (err: Error) => void,
) {
  const url = `${settings.ollamaBaseUrl}/api/chat`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: settings.defaultModel,
        messages: [
          { role: 'system', content: payload.systemPrompt },
          ...payload.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      onError(new Error(`Ollama ${res.status}: ${await res.text()}`))
      return
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 }
    let buffer = ''

    const processLine = (line: string) => {
      if (!line.trim()) return
      try {
        const parsed = JSON.parse(line)
        if (parsed.message?.content) onToken(parsed.message.content)
        if (parsed.done) {
          usage = { inputTokens: parsed.prompt_eval_count ?? 0, outputTokens: parsed.eval_count ?? 0 }
        }
      } catch {
        const snippet = line.slice(0, 100)
        onError(new Error(`Malformed stream payload: ${snippet}`))
      }
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      for (let i = 0; i < lines.length - 1; i++) {
        processLine(lines[i])
      }
      buffer = lines[lines.length - 1]
    }

    // Final flush of decoder and remaining buffer
    buffer += decoder.decode()
    if (buffer) {
      processLine(buffer)
    }

    onDone(usage)
  } catch (err) {
    if ((err as Error).name !== 'AbortError') onError(err as Error)
  }
}
