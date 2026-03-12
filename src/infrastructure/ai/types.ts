// src/infrastructure/ai/types.ts
export interface AIModelClient {
  complete(params: CompleteParams): Promise<CompleteResponse>;
}

export interface TextContentBlock {
  type: 'text';
  text: string;
}

export interface ToolUseContentBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: object;
}

export interface ToolResultContentBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export type MessageContentBlock = TextContentBlock | ToolUseContentBlock | ToolResultContentBlock;

export interface CompleteMessage {
  role: 'user' | 'assistant';
  content: string | MessageContentBlock[];
}

export interface CompleteParams {
  system?: string;
  messages: CompleteMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: object;
  }>;
}

export interface CompleteResponse {
  content: Array<TextContentBlock | Partial<ToolUseContentBlock> & { type: 'tool_use' }>;
  stop_reason: 'end_turn' | 'max_tokens' | 'tool_use' | null;
}
