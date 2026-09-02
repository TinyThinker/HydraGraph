export type NodeStatus = 'idle' | 'streaming' | 'error'
export type LLMProvider = 'gemini' | 'openrouter' | 'ollama'

export interface TurnNode {
  id: string
  treeId: string
  parentId: string | null
  childrenIds: string[]
  userPrompt: string
  assistantResponse: string
  systemPromptOverride?: string
  positionX: number
  positionY: number
  isCollapsed: boolean
  status: NodeStatus
  // Doubles as the per-turn model override (highest-precedence dispatch input)
  // and the post-run record of which model actually generated the turn.
  modelUsed: string
  // Per-turn provider override (input to dispatch resolution); distinct from
  // `provider` below, which records what actually ran.
  providerOverride?: LLMProvider
  inputTokens?: number
  outputTokens?: number
  timestamp: number
  provider?: LLMProvider
  errorMessage?: string
  width?: number
  height?: number
  stale?: boolean
}

export interface ConversationTree {
  id: string
  title: string
  rootNodeId: string
  defaultSystemPrompt: string
  createdAt: number
  updatedAt: number
  viewportX?: number
  viewportY?: number
  viewportZoom?: number
  // Tree-scoped dispatch defaults. Sit between a node-level override and the
  // global settings store when resolving which provider/model a prompt uses.
  defaultProvider?: LLMProvider
  defaultModel?: string
}

export type ProviderModelMap = Partial<Record<LLMProvider, string>>

export interface AppSettings {
  id: 'global_settings'
  geminiApiKey?: string
  openRouterApiKey?: string
  ollamaBaseUrl: string
  openRouterBaseUrl?: string
  defaultModel: string
  defaultModels?: ProviderModelMap
  activeTreeId?: string
  provider: LLMProvider
}

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

export interface MessagePayload {
  role: 'user' | 'assistant'
  content: string
}

export interface ContextResolutionResult {
  systemPrompt: string
  messages: MessagePayload[]
}

// React Flow requires node data to extend Record<string, unknown>
export type TurnNodeData = TurnNode & Record<string, unknown>
