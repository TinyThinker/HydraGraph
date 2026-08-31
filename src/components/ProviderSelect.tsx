import type { LLMProvider } from '../types'

const OPTIONS: { value: LLMProvider; label: string }[] = [
  { value: 'gemini', label: 'Gemini (Google AI Studio)' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'ollama', label: 'Ollama (local)' },
]

interface ProviderSelectProps {
  value: LLMProvider
  onChange: (value: LLMProvider) => void
}

export function ProviderSelect({ value, onChange }: ProviderSelectProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-2">
        Provider
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as LLMProvider)}
        className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}
