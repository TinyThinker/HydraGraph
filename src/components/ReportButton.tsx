import { useEffect } from 'react'
import { FileText } from 'lucide-react'
import { useReportStore } from '../store/useReportStore'

/**
 * Header toggle for the report panel. While the composer shows, a pill click
 * ticks that turn's branch instead of selecting it. Escape stops ticking.
 */
export function ReportButton() {
  const selecting = useReportStore((s) => s.selecting)
  const panelOpen = useReportStore((s) => s.panelOpen)

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
        const { panelOpen: open, openPanel, closePanel } = useReportStore.getState()
        if (open) closePanel()
        else openPanel()
      }}
      aria-pressed={panelOpen}
      title={panelOpen ? 'Close reports' : 'Reports from selected branches'}
      className={`transition-colors p-2 ${panelOpen ? 'text-indigo-300' : 'text-slate-400 hover:text-slate-200'}`}
    >
      <FileText size={20} />
    </button>
  )
}
