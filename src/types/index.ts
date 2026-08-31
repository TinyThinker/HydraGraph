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
  modelUsed: string
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
}

export interface AppSettings {
  id: 'global_settings'
  geminiApiKey?: string
  openRouterApiKey?: string
  ollamaBaseUrl: string
  defaultModel: string
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
