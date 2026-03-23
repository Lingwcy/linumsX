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

    // Map to store tool call IDs for correlation
    const toolCallIds = new Map<string, string>();

    try {
      // Run agent with hooks to capture events and forward to SSEWriter
      const result = await agent.run(instruction, {
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
          const toolCallId = event.name + '-' + Date.now();
          toolCallIds.set(event.name, toolCallId);

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
          // Get the stored ID or generate new one if not found
          const toolCallId = toolCallIds.get(event.name) || event.name + '-' + Date.now();

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
