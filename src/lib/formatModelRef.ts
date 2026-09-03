import type { LLMProvider } from '../types'

/**
 * Compact `provider/model` label for a dispatch pair. Blank provider reads as
 * `inherit` (falls through to tree / global default); blank model as `(default)`.
 * Pure — no store, no React.
 */
export function formatModelRef(
  provider: LLMProvider | null | undefined,
  model: string | null | undefined,
): string {
  return `${provider ?? 'inherit'}/${model || '(default)'}`
}
