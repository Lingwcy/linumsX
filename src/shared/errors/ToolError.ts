import { AgentError, ErrorCode } from './AgentError.js';

export class ToolError extends AgentError {
  constructor(
    message: string,
    public toolName: string,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message, ErrorCode.TOOL_EXECUTION_FAILED, { ...context, toolName }, cause);
    this.name = 'ToolError';
  }
}
