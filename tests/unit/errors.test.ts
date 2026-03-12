import { describe, it, expect } from 'vitest';
import { AgentError, ErrorCode } from '../../src/shared/errors/AgentError';
import { ToolError } from '../../src/shared/errors/ToolError';

describe('AgentError', () => {
  it('should create error with code and context', () => {
    const error = new AgentError(
      'Document not found',
      ErrorCode.DOCUMENT_NOT_FOUND,
      { path: '/test/doc.docx' }
    );

    expect(error.message).toBe('Document not found');
    expect(error.code).toBe(ErrorCode.DOCUMENT_NOT_FOUND);
    expect(error.context).toEqual({ path: '/test/doc.docx' });
  });

  it('should support error chaining', () => {
    const cause = new Error('Original error');
    const error = new AgentError(
      'Failed to process',
      ErrorCode.TOOL_EXECUTION_FAILED,
      {},
      cause
    );

    expect(error.cause).toBe(cause);
  });

  it('should work without context', () => {
    const error = new AgentError('Simple error', ErrorCode.AI_API_ERROR);
    expect(error.context).toBeUndefined();
  });
});

describe('ToolError', () => {
  it('should create tool error with tool name', () => {
    const error = new ToolError(
      'Tool execution failed',
      'format_text',
      { param: 'value' }
    );

    expect(error.message).toBe('Tool execution failed');
    expect(error.toolName).toBe('format_text');
    expect(error.code).toBe(ErrorCode.TOOL_EXECUTION_FAILED);
    expect(error.context?.toolName).toBe('format_text');
  });

  it('should support error chaining', () => {
    const cause = new Error('Original error');
    const error = new ToolError(
      'Tool failed',
      'search_replace',
      {},
      cause
    );

    expect(error.cause).toBe(cause);
  });
});
