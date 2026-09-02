import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'
import { useSelectionStore } from '../store/useSelectionStore'
import { useActiveNodeId } from './useActiveNodeId'
import { FanOutRow } from './FanOutRow'
import type { FanOutVariant } from '../services/llm'

interface FanOutModalProps {
  open: boolean
  onClose: () => void
}

const MAX_VARIANTS = 4
const MIN_VARIANTS = 2

export function FanOutModal({ open, onClose }: FanOutModalProps) {
  const parentId = useActiveNodeId()
  const [prompt, setPrompt] = useState('')
  const [variants, setVariants] = useState<FanOutVariant[]>([{}, {}])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setPrompt('')
      setVariants([{}, {}])
      setBusy(false)
    }
  }, [open])

  if (!open) return null

  const patchVariant = (i: number, patch: Partial<FanOutVariant>) => {
    setVariants((prev) => prev.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))
  }

  const removeVariant = (i: number) => {
    setVariants((prev) => prev.filter((_, idx) => idx !== i))
  }

  const addVariant = () => {
    setVariants((prev) => (prev.length >= MAX_VARIANTS ? prev : [...prev, {}]))
  }

  const canDispatch =
    !busy && !!prompt.trim() && !!parentId && variants.length >= MIN_VARIANTS

  const dispatch = async () => {
    if (!canDispatch || !parentId) return
    setBusy(true)
    try {
      const ids = await useTreeStore.getState().fanOutAndSubmit(parentId, prompt.trim(), variants)
      if (ids.length) useSelectionStore.getState().selectAndFocus(ids[0])
      setPrompt('')
      setVariants([{}, {}])
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <div className="bg-slate-900 border border-slate-700 rounded-xl w-[32rem] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-lg font-semibold text-slate-200">
            Fan-out — one prompt, several models
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-300 transition-colors p-1"
          >
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-4 space-y-3 max-h-[60vh] overflow-y-auto">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Shared prompt sent to every branch…"
            rows={3}
            data-testid="fanout-prompt"
            className="w-full resize-none rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />

          <div className="space-y-2">
            {variants.map((variant, i) => (
              <FanOutRow
                key={i}
                index={i}
                variant={variant}
                onChange={(patch) => patchVariant(i, patch)}
                onRemove={() => removeVariant(i)}
                canRemove={variants.length > MIN_VARIANTS}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addVariant}
            disabled={variants.length >= MAX_VARIANTS}
            className="text-xs font-medium text-indigo-400 hover:text-indigo-300 disabled:opacity-40"
          >
            + Add variant
          </button>
        </div>

        <div className="flex gap-2 px-6 py-4 border-t border-slate-700">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-slate-200 bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={dispatch}
            disabled={!canDispatch}
            data-testid="fanout-dispatch"
            className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 disabled:cursor-not-allowed transition-colors"
          >
            Dispatch {variants.length} branches
          </button>
        </div>
      </div>
    </div>
  )
}
