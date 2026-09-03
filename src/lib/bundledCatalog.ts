/**
 * Bundled OpenRouter catalog snapshot.
 *
 * Seeds the app on first run / offline / the no-key demo tree so the catalog is
 * never empty and historical `modelUsed` values still resolve to a price.
 *
 * Hand-maintained approximation of published per-1M-token USD rates (checked
 * 2026-09). Regenerate from the live API with:
 *
 *     node scripts/refresh-catalog.mjs
 *
 * `tier` follows the same output-price tercile rule as the live normalizer
 * (`src/lib/openRouterCatalog.ts` → `normalizeCatalog`).
 */

import type { CatalogModel } from './openRouterCatalog'

export const BUNDLED_CATALOG: CatalogModel[] = [
  { id: 'meta-llama/llama-3.1-8b-instruct', label: 'Meta: Llama 3.1 8B Instruct', inputPerM: 0.02, outputPerM: 0.03, tier: 'cheap', contextWindow: 131072 },
  { id: 'mistralai/mistral-nemo', label: 'Mistral: Mistral Nemo', inputPerM: 0.03, outputPerM: 0.07, tier: 'cheap', contextWindow: 131072 },
  { id: 'google/gemini-flash-1.5', label: 'Google: Gemini 1.5 Flash', inputPerM: 0.075, outputPerM: 0.3, tier: 'cheap', contextWindow: 1000000 },
  { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Meta: Llama 3.3 70B Instruct', inputPerM: 0.12, outputPerM: 0.3, tier: 'cheap', contextWindow: 131072 },
  { id: 'google/gemini-2.0-flash-001', label: 'Google: Gemini 2.0 Flash', inputPerM: 0.1, outputPerM: 0.4, tier: 'cheap', contextWindow: 1000000 },
  { id: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen: Qwen2.5 72B Instruct', inputPerM: 0.23, outputPerM: 0.4, tier: 'cheap', contextWindow: 32768 },
  { id: 'meta-llama/llama-3.1-70b-instruct', label: 'Meta: Llama 3.1 70B Instruct', inputPerM: 0.3, outputPerM: 0.4, tier: 'cheap', contextWindow: 131072 },
  { id: 'openai/gpt-4o-mini', label: 'OpenAI: GPT-4o-mini', inputPerM: 0.15, outputPerM: 0.6, tier: 'cheap', contextWindow: 128000 },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek: DeepSeek V3', inputPerM: 0.27, outputPerM: 1.1, tier: 'cheap', contextWindow: 64000 },
  { id: 'anthropic/claude-3-haiku', label: 'Anthropic: Claude 3 Haiku', inputPerM: 0.25, outputPerM: 1.25, tier: 'mid', contextWindow: 200000 },
  { id: 'openai/gpt-4.1-mini', label: 'OpenAI: GPT-4.1 Mini', inputPerM: 0.4, outputPerM: 1.6, tier: 'mid', contextWindow: 1047576 },
  { id: 'deepseek/deepseek-r1', label: 'DeepSeek: R1', inputPerM: 0.55, outputPerM: 2.19, tier: 'mid', contextWindow: 64000 },
  { id: 'google/gemini-2.5-flash', label: 'Google: Gemini 2.5 Flash', inputPerM: 0.3, outputPerM: 2.5, tier: 'mid', contextWindow: 1048576 },
  { id: 'google/gemini-pro-1.5', label: 'Google: Gemini 1.5 Pro', inputPerM: 1.25, outputPerM: 5, tier: 'mid', contextWindow: 2000000 },
  { id: 'mistralai/mistral-large', label: 'Mistral: Mistral Large', inputPerM: 2, outputPerM: 6, tier: 'mid', contextWindow: 128000 },
  { id: 'openai/gpt-4.1', label: 'OpenAI: GPT-4.1', inputPerM: 2, outputPerM: 8, tier: 'mid', contextWindow: 1047576 },
  { id: 'google/gemini-2.5-pro', label: 'Google: Gemini 2.5 Pro', inputPerM: 1.25, outputPerM: 10, tier: 'mid', contextWindow: 1048576 },
  { id: 'x-ai/grok-2', label: 'xAI: Grok 2', inputPerM: 2, outputPerM: 10, tier: 'mid', contextWindow: 131072 },
  { id: 'openai/gpt-4o', label: 'OpenAI: GPT-4o', inputPerM: 2.5, outputPerM: 10, tier: 'mid', contextWindow: 128000 },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Anthropic: Claude 3.5 Sonnet', inputPerM: 3, outputPerM: 15, tier: 'frontier', contextWindow: 200000 },
  { id: 'anthropic/claude-3.7-sonnet', label: 'Anthropic: Claude 3.7 Sonnet', inputPerM: 3, outputPerM: 15, tier: 'frontier', contextWindow: 200000 },
  { id: 'openai/o1', label: 'OpenAI: o1', inputPerM: 15, outputPerM: 60, tier: 'frontier', contextWindow: 200000 },
  { id: 'anthropic/claude-3-opus', label: 'Anthropic: Claude 3 Opus', inputPerM: 15, outputPerM: 75, tier: 'frontier', contextWindow: 200000 },
]
