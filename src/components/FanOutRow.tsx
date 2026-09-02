import { PERSONA_PRESETS } from '../lib/personaPresets'
import type { FanOutVariant } from '../services/llm'
import type { LLMProvider } from '../types'

interface FanOutRowProps {
  index: number
  variant: FanOutVariant
  onChange: (patch: Partial<FanOutVariant>) => void
  onRemove: () => void
  canRemove: boolean
}

const PROVIDERS: { value: string; label: string }[] = [
  { value: '', label: 'Inherit' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'ollama', label: 'Ollama' },
]

const control =
  'bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

export function FanOutRow({ index, variant, onChange, onRemove, canRemove }: FanOutRowProps) {
  const activePersona =
    PERSONA_PRESETS.find((p) => p.prompt === variant.systemPromptOverride)?.label ?? ''

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/40 p-2">
      <span className="text-xs font-medium text-slate-500">#{index + 1}</span>

      <select
        aria-label={`Variant ${index + 1} provider`}
        value={variant.provider ?? ''}
        onChange={(e) => onChange({ provider: (e.target.value || null) as LLMProvider | null })}
        className={control}
      >
        {PROVIDERS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      <input
        type="text"
        aria-label={`Variant ${index + 1} model`}
        value={variant.model ?? ''}
        onChange={(e) => onChange({ model: e.target.value || null })}
        placeholder="gemini-2.5-flash"
        className={`${control} flex-1 min-w-[8rem]`}
      />

      <select
        aria-label={`Variant ${index + 1} persona`}
        value={activePersona}
        onChange={(e) => {
          const preset = PERSONA_PRESETS.find((p) => p.label === e.target.value)
          onChange({ systemPromptOverride: preset ? preset.prompt : null })
        }}
        className={control}
      >
        <option value="">No persona</option>
        {PERSONA_PRESETS.map((p) => (
          <option key={p.label} value={p.label}>
            {p.label}
          </option>
        ))}
      </select>

      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove variant ${index + 1}`}
          className="ml-auto flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-700 hover:text-slate-200"
        >
          ×
        </button>
      )}
    </div>
  )
}
