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

    // Counter for sequential tool call IDs (avoids collision when same tool is called multiple times)
    let toolCallCounter = 0;
    // Array to store tool call IDs in order (tools run sequentially)
    const toolCallIds: string[] = [];

    try {
      // Run agent with streaming support for real-time event streaming
      const result = await agent.runStream(instruction, {
        onStateChange: (update) => {
          log.info('[StreamingHandler] State:', update.state, update.summary);
          // Forward thinking state
          if (update.state === 'thinking') {
            this.writer.sendThinking(update.summary);
            hooks.onThinking?.(update.summary);
          }
        },
        onText: (text: string) => {
          // Send answer chunk
          this.writer.sendAnswer(text);
          hooks.onAnswer?.(text);
        },
        onToolStart: (event) => {
          const toolCallId = `tool-${++toolCallCounter}`;
          toolCallIds.push(toolCallId);

          log.info('[StreamingHandler] Tool start:', event.name);
          // Forward tool call event
          this.writer.sendToolCall(
            toolCallId,
            event.name,
            event.input as Record<string, unknown>
          );
          hooks.onToolCall?.({
            id: toolCallId,
            name: event.name,
            input: event.input as Record<string, unknown>,
          });
        },
        onToolResult: (event) => {
          // Since tools run sequentially, pop the last ID from the array
          const toolCallId = toolCallIds.pop() || event.name + '-' + Date.now();

          log.info('[StreamingHandler] Tool result:', event.name, event.success);
          // Forward tool result event
          const content = typeof event.result === 'string'
            ? event.result
            : JSON.stringify(event.result);
          this.writer.sendToolResult(
            toolCallId,
            event.name,
            event.success ?? true,
            content
          );
          hooks.onToolResult?.({
            toolCallId,
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
