export interface PersonaPreset {
  label: string
  prompt: string
}

/**
 * Ready-made system-prompt personas for model/persona arbitration. Selecting one
 * writes its `prompt` into a node's `systemPromptOverride`; it then cascades to
 * descendants and takes effect on the next Regenerate.
 */
export const PERSONA_PRESETS: PersonaPreset[] = [
  {
    label: 'Performance Engineer',
    prompt:
      'You are a senior performance engineer. Prioritise latency, throughput, and resource cost. Call out algorithmic complexity and hot paths.',
  },
  {
    label: 'Security Auditor',
    prompt:
      'You are a security auditor. Assume adversarial input. Surface trust boundaries, injection vectors, and unsafe defaults before anything else.',
  },
  {
    label: 'Skeptic',
    prompt:
      'You are a rigorous skeptic. Challenge assumptions, demand evidence, and name the weakest link in any argument.',
  },
  {
    label: 'Plain-language explainer',
    prompt:
      'Explain for a smart non-expert. No jargon without a one-line definition. Prefer concrete examples over abstractions.',
  },
]
