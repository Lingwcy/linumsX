/**
 * SSEWriter - Handles Server-Sent Events for AI response streaming
 * Aligns event types with renderer expectations
 */
import { BrowserWindow } from 'electron';

export type SSEEventType = 'state' | 'chunk' | 'tool_start' | 'tool_result' | 'tool_progress' | 'done' | 'error';

export interface SSEEvent {
  type: SSEEventType;
  content?: string;
  toolCallId?: string;
  name?: string;
  success?: boolean;
  progress?: number;
  error?: string;
  [key: string]: unknown;
}

export class SSEWriter {
  private window: BrowserWindow | null;
  private sessionId: string;
  private closed = false;

  constructor(window: BrowserWindow | null, sessionId: string = 'default') {
    this.window = window;
    this.sessionId = sessionId;
  }

  setWindow(window: BrowserWindow): void {
    this.window = window;
  }

  private send(event: SSEEvent): void {
    if (this.closed || !this.window) return;
    try {
      // For events with content, send directly; for events without, stringify
      const content = event.content || JSON.stringify(event);
      this.window.webContents.send('ai:chunk', {
        type: event.type,
        content,
      });
    } catch {
      this.closed = true;
    }
  }

  sendThinking(content: string): void {
    // Renderer expects: { type: 'state', content: JSON.stringify({ state: 'thinking', summary: '...' }) }
    const stateContent = JSON.stringify({ state: 'thinking', summary: content });
    this.send({ type: 'state', content: stateContent });
  }

  sendAnswer(content: string): void {
    this.send({ type: 'chunk', content });
  }

  sendToolCall(toolCallId: string, name: string, arguments_: Record<string, unknown>): void {
    // Renderer expects: { type: 'tool_start', content: JSON.stringify({ name, summary, input }) }
    const content = JSON.stringify({ name, summary: `Running ${name}`, input: arguments_ });
    this.send({ type: 'tool_start', content });
  }

  sendToolProgress(toolCallId: string, progress: number): void {
    this.send({ type: 'tool_progress', toolCallId, progress });
  }

  sendToolResult(toolCallId: string, name: string, success: boolean, content: string): void {
    this.send({ type: 'tool_result', toolCallId, name, success, content });
  }

  sendComplete(): void {
    this.send({ type: 'done', content: '' });
  }

  sendError(content: string): void {
    this.send({ type: 'error', content });
  }

  close(): void {
    this.closed = true;
    this.window = null;
  }
}
