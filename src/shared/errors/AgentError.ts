export enum ErrorCode {
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  AI_API_ERROR = 'AI_API_ERROR',
  INVALID_CONFIG = 'INVALID_CONFIG',
}

export class AgentError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public context?: Record<string, unknown>,
    public cause?: Error
  ) {
    super(message);
    this.name = 'AgentError';
    if (cause) {
      this.cause = cause;
    }
  }
}
