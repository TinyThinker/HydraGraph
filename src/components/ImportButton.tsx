import { Upload, X } from 'lucide-react'
import { useImportPicker } from './useImportPicker'

export function ImportButton() {
  const { inputProps, pick, error, clearError } = useImportPicker()

  return (
    <div className="relative">
      <input {...inputProps} />
      <button
        onClick={pick}
        title="Import a tree from JSON"
        className="text-slate-400 hover:text-slate-200 transition-colors p-2"
      >
        <Upload size={20} />
      </button>
      {error && (
        <div className="absolute right-0 top-full mt-1 z-40 w-72 bg-red-950/90 border border-red-800/60 rounded-lg shadow-2xl p-3 text-xs text-red-200">
          <div className="flex justify-between items-start gap-2">
            <span>{error}</span>
            <button
              onClick={clearError}
              className="flex-shrink-0 text-red-300 hover:text-red-100 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
