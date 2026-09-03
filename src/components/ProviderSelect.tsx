import { providerOptions } from '../lib/providerOptions'
import type { LLMProvider } from '../types'

// The two real providers, sourced from the shared list so the choices live in
// one place (see src/lib/providerOptions.ts).
const OPTIONS = providerOptions()

interface ProviderSelectProps {
  value: LLMProvider
  onChange: (value: LLMProvider) => void
}

export function ProviderSelect({ value, onChange }: ProviderSelectProps) {
  return (
    <div>
      <label
        htmlFor="settings-provider"
        className="block text-xs font-medium text-slate-400 mb-2"
      >
        Provider
      </label>
      <select
        id="settings-provider"
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
