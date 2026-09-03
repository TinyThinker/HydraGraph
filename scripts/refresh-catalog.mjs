#!/usr/bin/env node
/**
 * Regenerate src/lib/bundledCatalog.ts from the live OpenRouter model list.
 *
 *     node scripts/refresh-catalog.mjs
 *
 * Keeps the normalization in sync with src/lib/openRouterCatalog.ts. Only the
 * curated `KEEP` subset is written, so the bundled snapshot stays small.
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const API_URL = 'https://openrouter.ai/api/v1/models'
const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'lib', 'bundledCatalog.ts')

// Popular ids to retain. Must keep openai/gpt-4o-mini + the google/* Gemini
// remap targets so historical costs resolve.
const KEEP = new Set([
  'openai/gpt-4o-mini',
  'openai/gpt-4o',
  'openai/gpt-4.1',
  'openai/gpt-4.1-mini',
  'openai/o1',
  'anthropic/claude-3.5-sonnet',
  'anthropic/claude-3.7-sonnet',
  'anthropic/claude-3-opus',
  'anthropic/claude-3-haiku',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'google/gemini-flash-1.5',
  'google/gemini-pro-1.5',
  'google/gemini-2.0-flash-001',
  'meta-llama/llama-3.1-70b-instruct',
  'meta-llama/llama-3.1-8b-instruct',
  'meta-llama/llama-3.3-70b-instruct',
  'mistralai/mistral-nemo',
  'mistralai/mistral-large',
  'qwen/qwen-2.5-72b-instruct',
  'x-ai/grok-2',
  'deepseek/deepseek-chat',
  'deepseek/deepseek-r1',
])

const toNumber = (value) => {
  const n = typeof value === 'string' ? Number.parseFloat(value) : typeof value === 'number' ? value : NaN
  return Number.isFinite(n) ? n : 0
}

const percentile = (sortedAsc, p) =>
  sortedAsc.length === 0 ? 0 : sortedAsc[Math.floor((sortedAsc.length - 1) * p)]

function normalizeCatalog(payload) {
  const data = Array.isArray(payload?.data) ? payload.data : []
  const rows = data
    .filter((m) => m && typeof m === 'object' && typeof m.id === 'string')
    .map((m) => {
      const ctx = toNumber(m.context_length)
      return {
        id: m.id,
        label: typeof m.name === 'string' && m.name.length > 0 ? m.name : m.id,
        inputPerM: toNumber(m.pricing?.prompt) * 1e6,
        outputPerM: toNumber(m.pricing?.completion) * 1e6,
        contextWindow: ctx > 0 ? ctx : undefined,
      }
    })

  const outputsAsc = rows.map((m) => m.outputPerM).sort((a, b) => a - b)
  const p33 = percentile(outputsAsc, 1 / 3)
  const p66 = percentile(outputsAsc, 2 / 3)

  return rows
    .map((m) => ({ ...m, tier: m.outputPerM <= p33 ? 'cheap' : m.outputPerM <= p66 ? 'mid' : 'frontier' }))
    .sort((a, b) => a.outputPerM - b.outputPerM || a.inputPerM - b.inputPerM || a.id.localeCompare(b.id))
}

const serialize = (m) => {
  const parts = [
    `id: ${JSON.stringify(m.id)}`,
    `label: ${JSON.stringify(m.label)}`,
    `inputPerM: ${m.inputPerM}`,
    `outputPerM: ${m.outputPerM}`,
    `tier: ${JSON.stringify(m.tier)}`,
  ]
  if (m.contextWindow !== undefined) parts.push(`contextWindow: ${m.contextWindow}`)
  return `  { ${parts.join(', ')} },`
}

const res = await fetch(API_URL, { headers: { Accept: 'application/json' } })
if (!res.ok) throw new Error(`OpenRouter /models responded ${res.status}`)

const all = normalizeCatalog(await res.json())
const kept = all.filter((m) => KEEP.has(m.id))
if (kept.length === 0) throw new Error('No models matched the KEEP set — API shape changed?')

const file = `/**
 * Bundled OpenRouter catalog snapshot.
 *
 * Seeds the app on first run / offline / the no-key demo tree so the catalog is
 * never empty and historical \`modelUsed\` values still resolve to a price.
 *
 * AUTO-GENERATED — regenerate with:
 *
 *     node scripts/refresh-catalog.mjs
 *
 * Source: ${API_URL}
 * Captured: ${new Date().toISOString()}
 */

import type { CatalogModel } from './openRouterCatalog'

export const BUNDLED_CATALOG: CatalogModel[] = [
${kept.map(serialize).join('\n')}
]
`

await writeFile(OUT_PATH, file)
console.log(`Wrote ${kept.length} of ${all.length} models to ${OUT_PATH}`)
