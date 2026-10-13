import { useEffect } from 'react'
import { FileText } from 'lucide-react'
import { useReportStore } from '../store/useReportStore'

/**
 * Header toggle for report mode. While it is on, a pill click ticks that turn's
 * branch instead of selecting it. Escape leaves the mode.
 */
export function ReportButton() {
  const selecting = useReportStore((s) => s.selecting)

  useEffect(() => {
    if (!selecting) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useReportStore.getState().stopSelecting()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selecting])

  return (
    <button
      onClick={() => {
        const { selecting: on, startSelecting, stopSelecting } = useReportStore.getState()
        if (on) stopSelecting()
        else startSelecting(useReportStore.getState().leafIds)
      }}
      aria-pressed={selecting}
      title={selecting ? 'Stop picking branches (Esc)' : 'Write a report from selected branches'}
      className={`transition-colors p-2 ${selecting ? 'text-indigo-300' : 'text-slate-400 hover:text-slate-200'}`}
    >
      <FileText size={20} />
    </button>
  )
}
