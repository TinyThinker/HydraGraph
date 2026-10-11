interface SettingsFooterProps {
  saving: boolean
  onCancel: () => void
  onSave: () => void
}

/** Cancel / Save row at the bottom of `SettingsModal`. Save is never gated on a test. */
export function SettingsFooter({ saving, onCancel, onSave }: SettingsFooterProps) {
  return (
    <div className="flex gap-2 px-6 py-4 border-t border-slate-700">
      <button
        onClick={onCancel}
        className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-slate-200 bg-slate-700 hover:bg-slate-600 transition-colors"
      >
        Cancel
      </button>
      <button
        onClick={onSave}
        disabled={saving}
        className="flex-1 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 disabled:cursor-not-allowed transition-colors"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
