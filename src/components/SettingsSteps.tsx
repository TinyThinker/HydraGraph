import { Check } from 'lucide-react'
import type { SetupStep } from './useSetupSteps'

interface SettingsStepsProps {
  steps: SetupStep[]
  current: number
}

const NUMERALS = ['①', '②', '③']

/**
 * One compact row at the top of Settings: ① Provider ② Key ③ Test. A tick
 * replaces the numeral when a step is done; the current step is highlighted.
 * Guidance only — it hides nothing and gates nothing.
 */
export function SettingsSteps({ steps, current }: SettingsStepsProps) {
  return (
    <ol aria-label="Setup steps" className="flex items-center gap-3 text-xs">
      {steps.map((step, i) => {
        const tone =
          i === current ? 'text-indigo-300 font-medium' : step.done ? 'text-emerald-400' : 'text-slate-500'
        return (
          <li
            key={step.label}
            data-done={step.done}
            aria-current={i === current ? 'step' : undefined}
            className={`flex items-center gap-1 ${tone}`}
          >
            {step.done ? <Check size={12} aria-label="done" /> : <span>{NUMERALS[i]}</span>}
            <span>{step.label}</span>
            {step.note && <span className="text-slate-400">({step.note})</span>}
          </li>
        )
      })}
    </ol>
  )
}
