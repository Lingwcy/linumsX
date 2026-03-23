// src/infrastructure/ai/SSEWriter.ts
import { BrowserWindow } from 'electron';

export type SSEEventType = 'thinking' | 'answer' | 'tool_call' | 'tool_result' | 'tool_progress' | 'complete' | 'error';

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
    this.send({ type: 'thinking', content });
  }

  sendAnswer(content: string): void {
    this.send({ type: 'answer', content });
  }

  sendToolCall(toolCallId: string, name: string, arguments_: Record<string, unknown>): void {
    this.send({ type: 'tool_call', toolCallId, name, arguments: arguments_ });
  }

  sendToolProgress(toolCallId: string, progress: number): void {
    this.send({ type: 'tool_progress', toolCallId, progress });
  }

  sendToolResult(toolCallId: string, name: string, success: boolean, content: string): void {
    this.send({ type: 'tool_result', toolCallId, name, success, content });
  }

  sendComplete(): void {
    this.send({ type: 'complete' });
  }

  sendError(content: string): void {
    this.send({ type: 'error', content });
  }

  close(): void {
    this.closed = true;
    this.window = null;
  }
}
