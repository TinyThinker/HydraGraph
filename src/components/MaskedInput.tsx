import { Eye, EyeOff } from 'lucide-react'

interface MaskedInputProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  showPassword: boolean
  onToggleShow: () => void
}

export function MaskedInput({
  label,
  value,
  onChange,
  placeholder,
  showPassword,
  onToggleShow,
}: MaskedInputProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-2">
        {label}
      </label>
      <div className="flex gap-2 items-center">
        <input
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder={placeholder}
        />
        <button
          onClick={onToggleShow}
          className="text-slate-400 hover:text-slate-300 transition-colors p-2"
        >
          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  )
}
