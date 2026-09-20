import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import {
  Shield,
  TriangleAlert,
  Loader,
  Bot,
  MessageCircle,
  GitBranch,
  ChevronRight,
  ChevronDown,
  History,
} from 'lucide-react'
import { useTreeStore, collectSubtreeIds } from '../store/useTreeStore'
import { useSettingsStore } from '../store/settingsStore'
import { useReaderPanel } from './useReaderPanel'
import { useRenderTally } from '../lib/renderTally'
import { stationSummary } from '../lib/stationSummary'
import { pillModelRef } from '../lib/formatModelRef'
import { PillActions } from './PillActions'
import type { TurnNodeData } from '../types'

const STALE_SENTENCE =
  'An ancestor changed after this answer was generated — it may be out of date.'

const statusRing: Record<string, string> = {
  idle: 'ring-1 ring-slate-700',
  streaming: 'ring-2 ring-cyan-400 animate-pulse',
  error: 'ring-2 ring-red-500',
}

function RoleIcon({ data }: { data: TurnNodeData }) {
  if (data.systemPromptOverride) return <Shield size={16} className="shrink-0 text-amber-400" />
  if (data.status === 'error') return <TriangleAlert size={16} className="shrink-0 text-red-400" />
  if (data.status === 'streaming')
    return <Loader size={16} className="shrink-0 animate-spin text-cyan-400" />
  if (data.parentId === null) return <Bot size={16} className="shrink-0 text-indigo-300" />
  return <MessageCircle size={16} className="shrink-0 text-indigo-400" />
}

// Compact navigational "station pill". Prompt composition + full-text reading
// live in the chat pane / ReaderPanel now, so this only renders wayfinding UI.
export const TurnNodeComponent = memo(function TurnNodeComponent({
  data,
  selected,
}: NodeProps<Node<TurnNodeData>>) {
  useRenderTally(data.id)
  const liveText = useTreeStore((s) => s.liveText.get(data.id))
  const openReader = useReaderPanel((s) => s.open)
  const defaultModel = useSettingsStore((s) => s.settings.defaultModel)
  const toggleCollapse = useTreeStore((s) => s.toggleCollapse)
  const hiddenCount = useTreeStore((s) =>
    data.isCollapsed || data.childrenIds.length > 0
      ? collectSubtreeIds(data.id, s.nodes).size - 1
      : 0,
  )

  const roleLabel =
    data.parentId === null ? 'Root' : data.userPrompt.trim() ? 'You' : 'Assistant'
  // A primitive selector on purpose: settings change rarely, so this does not
  // re-run 200 pills on every store commit the way a node-map read would.
  const modelRef = pillModelRef(data, defaultModel)
  const branchCount = data.childrenIds.length
  const showCollapse = data.isCollapsed || branchCount > 0

  return (
    <div
      onDoubleClick={() => openReader(data.id)}
      data-has-token={liveText ? 'true' : undefined}
      className={`relative flex h-full w-full items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 shadow-lg ${
        statusRing[data.status] ?? statusRing.idle
      } ${selected ? 'ring-2 ring-indigo-400' : ''} ${data.stale ? 'opacity-70' : ''}`}
    >
      <Handle type="target" position={Position.Top} className="!border-slate-800 !bg-indigo-500" />

      <RoleIcon data={data} />

      <div className="min-w-0 flex-1 leading-tight">
        {/* slate-500 failed AA even undimmed (3.75:1); slate-400 gives 6.96:1. */}
        <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-400">
          <span>{roleLabel}</span>
          {data.stale && <History size={10} className="text-amber-400" />}
        </div>
        {/* The pill is 72px tall and spent 27.5px of it, so the extra rows are
            free: role (12.5) + two summary lines (30) + model (12.5) = 55px,
            with no geometry, layout-constant or re-layout change. `line-clamp-2`
            does the final trimming, which is the only place that knows the
            real width. */}
        <div className="line-clamp-2 text-xs text-slate-200">{stationSummary(data)}</div>
        {/* Fan-out siblings carry a byte-identical prompt by construction, so
            no summarizer can tell them apart — the model is the only fact that
            differs, and it is what the comparison is about. */}
        {modelRef && (
          <div className="truncate text-[10px] text-slate-400" title={modelRef}>
            {modelRef}
          </div>
        )}
      </div>

      {branchCount > 1 && (
        <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300">
          <GitBranch size={10} /> {branchCount}
        </span>
      )}

      {showCollapse && (
        <button
          onClick={() => toggleCollapse(data.id)}
          title={data.isCollapsed ? `Show ${hiddenCount} hidden` : 'Collapse subtree'}
          className="nodrag shrink-0 rounded p-1 text-slate-400 transition-colors hover:text-slate-200"
        >
          {data.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
      )}

      {data.stale && <span className="sr-only">{STALE_SENTENCE}</span>}

      <PillActions node={data} selected={selected} />

      <Handle type="source" position={Position.Bottom} className="!border-slate-800 !bg-indigo-500" />
    </div>
  )
})
