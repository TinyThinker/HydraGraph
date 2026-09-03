import type { LLMProvider } from '../types'

/**
 * Provider dropdown choices, shared by every provider `<select>` so the list
 * lives in one place. Pure data — no store, no React.
 *
 * `''` is the "Inherit" sentinel used by per-node / per-variant overrides that
 * fall through to the tree / global default when left blank.
 */
export interface ProviderOption {
  value: '' | LLMProvider
  label: string
}

const PROVIDERS: readonly ProviderOption[] = [
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'ollama', label: 'Ollama' },
]

/** The two real providers, optionally prefixed with an `Inherit` entry. */
export function providerOptions(opts?: { inherit?: boolean }): ProviderOption[] {
  return opts?.inherit ? [{ value: '', label: 'Inherit' }, ...PROVIDERS] : [...PROVIDERS]
}
