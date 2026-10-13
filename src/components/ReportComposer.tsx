import { useMemo, useState } from 'react'
import { useReportStore } from '../store/useReportStore'
import { useTreeStore } from '../store/useTreeStore'
import { useSettingsStore } from '../store/settingsStore'
import { useCatalogStore } from '../store/catalogStore'
import { ModelSelect } from './ModelSelect'
import { DEFAULT_BRIEF } from '../lib/reportBrief'
import { fitLine, planReport } from '../lib/reportFit'

export function ReportComposer() {
  const leafIds = useReportStore((s) => s.leafIds)
  const selecting = useReportStore((s) => s.selecting)
  const error = useReportStore((s) => s.error)
  const nodes = useTreeStore((s) => s.nodes)
  const tree = useTreeStore((s) => s.trees.find((t) => t.id === s.activeTreeId))
  const settings = useSettingsStore((s) => s.settings)
  const catalog = useCatalogStore((s) => s.models)

  const [brief, setBrief] = useState(DEFAULT_BRIEF)
  const [model, setModel] = useState(
    () =>
      (tree?.defaultProvider === 'openrouter' && tree.defaultModel) ||
      settings.defaultModels?.openrouter ||
      settings.defaultModel,
  )

  const plan = useMemo(
    () => planReport({ leafIds, nodes, brief, provider: 'openrouter', model, settings, catalog }),
    [leafIds, nodes, brief, model, settings, catalog],
  )
  const canGenerate = plan.turns.length > 0 && plan.fit.fits && plan.writer.ok && model.trim() !== ''

  return (
    <div className="space-y-4 text-sm text-slate-200">
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          {leafIds.length} {leafIds.length === 1 ? 'branch' : 'branches'} · {plan.turns.length} turns selected
        </span>
        {!selecting && (
          <button onClick={() => useReportStore.getState().startSelecting(leafIds)} className="text-indigo-300 hover:text-indigo-200">
            Pick on canvas
          </button>
        )}
      </div>
      {leafIds.length === 0 && (
        <p className="text-xs text-slate-400">Click turns on the canvas. Each one adds its whole branch.</p>
      )}

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label htmlFor="report-brief" className="text-xs font-medium text-slate-400">
            Brief
          </label>
          {brief !== DEFAULT_BRIEF && (
            <button onClick={() => setBrief(DEFAULT_BRIEF)} className="text-xs text-indigo-300 hover:text-indigo-200">
              Reset
            </button>
          )}
        </div>
        <textarea
          id="report-brief"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={9}
          className="w-full resize-y rounded border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="space-y-1">
        <label htmlFor="report-model" className="text-xs font-medium text-slate-400">
          Writer model (OpenRouter)
        </label>
        <ModelSelect id="report-model" provider="openrouter" value={model} onChange={setModel} />
        <p data-testid="report-fit" className={`text-xs ${plan.writer.ok && plan.fit.fits ? 'text-slate-400' : 'text-amber-400'}`}>
          {plan.writer.ok ? fitLine(plan, model, catalog) : plan.writer.message}
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>

      <button
        onClick={() => void useReportStore.getState().generate({ brief, provider: 'openrouter', model })}
        disabled={!canGenerate}
        className="w-full rounded bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-40"
      >
        Generate report
      </button>
    </div>
  )
}
