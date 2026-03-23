// src/infrastructure/ai/StreamingHandler.ts
import { Agent } from '../../domain/agent/Agent.js';
import { SSEWriter } from './SSEWriter.js';
import log from 'electron-log';

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResult {
  toolCallId: string;
  name: string;
  success: boolean;
  content: string;
}

interface StreamHooks {
  onThinking?: (text: string) => void;
  onAnswer?: (text: string) => void;
  onToolCall?: (tool: ToolCall) => void;
  onToolResult?: (result: ToolResult) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

export class StreamingHandler {
  private writer: SSEWriter;

  constructor(writer: SSEWriter) {
    this.writer = writer;
  }

  async runWithStreaming(
    agent: Agent,
    instruction: string,
    hooks: StreamHooks = {}
  ): Promise<string> {
    log.info('[StreamingHandler] Starting streaming for instruction:', instruction.slice(0, 50));

    try {
      // Run agent with hooks to capture events and forward to SSEWriter
      const result = await agent.run(instruction, {
        onStateChange: (update) => {
          log.info('[StreamingHandler] State:', update.state, update.summary);
        },
        onText: (text: string) => {
          // Send answer chunk
          this.writer.sendAnswer(text);
          hooks.onAnswer?.(text);
        },
        onToolStart: (event) => {
          log.info('[StreamingHandler] Tool start:', event.name);
          // Forward tool call event
          this.writer.sendToolCall(
            event.name + '-' + Date.now(),
            event.name,
            event.input as Record<string, unknown>
          );
          hooks.onToolCall?.({
            id: event.name + '-' + Date.now(),
            name: event.name,
            input: event.input as Record<string, unknown>,
          });
        },
        onToolResult: (event) => {
          log.info('[StreamingHandler] Tool result:', event.name, event.success);
          // Forward tool result event
          const content = typeof event.result === 'string'
            ? event.result
            : JSON.stringify(event.result);
          this.writer.sendToolResult(
            event.name + '-' + Date.now(),
            event.name,
            event.success ?? true,
            content
          );
          hooks.onToolResult?.({
            toolCallId: event.name + '-' + Date.now(),
            name: event.name,
            success: event.success ?? true,
            content,
          });
        },
      });

      // Send complete event
      this.writer.sendComplete();
      hooks.onComplete?.();

      log.info('[StreamingHandler] Streaming completed');
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      log.error('[StreamingHandler] Error:', errorMessage);
      this.writer.sendError(errorMessage);
      hooks.onError?.(errorMessage);
      throw error;
    }
  }
}
