import type { TurnNode, ContextResolutionResult } from '../types'

export function resolveContextPayload(
  targetNodeId: string,
  nodeMap: Map<string, TurnNode>,
  globalDefaultSystemPrompt: string,
): ContextResolutionResult {
  const ancestryChain: TurnNode[] = []
  let currentNodeId: string | null = targetNodeId

  // Walk upward using parentId pointers
  while (currentNodeId !== null) {
    const node = nodeMap.get(currentNodeId)
    if (!node) break
    ancestryChain.unshift(node)
    currentNodeId = node.parentId
  }

  // Resolve cascading system prompt: nearest ancestor override wins
  let systemPrompt = globalDefaultSystemPrompt
  for (let i = ancestryChain.length - 1; i >= 0; i--) {
    const override = ancestryChain[i].systemPromptOverride?.trim()
    if (override) {
      systemPrompt = override
      break
    }
  }

  // Unfold ancestry chain into API message array
  const messages: ContextResolutionResult['messages'] = []
  for (const node of ancestryChain) {
    if (node.userPrompt.trim()) {
      messages.push({ role: 'user', content: node.userPrompt })
    }
    // Skip current node's response — it's what we're generating
    if (node.assistantResponse.trim() && node.id !== targetNodeId) {
      messages.push({ role: 'assistant', content: node.assistantResponse })
    }
  }

  return { systemPrompt, messages }
}
