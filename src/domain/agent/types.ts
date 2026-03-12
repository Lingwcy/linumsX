// src/domain/agent/types.ts
import { ToolDescription } from '../tools/types.js';
import { AIModelClient } from '../../infrastructure/ai/types.js';

export interface AgentConfig {
  maxIterations?: number;
  temperature?: number;
  maxTokens?: number;
  aiClient?: AIModelClient;
  persistConversation?: boolean;
}

export type AgentRunState = 'idle' | 'thinking' | 'tool_use' | 'responding';

export interface AgentStateUpdate {
  state: AgentRunState;
  summary: string;
  iteration?: number;
}

export interface AgentToolEvent {
  name: string;
  input: object;
  summary: string;
  result?: unknown;
  success?: boolean;
  iteration?: number;
}

export interface AgentRunHooks {
  onStateChange?: (update: AgentStateUpdate) => void;
  onToolStart?: (event: AgentToolEvent) => void;
  onToolResult?: (event: AgentToolEvent) => void;
  onText?: (text: string) => void;
}

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AgentContext {
  documentPath: string;
  documentInfo: string;
  toolDescriptions: ToolDescription[];
  messages: AgentMessage[];
}
