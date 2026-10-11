import { useRef, useState, type ChangeEvent } from 'react'
import { useTreeStore } from '../store/useTreeStore'

/**
 * File-pick + `importTree` for any "import a backup" control. Spread
 * `inputProps` onto a hidden `<input type="file">` and call `pick()` from a
 * visible button.
 */
export function useImportPicker() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const importTree = useTreeStore((s) => s.importTree)

  const pick = () => {
    fileRef.current?.click()
  }

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
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

  const inputProps = {
    ref: fileRef,
    type: 'file',
    accept: 'application/json,.json',
    className: 'hidden',
    onChange: handleFile,
  } as const

  return { inputProps, pick, error, clearError: () => setError(null) }
}
