import { useEffect, useState } from 'react'
import { useTreeStore } from '../store/useTreeStore'
import { useSettingsStore } from '../store/settingsStore'
import { PERSONA_PRESETS } from '../lib/personaPresets'
import { providerOptions } from '../lib/providerOptions'
import { ModelSelect } from './ModelSelect'
import type { LLMProvider, TurnNode } from '../types'

const PROVIDERS = providerOptions({ inherit: true })

const FIELD =
  'w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 ' +
  'focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-40'

/**
 * Per-node dispatch controls for the reader panel: provider override (with an
 * "Inherit" choice), model field, and a persona / system-prompt editor with
 * presets. Every edit persists through `updateNode` and takes effect on the
 * next Regenerate (the control in the panel header).
 */
export function NodeDispatchControls({ node }: { node: TurnNode }) {
  const updateNode = useTreeStore((s) => s.updateNode)
  const [model, setModel] = useState(node.modelUsed)
  const [persona, setPersona] = useState(node.systemPromptOverride ?? '')
  const disabled = node.status === 'streaming'

  useEffect(() => {
    setModel(node.modelUsed)
    setPersona(node.systemPromptOverride ?? '')
  }, [node.id, node.modelUsed, node.systemPromptOverride])

  const commitModel = () => {
    if (model !== node.modelUsed) void updateNode(node.id, { modelUsed: model })
  }
  const commitPersona = (value: string) => {
    setPersona(value)
    void updateNode(node.id, { systemPromptOverride: value || undefined })
  }

  return (
    <div className="space-y-2 rounded border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-xs font-medium text-slate-400">Dispatch override</p>

      <label className="block space-y-1">
        <span className="text-xs text-slate-400">Provider</span>
        <select
          className={FIELD}
          disabled={disabled}
          value={node.providerOverride ?? ''}
          onChange={(e) =>
            void updateNode(node.id, {
              providerOverride: (e.target.value as LLMProvider) || undefined,
            })
          }
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-xs text-slate-400">Model</span>
        <ModelSelect
          provider={node.providerOverride ?? useSettingsStore.getState().settings.provider}
          value={model}
          disabled={disabled}
          ariaLabel="Model"
          onChange={setModel}
          onBlur={commitModel}
        />
      </label>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400">Persona (system prompt override)</span>
          {node.systemPromptOverride && (
            <button
              type="button"
              disabled={disabled}
              className="text-xs text-slate-400 hover:text-slate-200 disabled:opacity-40"
              onClick={() => commitPersona('')}
            >
              Clear
            </button>
          )}
        </div>
        <textarea
          className={`${FIELD} min-h-[4rem] resize-y`}
          disabled={disabled}
          value={persona}
          placeholder="Cascades to descendant turns."
          onChange={(e) => setPersona(e.target.value)}
          onBlur={(e) => commitPersona(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          {PERSONA_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              disabled={disabled}
              className="rounded border border-slate-600 px-2 py-0.5 text-[11px] text-slate-300 transition-colors hover:bg-slate-700 hover:text-slate-100 disabled:opacity-40"
              onClick={() => commitPersona(preset.prompt)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500">Changes apply on the next Regenerate.</p>
    </div>
  )
}
