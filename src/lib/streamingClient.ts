import type { ContextResolutionResult, AppSettings, TokenUsage, LLMProvider } from '../types'

export async function streamLLMResponse(
  payload: ContextResolutionResult,
  settings: AppSettings,
  target: { provider: LLMProvider; model?: string },
  onToken: (chunk: string) => void,
  onDone: (usage: TokenUsage) => void,
  onError: (err: Error) => void,
): Promise<() => void> {
  const controller = new AbortController()
  const provider = target.provider
  const model = target.model || settings.defaultModel

  if (provider === 'gemini') {
    streamGemini(payload, settings, model, controller, onToken, onDone, onError)
  } else if (provider === 'ollama') {
    streamOllama(payload, settings, model, controller, onToken, onDone, onError)
  } else if (provider === 'openrouter') {
    streamOpenRouter(payload, settings, model, controller, onToken, onDone, onError)
  } else {
    onError(new Error(`Unknown provider: ${provider}`))
    return () => controller.abort()
  }

  return () => controller.abort()
}

async function streamGemini(
  payload: ContextResolutionResult,
  settings: AppSettings,
  model: string,
  controller: AbortController,
  onToken: (chunk: string) => void,
  onDone: (usage: TokenUsage) => void,
  onError: (err: Error) => void,
) {
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

async function streamOpenRouter(
  payload: ContextResolutionResult,
  settings: AppSettings,
  model: string,
  controller: AbortController,
  onToken: (chunk: string) => void,
  onDone: (usage: TokenUsage) => void,
  onError: (err: Error) => void,
) {
  const base = (settings.openRouterBaseUrl?.trim() || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
  const url = `${base}/chat/completions`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.openRouterApiKey || ''}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: payload.systemPrompt },
          ...payload.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      onError(new Error(`OpenRouter ${res.status}: ${await res.text()}`))
      return
    }

    const reader = res.body!.getReader()
    const decoder = new TextDecoder()
    let usage: TokenUsage = { inputTokens: 0, outputTokens: 0 }
    let buffer = ''

    const processLine = (line: string) => {
      const trimmed = line.trim()
      // Skip blank lines and SSE comment keep-alives (": OPENROUTER PROCESSING")
      if (!trimmed || trimmed.startsWith(':')) return
      if (!trimmed.startsWith('data:')) return
      const json = trimmed.slice(5).trim()
      if (!json || json === '[DONE]') return

      try {
        const parsed = JSON.parse(json)
        if (parsed?.error) {
          onError(new Error(`OpenRouter: ${parsed.error.message ?? 'stream error'}`))
          return
        }
        const content = parsed?.choices?.[0]?.delta?.content
        if (content) onToken(content)
        const meta = parsed?.usage
        if (meta) {
          usage = { inputTokens: meta.prompt_tokens ?? 0, outputTokens: meta.completion_tokens ?? 0 }
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
  model: string,
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
        model,
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
