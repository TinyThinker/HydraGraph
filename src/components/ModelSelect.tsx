import { useId } from 'react'
import { useCatalogStore } from '../store/catalogStore'
import type { LLMProvider } from '../types'

interface ModelSelectProps {
  /** Which provider the surrounding dispatch pair targets. */
  provider: LLMProvider
  /** Current model id (free text is always allowed). */
  value: string
  /** Fires on every keystroke / picked datalist option with the raw value. */
  onChange: (model: string) => void
  /** Optional commit-on-blur hook; receives the field's current value. */
  onBlur?: (model: string) => void
  /** Explicit id for the `<input>`; a stable one is generated when omitted. */
  id?: string
  disabled?: boolean
  ariaLabel?: string
  /** Extra classes appended to the shared field styling (defaults to `w-full`). */
  className?: string
}

const BASE =
  'bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 ' +
  'placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40'

/**
 * Model picker. Presentational only — never writes a store.
 *
 * - `openrouter`: an `<input list>` + `<datalist>` combobox over the live
 *   OpenRouter catalog, each option priced `$in/$out per 1M`. Typing a custom id
 *   the catalog missed still works and is passed straight through.
 * - `ollama`: a plain text `<input>` (local models are not enumerable).
 */
export function ModelSelect({
  provider,
  value,
  onChange,
  onBlur,
  id,
  disabled,
  ariaLabel,
  className,
}: ModelSelectProps) {
  const models = useCatalogStore((s) => s.models)
  const generatedId = useId()
  const fieldId = id ?? generatedId
  const listId = `${fieldId}-catalog`
  const isOpenRouter = provider === 'openrouter'

  return (
    <>
      <input
        id={fieldId}
        type="text"
        list={isOpenRouter ? listId : undefined}
        className={`${BASE} ${className ?? 'w-full'}`}
        disabled={disabled}
        value={value}
        aria-label={ariaLabel}
        placeholder={isOpenRouter ? 'Search or type a model id' : 'llama3.1'}
        autoComplete="off"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur ? (e) => onBlur(e.target.value) : undefined}
      />
      {isOpenRouter && (
        <datalist id={listId}>
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {`${m.label} · $${m.inputPerM}/$${m.outputPerM} per 1M`}
            </option>
          ))}
        </datalist>
      )}
    </>
  )
}
