import { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { useTreeStore } from '../store/useTreeStore'

export function ImportButton() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const importTree = useTreeStore((s) => s.importTree)

  const handlePick = () => {
    fileRef.current?.click()
  }

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    setError(null)

    let text: string
    try {
      text = await file.text()
    } catch {
      setError('Could not read the file.')
      return
    }

    const res = await importTree(text)
    if (!res.ok) {
      setError(res.error ?? 'Import failed.')
    }
  }

  return (
    <div className="relative">
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={handleFile}
      />
      <button
        onClick={handlePick}
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
              onClick={() => setError(null)}
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
